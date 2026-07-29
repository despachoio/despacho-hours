begin;

create or replace function public.normalize_leave_request_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(coalesce(new.comment, '')), '') is null then
    raise exception 'A comment is required.';
  end if;
  if new.employee_id <> public.get_my_employee_id()
    and not public.time_off_can_manage_employee(new.employee_id) then
    raise exception 'You are not authorised to comment on this request.';
  end if;
  if not exists (
    select 1 from public.leave_requests request
    where request.id = new.leave_request_id and request.employee_id = new.employee_id
  ) then raise exception 'Leave request does not match the employee.'; end if;
  new.author_user_id := auth.uid();
  new.author_role := public.get_my_actual_role();
  new.comment := trim(new.comment);
  return new;
end;
$$;

drop trigger if exists normalize_leave_request_comment on public.leave_request_comments;
create trigger normalize_leave_request_comment
before insert on public.leave_request_comments
for each row execute function public.normalize_leave_request_comment();

create or replace function public.get_time_off_year_end_preview(
  p_employee_id uuid,
  p_leave_year integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dashboard jsonb;
  v_closure public.leave_year_closures%rowtype;
begin
  if not public.time_off_is_admin() then
    raise exception 'Only an administrator can review year-end processing.';
  end if;
  v_dashboard := public.get_time_off_dashboard(p_employee_id, p_leave_year);
  select * into v_closure from public.leave_year_closures
  where employee_id = p_employee_id and leave_year = p_leave_year;
  return v_dashboard || jsonb_build_object(
    'remaining_paid_leave_days', greatest(
      (v_dashboard ->> 'entitlement_days')::numeric
      - (v_dashboard ->> 'used_paid_days')::numeric, 0
    ),
    'carry_forward_days', 0,
    'expired_days', 0,
    'processing_status', coalesce(v_closure.status, 'not_processed'),
    'closure_id', v_closure.id
  );
end;
$$;

create or replace function public.process_leave_encashment(
  p_encashment_id uuid,
  p_payroll_reference text
)
returns public.leave_encashments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_encashment public.leave_encashments;
begin
  if not public.time_off_is_admin() then
    raise exception 'Only an administrator can process leave encashment.';
  end if;
  if nullif(trim(coalesce(p_payroll_reference, '')), '') is null then
    raise exception 'A payroll reference is required.';
  end if;
  select * into v_encashment from public.leave_encashments
  where id = p_encashment_id for update;
  if not found then raise exception 'Encashment record not found.'; end if;
  if v_encashment.status <> 'pending' then
    raise exception 'This encashment has already been processed or reversed.';
  end if;
  update public.leave_encashments set
    status = 'processed', payroll_reference = trim(p_payroll_reference),
    processed_at = now(), processed_by = auth.uid()
  where id = p_encashment_id returning * into v_encashment;
  insert into public.time_off_audit_log (
    actor_user_id, actor_employee_id, actor_role, action, entity_type,
    entity_id, employee_id, new_values, reason
  ) values (
    auth.uid(), public.get_my_employee_id(), public.get_my_actual_role(),
    'encashment_processed', 'leave_encashment', v_encashment.id,
    v_encashment.employee_id, to_jsonb(v_encashment), trim(p_payroll_reference)
  );
  return v_encashment;
end;
$$;

create or replace function public.reverse_leave_year_closure(
  p_closure_id uuid,
  p_reason text
)
returns public.leave_year_closures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closure public.leave_year_closures;
begin
  if not public.time_off_is_admin() then
    raise exception 'Only an administrator can reverse a year closure.';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reversal reason is required.';
  end if;
  select * into v_closure from public.leave_year_closures
  where id = p_closure_id for update;
  if not found then raise exception 'Year closure not found.'; end if;
  if v_closure.status <> 'closed' then raise exception 'This closure is not active.'; end if;
  update public.leave_year_closures set
    status = 'reversed', reversal_reason = trim(p_reason),
    reversed_at = now(), reversed_by = auth.uid()
  where id = p_closure_id returning * into v_closure;
  update public.leave_encashments set status = 'reversed'
  where leave_year_closure_id = p_closure_id;
  insert into public.time_off_audit_log (
    actor_user_id, actor_employee_id, actor_role, action, entity_type,
    entity_id, employee_id, new_values, reason
  ) values (
    auth.uid(), public.get_my_employee_id(), public.get_my_actual_role(),
    'year_closure_reversed', 'leave_year_closure', v_closure.id,
    v_closure.employee_id, to_jsonb(v_closure), trim(p_reason)
  );
  return v_closure;
end;
$$;

create or replace function public.duplicate_holiday_calendar(
  p_source_calendar_id uuid,
  p_target_year integer,
  p_target_name text
)
returns public.holiday_calendars
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.holiday_calendars;
  v_target public.holiday_calendars;
begin
  if not public.time_off_is_admin() then
    raise exception 'Only an administrator can duplicate holiday calendars.';
  end if;
  select * into v_source from public.holiday_calendars where id = p_source_calendar_id;
  if not found then raise exception 'Source holiday calendar not found.'; end if;
  insert into public.holiday_calendars (
    name, calendar_year, audience, country, location, department,
    is_active, notes, created_by, updated_by
  ) values (
    coalesce(nullif(trim(p_target_name), ''), v_source.name || ' ' || p_target_year),
    p_target_year, v_source.audience, v_source.country, v_source.location,
    v_source.department, true, v_source.notes, auth.uid(), auth.uid()
  ) returning * into v_target;
  insert into public.holidays (
    holiday_calendar_id, holiday_date, name, day_part,
    is_recurring_annual, is_active, notes, created_by, updated_by
  )
  select v_target.id,
    make_date(p_target_year, extract(month from holiday.holiday_date)::integer,
      least(extract(day from holiday.holiday_date)::integer,
        extract(day from (make_date(p_target_year, extract(month from holiday.holiday_date)::integer, 1)
          + interval '1 month' - interval '1 day'))::integer)),
    holiday.name, holiday.day_part, holiday.is_recurring_annual,
    holiday.is_active, holiday.notes, auth.uid(), auth.uid()
  from public.holidays holiday
  where holiday.holiday_calendar_id = p_source_calendar_id;
  return v_target;
end;
$$;

revoke all on function public.normalize_leave_request_comment() from public, anon;
revoke all on function public.get_time_off_year_end_preview(uuid, integer) from public, anon;
revoke all on function public.process_leave_encashment(uuid, text) from public, anon;
revoke all on function public.reverse_leave_year_closure(uuid, text) from public, anon;
revoke all on function public.duplicate_holiday_calendar(uuid, integer, text) from public, anon;
grant execute on function public.get_time_off_year_end_preview(uuid, integer) to authenticated;
grant execute on function public.process_leave_encashment(uuid, text) to authenticated;
grant execute on function public.reverse_leave_year_closure(uuid, text) to authenticated;
grant execute on function public.duplicate_holiday_calendar(uuid, integer, text) to authenticated;

notify pgrst, 'reload schema';

commit;
