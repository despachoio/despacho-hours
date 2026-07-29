begin;

create or replace function public.submit_leave_request(
  p_employee_id uuid,
  p_leave_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_start_day_part text,
  p_end_day_part text,
  p_reason text,
  p_handover_notes text default null,
  p_emergency boolean default false,
  p_lop_reason_category text default null,
  p_override_reason text default null
)
returns public.leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_employee_id uuid := public.get_my_employee_id();
  v_actor_role text := public.get_my_actual_role();
  v_evaluation jsonb;
  v_duration jsonb;
  v_request public.leave_requests;
  v_day record;
  v_year integer;
  v_manager_user_id uuid;
begin
  if p_employee_id <> v_actor_employee_id and not public.time_off_is_admin() then
    raise exception 'You can request leave only for yourself.';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required.';
  end if;
  for v_year in
    select generate_series(extract(year from p_start_date)::integer, extract(year from p_end_date)::integer)
  loop
    perform pg_advisory_xact_lock(hashtextextended(
      'time-off:' || p_employee_id::text || ':' || v_year::text, 0
    ));
  end loop;
  v_evaluation := public.time_off_evaluate_leave_request(
    p_employee_id, p_leave_type_id, p_start_date, p_end_date,
    p_start_day_part, p_end_day_part, null
  );
  if not (v_evaluation ->> 'valid')::boolean then
    raise exception '%', coalesce(
      (v_evaluation -> 'blocking_errors' ->> 0),
      'This leave request does not satisfy the policy.'
    );
  end if;
  if (v_evaluation ->> 'override_required')::boolean
    and (
      not public.time_off_is_admin()
      or nullif(trim(coalesce(p_override_reason, '')), '') is null
    ) then
    -- The request remains submittable and is explicitly flagged for an
    -- administrative decision rather than silently disappearing.
    p_override_reason := null;
  end if;
  v_duration := v_evaluation -> 'calculated_duration';

  insert into public.leave_requests (
    employee_id, leave_type_id, policy_id, leave_year,
    start_date, end_date, start_day_part, end_day_part,
    requested_days, working_days, calendar_span_days,
    holidays_excluded, weekly_offs_excluded, reason, handover_notes,
    emergency, status, submitted_at,
    administrative_override_required, administrative_override_by,
    administrative_override_reason, lop_reason_category,
    lop_salary_deduction_days, extended_exception_consumed,
    maternity_expected_end_date, policy_snapshot,
    created_by, updated_by
  ) values (
    p_employee_id, p_leave_type_id,
    (v_evaluation ->> 'policy_id')::uuid,
    extract(year from p_start_date)::integer,
    p_start_date, p_end_date, p_start_day_part, p_end_day_part,
    (v_duration ->> 'requested_days')::numeric,
    (v_duration ->> 'working_days')::numeric,
    (v_duration ->> 'calendar_span_days')::integer,
    (v_duration ->> 'holidays_excluded')::numeric,
    (v_duration ->> 'weekly_offs_excluded')::numeric,
    trim(p_reason), nullif(trim(coalesce(p_handover_notes, '')), ''),
    coalesce(p_emergency, false), 'pending', now(),
    (v_evaluation ->> 'override_required')::boolean,
    case when (v_evaluation ->> 'override_required')::boolean
      and public.time_off_is_admin()
      and nullif(trim(coalesce(p_override_reason, '')), '') is not null
      then auth.uid() else null end,
    nullif(trim(coalesce(p_override_reason, '')), ''),
    p_lop_reason_category,
    (v_evaluation ->> 'lop_salary_deduction_days')::numeric,
    (v_evaluation ->> 'extended_exception_consumed')::boolean,
    nullif(v_evaluation ->> 'maternity_expected_end_date', '')::date,
    v_evaluation, auth.uid(), auth.uid()
  ) returning * into v_request;

  for v_day in
    select * from jsonb_to_recordset(v_duration -> 'days') as candidate(
      leave_date date, day_part text, duration numeric,
      is_working_day boolean, is_holiday boolean, is_weekly_off boolean
    )
  loop
    insert into public.leave_request_days (
      leave_request_id, employee_id, leave_date, day_part, duration,
      is_working_day, is_holiday, is_weekly_off, status
    ) values (
      v_request.id, p_employee_id, v_day.leave_date, v_day.day_part,
      v_day.duration, v_day.is_working_day, v_day.is_holiday,
      v_day.is_weekly_off, 'pending'
    );
  end loop;

  if v_request.extended_exception_consumed then
    insert into public.leave_extended_exceptions (
      employee_id, leave_year, leave_request_id, status, updated_at
    ) values (
      p_employee_id, v_request.leave_year, v_request.id, 'reserved', now()
    )
    on conflict (employee_id, leave_year) do update set
      leave_request_id = excluded.leave_request_id,
      status = 'reserved', unavailable_reason = null, updated_at = now();
  end if;

  for v_year in
    select generate_series(
      extract(year from p_start_date)::integer,
      extract(year from p_end_date)::integer
    )
  loop
    perform public.time_off_refresh_balances(p_employee_id, v_year);
  end loop;

  insert into public.leave_request_actions (
    leave_request_id, employee_id, actor_user_id, actor_employee_id,
    actor_role, action, previous_status, new_status, metadata
  ) values (
    v_request.id, p_employee_id, auth.uid(), v_actor_employee_id,
    v_actor_role, 'submitted', null, 'pending', v_evaluation
  );
  insert into public.time_off_audit_log (
    actor_user_id, actor_employee_id, actor_role, action, entity_type,
    entity_id, employee_id, new_values
  ) values (
    auth.uid(), v_actor_employee_id, v_actor_role, 'submitted',
    'leave_request', v_request.id, p_employee_id, to_jsonb(v_request)
  );

  select profile.user_id into v_manager_user_id
  from public.employees employee
  join public.profiles profile on profile.employee_id = employee.reporting_manager_id
  where employee.id = p_employee_id;
  if v_manager_user_id is not null then
    insert into public.leave_notifications (
      leave_request_id, recipient_user_id, notification_type,
      subject, body, deduplication_key
    ) values (
      v_request.id, v_manager_user_id, 'request_submitted',
      'Leave request requires your review',
      'A direct report submitted a leave request.',
      v_request.id::text || ':request_submitted:' || v_manager_user_id::text
    ) on conflict (deduplication_key) do nothing;
  end if;
  if v_request.administrative_override_required then
    insert into public.leave_notifications (
      leave_request_id, recipient_user_id, notification_type,
      subject, body, deduplication_key
    )
    select v_request.id, profile.user_id, 'override_required',
      'Administrative leave override required',
      'A Loss of Pay request exceeds the annual reference and requires an administrative decision.',
      v_request.id::text || ':override_required:' || profile.user_id::text
    from public.profiles profile
    where lower(trim(coalesce(profile.role, ''))) in (
      'admin', 'super admin', 'finance admin'
    )
    on conflict (deduplication_key) do nothing;
  end if;
  return v_request;
