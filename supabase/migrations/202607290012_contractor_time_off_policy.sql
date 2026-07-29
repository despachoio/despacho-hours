begin;

insert into public.leave_policy_rules (policy_id, rule_key, rule_value, description)
select policy.id, rule.rule_key, rule.rule_value, rule.description
from public.leave_policies policy
cross join (values
  ('contractor_paid_leave_wait_months', '6'::jsonb, 'Completed service months required before a contractor receives paid leave'),
  ('contractor_waiting_lop_salary_multiplier', '1'::jsonb, 'Salary deduction days per LOP day for a contractor before six completed months')
) as rule(rule_key, rule_value, description)
where policy.is_active
on conflict (policy_id, rule_key) do update set
  rule_value = excluded.rule_value,
  description = excluded.description;

create or replace function public.time_off_is_contractor(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(lower(trim(employee.role)) = 'contractor', false)
  from public.employees employee
  where employee.id = p_employee_id
$$;

create or replace function public.time_off_employee_paid_entitlement(
  p_employee_id uuid,
  p_as_of date
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_employee public.employees%rowtype;
  v_completed integer;
  v_before_year integer;
  v_wait_months integer := 6;
  v_monthly_rate numeric := 1;
  v_annual_entitlement numeric := 12;
  v_policy_id uuid;
begin
  select * into v_employee from public.employees where id = p_employee_id;
  if not found or v_employee.date_of_joining is null or p_as_of < v_employee.date_of_joining then
    return 0;
  end if;
  if not public.time_off_is_contractor(p_employee_id) then
    return public.time_off_paid_entitlement(v_employee.date_of_joining, p_as_of);
  end if;

  select id into v_policy_id from public.leave_policies
  where is_active and effective_start_date <= p_as_of
    and (effective_end_date is null or effective_end_date >= p_as_of)
  order by effective_start_date desc, version desc limit 1;
  select
    coalesce(max((rule_value #>> '{}')::integer) filter (where rule_key = 'contractor_paid_leave_wait_months'), 6),
    coalesce(max((rule_value #>> '{}')::numeric) filter (where rule_key = 'first_year_monthly_accrual'), 1),
    coalesce(max((rule_value #>> '{}')::numeric) filter (where rule_key = 'annual_paid_entitlement'), 12)
  into v_wait_months, v_monthly_rate, v_annual_entitlement
  from public.leave_policy_rules where policy_id = v_policy_id;

  v_completed := public.time_off_completed_months(v_employee.date_of_joining, p_as_of);
  if v_completed < v_wait_months then return 0; end if;
  if v_completed >= 12 then return v_annual_entitlement; end if;
  v_before_year := public.time_off_completed_months(
    v_employee.date_of_joining,
    make_date(extract(year from p_as_of)::integer, 1, 1) - 1
  );
  return least(
    greatest(v_completed - greatest(v_before_year, v_wait_months - 1), 0) * v_monthly_rate,
    v_annual_entitlement
  );
end;
$$;

create or replace function public.time_off_employee_lop_multiplier(
  p_employee_id uuid,
  p_as_of date
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_employee public.employees%rowtype;
  v_policy_id uuid;
  v_wait_months integer := 6;
  v_wait_multiplier numeric := 1;
  v_standard_multiplier numeric := 1.5;
begin
  select * into v_employee from public.employees where id = p_employee_id;
  if not found then return v_standard_multiplier; end if;
  select id into v_policy_id from public.leave_policies
  where is_active and effective_start_date <= p_as_of
    and (effective_end_date is null or effective_end_date >= p_as_of)
  order by effective_start_date desc, version desc limit 1;
  select
    coalesce(max((rule_value #>> '{}')::integer) filter (where rule_key = 'contractor_paid_leave_wait_months'), 6),
    coalesce(max((rule_value #>> '{}')::numeric) filter (where rule_key = 'contractor_waiting_lop_salary_multiplier'), 1),
    coalesce(max((rule_value #>> '{}')::numeric) filter (where rule_key = 'lop_salary_multiplier'), 1.5)
  into v_wait_months, v_wait_multiplier, v_standard_multiplier
  from public.leave_policy_rules where policy_id = v_policy_id;
  if public.time_off_is_contractor(p_employee_id)
    and public.time_off_completed_months(v_employee.date_of_joining, p_as_of) < v_wait_months then
    return v_wait_multiplier;
  end if;
  return v_standard_multiplier;
end;
$$;

alter function public.time_off_evaluate_leave_request(uuid, uuid, date, date, text, text, uuid)
  rename to time_off_evaluate_leave_request_pre_contractor;

create or replace function public.time_off_evaluate_leave_request(
  p_employee_id uuid,
  p_leave_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_start_day_part text default 'full_day',
  p_end_day_part text default 'full_day',
  p_existing_request_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_employee public.employees%rowtype;
  v_type public.leave_types%rowtype;
  v_duration jsonb;
  v_errors jsonb;
  v_warnings jsonb;
  v_info jsonb;
  v_completed integer;
  v_wait_months integer := 6;
  v_stage text;
  v_multiplier numeric;
  v_reference numeric;
  v_year integer;
  v_candidate numeric;
  v_entitlement numeric;
  v_approved numeric;
  v_pending numeric;
  v_adjustments numeric;
  v_available numeric;
  v_total_entitlement numeric := 0;
  v_total_available numeric := 0;
  v_total_projected numeric := 0;
begin
  v_result := public.time_off_evaluate_leave_request_pre_contractor(
    p_employee_id, p_leave_type_id, p_start_date, p_end_date,
    p_start_day_part, p_end_day_part, p_existing_request_id
  );
  select * into v_employee from public.employees where id = p_employee_id;
  select * into v_type from public.leave_types where id = p_leave_type_id;
  if not public.time_off_is_contractor(p_employee_id) then return v_result; end if;

  select coalesce(max((rule_value #>> '{}')::integer), 6)
  into v_wait_months
  from public.leave_policy_rules
  where policy_id = (v_result ->> 'policy_id')::uuid
    and rule_key = 'contractor_paid_leave_wait_months';
  v_completed := public.time_off_completed_months(v_employee.date_of_joining, p_start_date);
  v_stage := case when v_completed < v_wait_months then 'waiting_period'
    when v_completed < 12 then 'first_year' else 'standard' end;
  v_multiplier := public.time_off_employee_lop_multiplier(p_employee_id, p_start_date);
  v_reference := case when v_stage = 'waiting_period' then null else 3 end;
  v_duration := v_result -> 'calculated_duration';
  v_errors := coalesce(v_result -> 'blocking_errors', '[]'::jsonb);
  v_warnings := coalesce(v_result -> 'warnings', '[]'::jsonb);
  v_info := coalesce(v_result -> 'informational_messages', '[]'::jsonb);

  if v_stage = 'waiting_period' and v_type.code in ('PL', 'UL') then
    v_errors := v_errors || jsonb_build_array(
      'Contractors become eligible for Planned and Unplanned Leave after six completed months of service.'
    );
  end if;
  if v_stage = 'waiting_period' and v_type.code = 'LOP' then
    select coalesce(jsonb_agg(item), '[]'::jsonb) into v_errors
    from jsonb_array_elements(v_errors) as error_item(item)
    where item #>> '{}' not ilike '%permits at most%working days per request%';
    select coalesce(jsonb_agg(item), '[]'::jsonb) into v_warnings
    from jsonb_array_elements(v_warnings) as warning_item(item)
    where item #>> '{}' not ilike '%three-day LOP reference%';
    v_info := v_info || jsonb_build_array(
      'During the first six completed months, contractor LOP is unlimited and each LOP day deducts one salary day.'
    );
  elsif v_stage = 'first_year' then
    v_info := v_info || jsonb_build_array(
      'Contractor first-year policy applies: monthly paid-leave accrual, a three-day annual LOP reference, and 1.5 salary days deducted per LOP day.'
    );
  end if;

  for v_year in
    select distinct extract(year from candidate.leave_date)::integer
    from jsonb_to_recordset(v_duration -> 'days') as candidate(
      leave_date date, day_part text, duration numeric,
      is_working_day boolean, is_holiday boolean, is_weekly_off boolean
    ) where candidate.is_working_day
  loop
    select coalesce(sum(candidate.duration), 0) into v_candidate
    from jsonb_to_recordset(v_duration -> 'days') as candidate(
      leave_date date, day_part text, duration numeric,
      is_working_day boolean, is_holiday boolean, is_weekly_off boolean
    ) where candidate.is_working_day
      and extract(year from candidate.leave_date)::integer = v_year;
    v_entitlement := public.time_off_employee_paid_entitlement(
      p_employee_id, least(p_end_date, make_date(v_year, 12, 31))
    );
    select
      coalesce(sum(case when request.status in ('approved', 'cancellation_rejected') then day.duration else 0 end), 0),
      coalesce(sum(case when request.status in ('pending', 'cancellation_requested') then day.duration else 0 end), 0)
    into v_approved, v_pending
    from public.leave_request_days day
    join public.leave_requests request on request.id = day.leave_request_id
    join public.leave_types leave_type on leave_type.id = request.leave_type_id
    where request.employee_id = p_employee_id
      and extract(year from day.leave_date)::integer = v_year
      and leave_type.code in ('PL', 'UL') and day.is_working_day
      and (p_existing_request_id is null or request.id <> p_existing_request_id);
    select coalesce(sum(adjustment.adjustment_days), 0) into v_adjustments
    from public.leave_balance_adjustments adjustment
    join public.leave_types leave_type on leave_type.id = adjustment.leave_type_id
    where adjustment.employee_id = p_employee_id
      and adjustment.leave_year = v_year and leave_type.code in ('PL', 'UL');
    v_available := v_entitlement + v_adjustments - v_approved - v_pending;
    if v_stage <> 'waiting_period' and v_type.code in ('PL', 'UL')
      and v_available - v_candidate < 0 and not v_type.negative_balance_allowed
      and not exists (
        select 1
        from jsonb_array_elements_text(v_errors) as error_message(message)
        where message ilike '%paid leave balance%insufficient%'
      ) then
      v_errors := v_errors || jsonb_build_array(
        format('Your contractor paid leave balance for %s is insufficient.', v_year)
      );
    end if;
    v_total_entitlement := v_total_entitlement + v_entitlement;
    v_total_available := v_total_available + v_available;
    v_total_projected := v_total_projected + v_available
      - case when v_type.code in ('PL', 'UL') then v_candidate else 0 end;
  end loop;

  return v_result || jsonb_build_object(
    'valid', jsonb_array_length(v_errors) = 0,
    'blocking_errors', v_errors,
    'warnings', v_warnings,
    'informational_messages', v_info,
    'entitlement_days', v_total_entitlement,
    'balance_before_request', v_total_available,
    'projected_balance', v_total_projected,
    'annual_unplanned_limit', case when v_stage = 'waiting_period' then 0 else (v_result ->> 'annual_unplanned_limit')::numeric end,
    'annual_unplanned_remaining', case when v_stage = 'waiting_period' then 0 else (v_result ->> 'annual_unplanned_remaining')::numeric end,
    'lop_salary_deduction_days', case when v_type.code = 'LOP'
      then ((v_duration ->> 'working_days')::numeric * v_multiplier) else 0 end,
    'lop_salary_multiplier', v_multiplier,
    'annual_lop_reference', v_reference,
    'contractor_policy_stage', v_stage,
    'override_required', case when v_stage = 'waiting_period' and v_type.code = 'LOP'
      then false else (v_result ->> 'override_required')::boolean end
  );
end;
$$;

alter function public.time_off_refresh_balances(uuid, integer)
  rename to time_off_refresh_balances_pre_contractor;

create or replace function public.time_off_refresh_balances(
  p_employee_id uuid,
  p_leave_year integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.time_off_refresh_balances_pre_contractor(p_employee_id, p_leave_year);
  if public.time_off_is_contractor(p_employee_id) then
    update public.employee_leave_balances balance
    set entitled_days = public.time_off_employee_paid_entitlement(
      p_employee_id, make_date(p_leave_year, 12, 31)
    ), updated_at = now()
    from public.leave_types leave_type
    where balance.employee_id = p_employee_id
      and balance.leave_year = p_leave_year
      and balance.leave_type_id = leave_type.id
      and leave_type.code = 'PL';
  end if;
end;
$$;

alter function public.get_time_off_dashboard(uuid, integer)
  rename to get_time_off_dashboard_pre_contractor;

create or replace function public.get_time_off_dashboard(
  p_employee_id uuid default null,
  p_leave_year integer default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_employee_id uuid := coalesce(p_employee_id, public.get_my_employee_id());
  v_result jsonb;
  v_year integer;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_as_of date;
  v_entitlement numeric;
  v_adjustments numeric;
  v_used numeric;
  v_pending numeric;
  v_lop numeric;
  v_lop_salary numeric;
  v_months integer;
  v_stage text;
begin
  v_result := public.get_time_off_dashboard_pre_contractor(p_employee_id, p_leave_year);
  if not public.time_off_is_contractor(v_employee_id) then return v_result; end if;
  v_year := (v_result ->> 'leave_year')::integer;
  v_as_of := least(greatest(v_today, make_date(v_year, 1, 1)), make_date(v_year, 12, 31));
  v_entitlement := public.time_off_employee_paid_entitlement(v_employee_id, v_as_of);
  select coalesce(sum(adjustment.adjustment_days), 0) into v_adjustments
  from public.leave_balance_adjustments adjustment
  join public.leave_types leave_type on leave_type.id = adjustment.leave_type_id
  where adjustment.employee_id = v_employee_id and adjustment.leave_year = v_year
    and leave_type.code in ('PL', 'UL');
  v_used := (v_result ->> 'used_paid_days')::numeric;
  v_pending := (v_result ->> 'pending_paid_days')::numeric;
  v_lop := (v_result ->> 'lop_used_days')::numeric;
  select coalesce(sum(day.duration * public.time_off_employee_lop_multiplier(
    v_employee_id, request.start_date
  )), 0) into v_lop_salary
  from public.leave_request_days day
  join public.leave_requests request on request.id = day.leave_request_id
  join public.leave_types leave_type on leave_type.id = request.leave_type_id
  where request.employee_id = v_employee_id and leave_type.code = 'LOP'
    and day.is_working_day
    and extract(year from day.leave_date)::integer = v_year
    and request.status in ('approved', 'cancellation_rejected');
  select public.time_off_completed_months(employee.date_of_joining, v_as_of)
  into v_months from public.employees employee where employee.id = v_employee_id;
  v_stage := case when v_months < 6 then 'waiting_period'
    when v_months < 12 then 'first_year' else 'standard' end;
  return v_result || jsonb_build_object(
    'entitlement_days', v_entitlement + v_adjustments,
    'available_paid_days', greatest(v_entitlement + v_adjustments - v_used - v_pending, 0),
    'projected_paid_days', v_entitlement + v_adjustments - v_used - v_pending,
    'unplanned_remaining_days', case when v_stage = 'waiting_period' then 0
      else (v_result ->> 'unplanned_remaining_days')::numeric end,
    'lop_salary_deduction_days', v_lop_salary,
    'encashable_estimate_days', greatest(v_entitlement + v_adjustments - v_used - v_lop, 0),
    'monthly_application_allowance', case when v_stage = 'waiting_period' then 0
      else (v_result ->> 'monthly_application_allowance')::integer end,
    'monthly_day_allowance', case when v_stage = 'waiting_period' then 0
      else (v_result ->> 'monthly_day_allowance')::numeric end,
    'contractor_policy_stage', v_stage,
    'lop_salary_multiplier', public.time_off_employee_lop_multiplier(v_employee_id, v_as_of),
    'annual_lop_reference', case when v_stage = 'waiting_period' then null else 3 end
  );
end;
$$;

alter function public.close_employee_leave_year(uuid, integer)
  rename to close_employee_leave_year_pre_contractor;

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
  v_closure public.leave_year_closures%rowtype;
  v_entitlement numeric;
  v_adjustments numeric;
  v_used numeric;
  v_pending numeric;
  v_lop numeric;
  v_lop_salary numeric;
  v_remaining numeric;
  v_encashable numeric;
begin
  v_closure := public.close_employee_leave_year_pre_contractor(p_employee_id, p_leave_year);
  if not public.time_off_is_contractor(p_employee_id) then return v_closure; end if;
  v_entitlement := public.time_off_employee_paid_entitlement(
    p_employee_id, make_date(p_leave_year, 12, 31)
  );
  select coalesce(sum(adjustment.adjustment_days), 0) into v_adjustments
  from public.leave_balance_adjustments adjustment
  join public.leave_types leave_type on leave_type.id = adjustment.leave_type_id
  where adjustment.employee_id = p_employee_id and adjustment.leave_year = p_leave_year
    and leave_type.code in ('PL', 'UL');
  select
    coalesce(sum(case when leave_type.code in ('PL', 'UL') and request.status in ('approved', 'cancellation_rejected') then day.duration else 0 end), 0),
    coalesce(sum(case when leave_type.code in ('PL', 'UL') and request.status in ('pending', 'cancellation_requested') then day.duration else 0 end), 0),
    coalesce(sum(case when leave_type.code = 'LOP' and request.status in ('approved', 'cancellation_rejected') then day.duration else 0 end), 0),
    coalesce(sum(case when leave_type.code = 'LOP' and request.status in ('approved', 'cancellation_rejected')
      then day.duration * public.time_off_employee_lop_multiplier(p_employee_id, request.start_date) else 0 end), 0)
  into v_used, v_pending, v_lop, v_lop_salary
  from public.leave_request_days day
  join public.leave_requests request on request.id = day.leave_request_id
  join public.leave_types leave_type on leave_type.id = request.leave_type_id
  where request.employee_id = p_employee_id and day.is_working_day
    and extract(year from day.leave_date)::integer = p_leave_year;
  v_remaining := greatest(v_entitlement + v_adjustments - v_used, 0);
  v_encashable := greatest(v_remaining - v_lop, 0);
  update public.leave_year_closures set
    entitlement_days = v_entitlement + v_adjustments,
    used_paid_leave_days = v_used,
    pending_paid_leave_days = v_pending,
    remaining_paid_leave_days = v_remaining,
    lop_leave_days = v_lop,
    lop_salary_deduction_days = v_lop_salary,
    encashable_leave_days = v_encashable,
    expired_days = greatest(v_remaining - v_encashable, 0),
    calculation_details = calculation_details || jsonb_build_object(
      'contractor_policy', true,
      'lop_salary_formula', '1x before six completed months; 1.5x afterwards'
    )
  where id = v_closure.id returning * into v_closure;
  update public.leave_encashments set encashable_leave_days = v_encashable
  where leave_year_closure_id = v_closure.id;
  return v_closure;
end;
$$;

update public.leave_requests request set
  lop_salary_deduction_days = request.working_days,
  administrative_override_required = false,
  administrative_override_by = null,
  administrative_override_reason = null
from public.employees employee, public.leave_types leave_type
where request.employee_id = employee.id
  and request.leave_type_id = leave_type.id
  and lower(trim(coalesce(employee.role, ''))) = 'contractor'
  and leave_type.code = 'LOP'
  and request.status = 'pending'
  and public.time_off_completed_months(employee.date_of_joining, request.start_date) < 6;

revoke all on function public.time_off_is_contractor(uuid) from public, anon;
revoke all on function public.time_off_employee_paid_entitlement(uuid, date) from public, anon;
revoke all on function public.time_off_employee_lop_multiplier(uuid, date) from public, anon;
revoke all on function public.time_off_evaluate_leave_request_pre_contractor(uuid, uuid, date, date, text, text, uuid) from public, anon, authenticated;
revoke all on function public.time_off_refresh_balances_pre_contractor(uuid, integer) from public, anon, authenticated;
revoke all on function public.get_time_off_dashboard_pre_contractor(uuid, integer) from public, anon, authenticated;
revoke all on function public.close_employee_leave_year_pre_contractor(uuid, integer) from public, anon, authenticated;
revoke all on function public.time_off_evaluate_leave_request(uuid, uuid, date, date, text, text, uuid) from public, anon;
revoke all on function public.time_off_refresh_balances(uuid, integer) from public, anon;
revoke all on function public.get_time_off_dashboard(uuid, integer) from public, anon;
revoke all on function public.close_employee_leave_year(uuid, integer) from public, anon;

grant execute on function public.time_off_is_contractor(uuid) to authenticated, service_role;
grant execute on function public.time_off_employee_paid_entitlement(uuid, date) to authenticated, service_role;
grant execute on function public.time_off_employee_lop_multiplier(uuid, date) to authenticated, service_role;
grant execute on function public.time_off_evaluate_leave_request(uuid, uuid, date, date, text, text, uuid) to authenticated, service_role;
grant execute on function public.time_off_refresh_balances(uuid, integer) to service_role;
grant execute on function public.get_time_off_dashboard(uuid, integer) to authenticated, service_role;
grant execute on function public.close_employee_leave_year(uuid, integer) to authenticated, service_role;

comment on function public.time_off_employee_paid_entitlement(uuid, date) is
  'Returns role-aware paid leave entitlement, including the contractor six-month waiting period.';
comment on function public.time_off_employee_lop_multiplier(uuid, date) is
  'Returns 1x for contractor LOP before six completed months and the standard policy multiplier afterwards.';

notify pgrst, 'reload schema';

commit;