exception
  when unique_violation then
    raise exception 'The selected leave period overlaps an active request.';
end;
$$;

create or replace function public.process_leave_request(
  p_request_id uuid,
  p_action text,
  p_comment text default null,
  p_override_reason text default null
)
returns public.leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.leave_requests;
  v_previous text;
  v_actor_employee_id uuid := public.get_my_employee_id();
  v_actor_role text := public.get_my_actual_role();
  v_employee_user_id uuid;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_year integer;
  v_evaluation jsonb;
begin
  select * into v_request from public.leave_requests
  where id = p_request_id for update;
  if not found then raise exception 'Leave request not found.'; end if;
  if v_request.employee_id = v_actor_employee_id then
    raise exception 'You cannot approve or reject your own leave request.';
  end if;
  if not public.time_off_can_manage_employee(v_request.employee_id) then
    raise exception 'You are not authorised to process this leave request.';
  end if;
  v_previous := v_request.status;
  for v_year in
    select generate_series(extract(year from v_request.start_date)::integer, extract(year from v_request.end_date)::integer)
  loop
    perform pg_advisory_xact_lock(hashtextextended(
      'time-off:' || v_request.employee_id::text || ':' || v_year::text, 0
    ));
  end loop;

  if v_action = 'approve' then
    if v_request.status <> 'pending' then
      raise exception 'Only a pending request can be approved.';
    end if;
    if v_request.administrative_override_required then
      if not public.time_off_is_admin() then
        raise exception 'This request requires an administrative override.';
      end if;
      if nullif(trim(coalesce(p_override_reason, '')), '') is null
        and v_request.administrative_override_by is null then
        raise exception 'An administrative override reason is required.';
      end if;
    end if;
    v_evaluation := public.time_off_evaluate_leave_request(
      v_request.employee_id, v_request.leave_type_id,
      v_request.start_date, v_request.end_date,
      v_request.start_day_part, v_request.end_day_part, v_request.id
    );
    if not (v_evaluation ->> 'valid')::boolean then
      raise exception '%', coalesce(
        (v_evaluation -> 'blocking_errors' ->> 0),
        'This request no longer satisfies the leave policy.'
      );
    end if;
    update public.leave_requests set
      status = 'approved', approved_at = now(), approved_by = auth.uid(),
      manager_comment = nullif(trim(coalesce(p_comment, '')), ''),
      administrative_override_by = case
        when administrative_override_required then auth.uid()
        else administrative_override_by end,
      administrative_override_reason = case
        when administrative_override_required then coalesce(
          nullif(trim(coalesce(p_override_reason, '')), ''),
          administrative_override_reason
        ) else administrative_override_reason end,
      policy_id = (v_evaluation ->> 'policy_id')::uuid,
      policy_snapshot = v_evaluation,
      updated_at = now(), updated_by = auth.uid()
    where id = p_request_id returning * into v_request;
    update public.leave_request_days set status = 'approved'
    where leave_request_id = p_request_id;
    update public.leave_extended_exceptions
    set status = 'used', updated_at = now()
    where leave_request_id = p_request_id and status = 'reserved';
  elsif v_action = 'reject' then
    if v_request.status <> 'pending' then
      raise exception 'Only a pending request can be rejected.';
    end if;
    if nullif(trim(coalesce(p_comment, '')), '') is null then
      raise exception 'A rejection comment is required.';
    end if;
    update public.leave_requests set
      status = 'rejected', rejected_at = now(), rejected_by = auth.uid(),
      manager_comment = trim(p_comment), updated_at = now(), updated_by = auth.uid()
    where id = p_request_id returning * into v_request;
    update public.leave_request_days set status = 'rejected'
    where leave_request_id = p_request_id;
    update public.leave_extended_exceptions
    set status = 'available', leave_request_id = null, updated_at = now()
    where leave_request_id = p_request_id and status = 'reserved';
  elsif v_action = 'approve_cancellation' then
    if v_request.status <> 'cancellation_requested' then
      raise exception 'This request is not awaiting cancellation approval.';
    end if;
    update public.leave_requests set
      status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
      manager_comment = nullif(trim(coalesce(p_comment, '')), ''),
      updated_at = now(), updated_by = auth.uid()
    where id = p_request_id returning * into v_request;
    update public.leave_request_days set status = 'cancelled'
    where leave_request_id = p_request_id;
    update public.leave_extended_exceptions
    set status = 'available', leave_request_id = null, updated_at = now()
    where leave_request_id = p_request_id;
  elsif v_action = 'reject_cancellation' then
    if v_request.status <> 'cancellation_requested' then
      raise exception 'This request is not awaiting cancellation approval.';
    end if;
    if nullif(trim(coalesce(p_comment, '')), '') is null then
      raise exception 'A cancellation rejection comment is required.';
    end if;
    update public.leave_requests set
      status = 'cancellation_rejected', manager_comment = trim(p_comment),
      updated_at = now(), updated_by = auth.uid()
    where id = p_request_id returning * into v_request;
    -- The cancellation was rejected, so the approved leave remains in force.
    -- Preserve approved day slots for overlap, timer, and capacity calculations.
    update public.leave_request_days set status = 'approved'
    where leave_request_id = p_request_id;
  elsif v_action = 'admin_cancel' then
    if not public.time_off_is_admin() then
      raise exception 'Only an administrator can correct approved leave.';
    end if;
    if v_request.status not in ('pending', 'approved', 'cancellation_requested', 'cancellation_rejected') then
      raise exception 'This request cannot be administratively cancelled.';
    end if;
    if nullif(trim(coalesce(p_comment, '')), '') is null then
      raise exception 'A correction reason is required.';
    end if;
    update public.leave_requests set
      status = 'cancelled_by_admin', cancelled_at = now(), cancelled_by = auth.uid(),
      manager_comment = trim(p_comment), updated_at = now(), updated_by = auth.uid()
    where id = p_request_id returning * into v_request;
    update public.leave_request_days set status = 'cancelled_by_admin'
    where leave_request_id = p_request_id;
    update public.leave_extended_exceptions
    set status = 'available', leave_request_id = null, updated_at = now()
    where leave_request_id = p_request_id;
  else
    raise exception 'Unsupported leave decision.';
  end if;

  for v_year in
    select distinct extract(year from leave_date)::integer
    from public.leave_request_days where leave_request_id = p_request_id
  loop
    perform public.time_off_refresh_balances(v_request.employee_id, v_year);
  end loop;
  insert into public.leave_request_actions (
    leave_request_id, employee_id, actor_user_id, actor_employee_id,
    actor_role, action, previous_status, new_status, comment,
    metadata
  ) values (
    v_request.id, v_request.employee_id, auth.uid(), v_actor_employee_id,
    v_actor_role, v_action, v_previous, v_request.status,
    nullif(trim(coalesce(p_comment, '')), ''),
    jsonb_build_object('override_reason', p_override_reason)
  );
  insert into public.time_off_audit_log (
    actor_user_id, actor_employee_id, actor_role, action, entity_type,
    entity_id, employee_id, previous_values, new_values, reason
  ) values (
    auth.uid(), v_actor_employee_id, v_actor_role, v_action,
    'leave_request', v_request.id, v_request.employee_id,
    jsonb_build_object('status', v_previous), to_jsonb(v_request),
    coalesce(nullif(trim(coalesce(p_comment, '')), ''), p_override_reason)
  );
  select user_id into v_employee_user_id from public.profiles
  where employee_id = v_request.employee_id limit 1;
  if v_employee_user_id is not null then
    insert into public.leave_notifications (
      leave_request_id, recipient_user_id, notification_type,
      subject, body, deduplication_key
    ) values (
      v_request.id, v_employee_user_id, v_action,
      'Your leave request was updated',
      format('Your leave request status is now %s.', replace(v_request.status, '_', ' ')),
      v_request.id::text || ':' || v_action || ':' || v_employee_user_id::text
    ) on conflict (deduplication_key) do nothing;
  end if;
  return v_request;
end;
$$;

create or replace function public.cancel_own_leave_request(
  p_request_id uuid,
  p_comment text default null
)
returns public.leave_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.leave_requests;
  v_previous text;
  v_manager_user_id uuid;
  v_year integer;
begin
  select * into v_request from public.leave_requests
  where id = p_request_id and employee_id = public.get_my_employee_id()
  for update;
  if not found then raise exception 'Leave request not found.'; end if;
  v_previous := v_request.status;
  if v_request.status = 'pending' then
    update public.leave_requests set
      status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
      updated_at = now(), updated_by = auth.uid()
    where id = p_request_id returning * into v_request;
    update public.leave_request_days set status = 'cancelled'
    where leave_request_id = p_request_id;
    update public.leave_extended_exceptions
    set status = 'available', leave_request_id = null, updated_at = now()
    where leave_request_id = p_request_id;
  elsif v_request.status in ('approved', 'cancellation_rejected') then
    update public.leave_requests set
      status = 'cancellation_requested', updated_at = now(), updated_by = auth.uid()
    where id = p_request_id returning * into v_request;
    update public.leave_request_days set status = 'cancellation_requested'
    where leave_request_id = p_request_id;
  else
    raise exception 'This request cannot be cancelled in its current status.';
  end if;
  for v_year in
    select distinct extract(year from leave_date)::integer
    from public.leave_request_days where leave_request_id = p_request_id
  loop
    perform public.time_off_refresh_balances(v_request.employee_id, v_year);
  end loop;
  insert into public.leave_request_actions (
    leave_request_id, employee_id, actor_user_id, actor_employee_id,
    actor_role, action, previous_status, new_status, comment
  ) values (
    v_request.id, v_request.employee_id, auth.uid(), public.get_my_employee_id(),
    public.get_my_actual_role(),
    case when v_request.status = 'cancelled' then 'cancelled' else 'cancellation_requested' end,
    v_previous, v_request.status, nullif(trim(coalesce(p_comment, '')), '')
  );
  insert into public.time_off_audit_log (
    actor_user_id, actor_employee_id, actor_role, action, entity_type,
    entity_id, employee_id, previous_values, new_values, reason
  ) values (
    auth.uid(), public.get_my_employee_id(), public.get_my_actual_role(),
    case when v_request.status = 'cancelled' then 'cancelled' else 'cancellation_requested' end,
    'leave_request', v_request.id, v_request.employee_id,
    jsonb_build_object('status', v_previous), to_jsonb(v_request), p_comment
  );
  select profile.user_id into v_manager_user_id
  from public.employees employee
  join public.profiles profile on profile.employee_id = employee.reporting_manager_id
  where employee.id = v_request.employee_id;
  if v_manager_user_id is not null then
    insert into public.leave_notifications (
      leave_request_id, recipient_user_id, notification_type,
      subject, body, deduplication_key
    ) values (
      v_request.id, v_manager_user_id,
      case when v_request.status = 'cancelled' then 'pending_cancelled' else 'cancellation_requested' end,
      'Leave request cancellation update',
      case when v_request.status = 'cancelled'
        then 'A direct report cancelled a pending leave request.'
        else 'A direct report requested cancellation of approved leave.' end,
      v_request.id::text || ':' || v_request.status || ':' || v_manager_user_id::text
    ) on conflict (deduplication_key) do nothing;
  end if;
  return v_request;
end;
$$;

create or replace function public.adjust_employee_leave_balance(
  p_employee_id uuid,
  p_leave_type_id uuid,
  p_leave_year integer,
  p_adjustment_days numeric,
  p_effective_date date,
  p_reason text,
  p_reference text default null
)
returns public.leave_balance_adjustments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous numeric;
  v_new numeric;
  v_adjustment public.leave_balance_adjustments;
begin
  if not public.time_off_is_admin() then
    raise exception 'Only an administrator can adjust leave balances.';
  end if;
  if p_adjustment_days = 0 then raise exception 'Adjustment cannot be zero.'; end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'An adjustment reason is required.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'time-off:' || p_employee_id::text || ':' || p_leave_year::text, 0
  ));
  perform public.time_off_refresh_balances(p_employee_id, p_leave_year);
  select available_days into v_previous
  from public.employee_leave_balances
  where employee_id = p_employee_id and leave_type_id = p_leave_type_id
    and leave_year = p_leave_year for update;
  v_new := coalesce(v_previous, 0) + p_adjustment_days;
  insert into public.leave_balance_adjustments (
    employee_id, leave_type_id, leave_year, adjustment_days,
    effective_date, reason, reference, previous_balance, new_balance, created_by
  ) values (
    p_employee_id, p_leave_type_id, p_leave_year, p_adjustment_days,
    p_effective_date, trim(p_reason), nullif(trim(coalesce(p_reference, '')), ''),
    coalesce(v_previous, 0), v_new, auth.uid()
  ) returning * into v_adjustment;
  perform public.time_off_refresh_balances(p_employee_id, p_leave_year);
  insert into public.time_off_audit_log (
    actor_user_id, actor_employee_id, actor_role, action, entity_type,
    entity_id, employee_id, previous_values, new_values, reason
  ) values (
    auth.uid(), public.get_my_employee_id(), public.get_my_actual_role(),
    'balance_adjusted', 'leave_balance_adjustment', v_adjustment.id,
    p_employee_id, jsonb_build_object('balance', v_previous),
    to_jsonb(v_adjustment), trim(p_reason)
  );
  return v_adjustment;
end;
$$;

create or replace function public.close_employee_leave_year(
  p_employee_id uuid,
  p_leave_year integer
)
returns public.leave_year_closures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_joining date;
  v_entitlement numeric;
  v_paid_used numeric;
  v_paid_pending numeric;
  v_adjustments numeric;
  v_lop numeric;
  v_lop_salary numeric;
  v_remaining numeric;
  v_encashable numeric;
  v_closure public.leave_year_closures;
  v_policy_id uuid;
  v_lop_multiplier numeric := 1.5;
begin
  if not public.time_off_is_admin() then
    raise exception 'Only an administrator can close a leave year.';
  end if;
  if (now() at time zone 'Asia/Kolkata')::date <= make_date(p_leave_year, 12, 31) then
    raise exception 'A leave year can be closed only after it ends.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'leave-close:' || p_employee_id::text || ':' || p_leave_year::text, 0
  ));
  if exists (
    select 1 from public.leave_year_closures
    where employee_id = p_employee_id and leave_year = p_leave_year
      and status = 'closed'
  ) then raise exception 'This employee leave year is already closed.'; end if;
  if exists (
    select 1 from public.leave_requests
    where employee_id = p_employee_id
      and start_date <= make_date(p_leave_year, 12, 31)
      and end_date >= make_date(p_leave_year, 1, 1)
      and status in ('pending', 'cancellation_requested')
  ) then raise exception 'Resolve pending leave requests before closing the year.'; end if;
  select date_of_joining into v_joining from public.employees where id = p_employee_id;
  select id into v_policy_id from public.leave_policies
  where is_active and effective_start_date <= make_date(p_leave_year, 12, 31)
    and (effective_end_date is null or effective_end_date >= make_date(p_leave_year, 12, 31))
  order by effective_start_date desc, version desc limit 1;
  select coalesce(max((rule_value #>> '{}')::numeric), 1.5)
  into v_lop_multiplier from public.leave_policy_rules
  where policy_id = v_policy_id and rule_key = 'lop_salary_multiplier';
  v_entitlement := public.time_off_paid_entitlement(
    v_joining, make_date(p_leave_year, 12, 31)
  );
  select
    coalesce(sum(case when leave_type.code in ('PL', 'UL') and request.status in ('approved', 'cancellation_rejected') then day.duration else 0 end), 0),
    coalesce(sum(case when leave_type.code in ('PL', 'UL') and request.status in ('pending', 'cancellation_requested') then day.duration else 0 end), 0),
    coalesce(sum(case when leave_type.code = 'LOP' and request.status in ('approved', 'cancellation_rejected') then day.duration else 0 end), 0)
  into v_paid_used, v_paid_pending, v_lop
  from public.leave_request_days day
  join public.leave_requests request on request.id = day.leave_request_id
  join public.leave_types leave_type on leave_type.id = request.leave_type_id
  where request.employee_id = p_employee_id and day.is_working_day
    and extract(year from day.leave_date)::integer = p_leave_year;
  select coalesce(sum(adjustment.adjustment_days), 0) into v_adjustments
  from public.leave_balance_adjustments adjustment
  join public.leave_types leave_type on leave_type.id = adjustment.leave_type_id
  where adjustment.employee_id = p_employee_id
    and adjustment.leave_year = p_leave_year
    and leave_type.code in ('PL', 'UL');
  v_lop_salary := v_lop * v_lop_multiplier;
  v_remaining := greatest(v_entitlement + v_adjustments - v_paid_used, 0);
  v_encashable := greatest(v_remaining - v_lop, 0);
  insert into public.leave_year_closures (
    employee_id, leave_year, entitlement_days, used_paid_leave_days,
    pending_paid_leave_days, remaining_paid_leave_days, lop_leave_days,
    lop_salary_deduction_days, encashable_leave_days, carry_forward_days,
    expired_days, calculation_details, processed_by
  ) values (
    p_employee_id, p_leave_year, v_entitlement + v_adjustments, v_paid_used,
    v_paid_pending, v_remaining, v_lop, v_lop_salary, v_encashable, 0,
    greatest(v_remaining - v_encashable, 0),
    jsonb_build_object(
      'base_entitlement', v_entitlement, 'adjustments', v_adjustments,
      'encashment_formula', 'max(remaining paid leave - actual LOP days, 0)'
    ), auth.uid()
  )
  on conflict (employee_id, leave_year) do update set
    entitlement_days = excluded.entitlement_days,
    used_paid_leave_days = excluded.used_paid_leave_days,
    pending_paid_leave_days = excluded.pending_paid_leave_days,
    remaining_paid_leave_days = excluded.remaining_paid_leave_days,
    lop_leave_days = excluded.lop_leave_days,
    lop_salary_deduction_days = excluded.lop_salary_deduction_days,
    encashable_leave_days = excluded.encashable_leave_days,
    carry_forward_days = excluded.carry_forward_days,
    expired_days = excluded.expired_days,
    status = 'closed', calculation_details = excluded.calculation_details,
    processed_at = now(), processed_by = auth.uid(),
    reversal_reason = null, reversed_at = null, reversed_by = null
  returning * into v_closure;
  insert into public.leave_encashments (
    leave_year_closure_id, employee_id, leave_year, encashable_leave_days
  ) values (v_closure.id, p_employee_id, p_leave_year, v_encashable)
  on conflict (leave_year_closure_id) do update set
    encashable_leave_days = excluded.encashable_leave_days,
    status = 'pending', payroll_reference = null,
    processed_at = null, processed_by = null;
  insert into public.time_off_audit_log (
    actor_user_id, actor_employee_id, actor_role, action, entity_type,
    entity_id, employee_id, new_values
  ) values (
    auth.uid(), public.get_my_employee_id(), public.get_my_actual_role(),
    'year_closed', 'leave_year_closure', v_closure.id,
    p_employee_id, to_jsonb(v_closure)
  );
  return v_closure;
end;
$$;

revoke all on function public.submit_leave_request(uuid, uuid, date, date, text, text, text, text, boolean, text, text) from public, anon;
revoke all on function public.process_leave_request(uuid, text, text, text) from public, anon;
revoke all on function public.cancel_own_leave_request(uuid, text) from public, anon;
revoke all on function public.adjust_employee_leave_balance(uuid, uuid, integer, numeric, date, text, text) from public, anon;
revoke all on function public.close_employee_leave_year(uuid, integer) from public, anon;
grant execute on function public.submit_leave_request(uuid, uuid, date, date, text, text, text, text, boolean, text, text) to authenticated;
grant execute on function public.process_leave_request(uuid, text, text, text) to authenticated;
grant execute on function public.cancel_own_leave_request(uuid, text) to authenticated;
grant execute on function public.adjust_employee_leave_balance(uuid, uuid, integer, numeric, date, text, text) to authenticated;
grant execute on function public.close_employee_leave_year(uuid, integer) to authenticated;

notify pgrst, 'reload schema';

commit;
