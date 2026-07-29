begin;

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
  v_year integer := coalesce(
    p_leave_year,
    extract(year from (now() at time zone 'Asia/Kolkata')::date)::integer
  );
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_as_of date;
  v_employee public.employees%rowtype;
  v_entitlement numeric;
  v_used numeric := 0;
  v_pending numeric := 0;
  v_unplanned numeric := 0;
  v_lop numeric := 0;
  v_lop_salary numeric := 0;
  v_adjustments numeric := 0;
  v_next_holiday jsonb;
  v_exception public.leave_extended_exceptions%rowtype;
  v_policy_id uuid;
  v_unplanned_limit numeric := 6;
  v_lop_multiplier numeric := 1.5;
  v_monthly_days numeric := 2;
  v_first_apps integer := 1;
  v_post_apps integer := 2;
begin
  if v_employee_id <> public.get_my_employee_id()
    and not public.time_off_can_manage_employee(v_employee_id) then
    raise exception 'You are not authorised to view this leave dashboard.';
  end if;
  select * into v_employee from public.employees where id = v_employee_id;
  if not found then raise exception 'Employee not found.'; end if;
  v_as_of := least(greatest(v_today, make_date(v_year, 1, 1)), make_date(v_year, 12, 31));
  select id into v_policy_id from public.leave_policies
  where is_active and effective_start_date <= v_as_of
    and (effective_end_date is null or effective_end_date >= v_as_of)
  order by effective_start_date desc, version desc limit 1;
  select
    coalesce(max((rule_value #>> '{}')::numeric) filter (where rule_key = 'annual_unplanned_limit'), 6),
    coalesce(max((rule_value #>> '{}')::numeric) filter (where rule_key = 'lop_salary_multiplier'), 1.5),
    coalesce(max((rule_value #>> '{}')::numeric) filter (where rule_key = 'normal_monthly_paid_days'), 2),
    coalesce(max((rule_value #>> '{}')::integer) filter (where rule_key = 'first_year_monthly_applications'), 1),
    coalesce(max((rule_value #>> '{}')::integer) filter (where rule_key = 'post_first_year_monthly_applications'), 2)
  into v_unplanned_limit, v_lop_multiplier, v_monthly_days, v_first_apps, v_post_apps
  from public.leave_policy_rules where policy_id = v_policy_id;
  v_entitlement := public.time_off_paid_entitlement(v_employee.date_of_joining, v_as_of);

  select
    coalesce(sum(case when leave_type.code in ('PL', 'UL') and request.status in ('approved', 'cancellation_rejected') then day.duration else 0 end), 0),
    coalesce(sum(case when leave_type.code in ('PL', 'UL') and request.status in ('pending', 'cancellation_requested') then day.duration else 0 end), 0),
    coalesce(sum(case when leave_type.code = 'UL' and request.status in ('approved', 'cancellation_rejected') then day.duration else 0 end), 0),
    coalesce(sum(case when leave_type.code = 'LOP' and request.status in ('approved', 'cancellation_rejected') then day.duration else 0 end), 0)
  into v_used, v_pending, v_unplanned, v_lop
  from public.leave_request_days day
  join public.leave_requests request on request.id = day.leave_request_id
  join public.leave_types leave_type on leave_type.id = request.leave_type_id
  where request.employee_id = v_employee_id and day.is_working_day
    and extract(year from day.leave_date)::integer = v_year;
  v_lop_salary := v_lop * v_lop_multiplier;
  select coalesce(sum(adjustment.adjustment_days), 0) into v_adjustments
  from public.leave_balance_adjustments adjustment
  join public.leave_types leave_type on leave_type.id = adjustment.leave_type_id
  where adjustment.employee_id = v_employee_id and adjustment.leave_year = v_year
    and leave_type.code in ('PL', 'UL');
  select jsonb_build_object(
    'date', holiday.holiday_date, 'name', holiday.name,
    'day_part', holiday.day_part
  ) into v_next_holiday
  from public.holidays holiday
  join public.holiday_calendars calendar on calendar.id = holiday.holiday_calendar_id
  where holiday.is_active and calendar.is_active
    and holiday.holiday_date >= v_today
    and (calendar.audience = 'ALL' or calendar.audience is null)
  order by holiday.holiday_date limit 1;
  select * into v_exception from public.leave_extended_exceptions
  where employee_id = v_employee_id and leave_year = v_year;

  return jsonb_build_object(
    'employee_id', v_employee_id,
    'leave_year', v_year,
    'entitlement_days', v_entitlement + v_adjustments,
    'used_paid_days', v_used,
    'pending_paid_days', v_pending,
    'available_paid_days', greatest(v_entitlement + v_adjustments - v_used - v_pending, 0),
    'projected_paid_days', v_entitlement + v_adjustments - v_used - v_pending,
    'unplanned_used_days', v_unplanned,
    'unplanned_remaining_days', greatest(v_unplanned_limit - v_unplanned, 0),
    'lop_used_days', v_lop,
    'lop_salary_deduction_days', v_lop_salary,
    'encashable_estimate_days', greatest(v_entitlement + v_adjustments - v_used - v_lop, 0),
    'pending_requests', (
      select count(*) from public.leave_requests
      where employee_id = v_employee_id and status in ('pending', 'cancellation_requested')
        and start_date <= make_date(v_year, 12, 31)
        and end_date >= make_date(v_year, 1, 1)
    ),
    'approved_upcoming_requests', (
      select count(*) from public.leave_requests
      where employee_id = v_employee_id and status in ('approved', 'cancellation_rejected')
        and end_date >= v_today
    ),
    'policy_tier', case
      when public.time_off_completed_months(v_employee.date_of_joining, v_today) >= 12
        then 'post_first_year' else 'first_year' end,
    'service_completed_months', public.time_off_completed_months(v_employee.date_of_joining, v_today),
    'first_anniversary', (v_employee.date_of_joining + interval '1 year')::date,
    'monthly_application_allowance', case
      when public.time_off_completed_months(v_employee.date_of_joining, v_today) >= 12 then v_post_apps else v_first_apps end,
    'monthly_day_allowance', v_monthly_days,
    'extended_exception_status', coalesce(v_exception.status, 'available'),
    'extended_exception_reason', v_exception.unavailable_reason,
    'next_holiday', v_next_holiday
  );
end;
$$;

create or replace function public.get_time_off_calendar(
  p_from date,
  p_to date
)
returns table (
  id uuid,
  employee_id uuid,
  employee_name text,
  department text,
  leave_type_name text,
  leave_type_code text,
  colour text,
  start_date date,
  end_date date,
  working_days numeric,
  status text,
  reason text,
  is_own boolean,
  can_view_details boolean,
  reporting_manager_id uuid,
  manager_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    request.id,
    request.employee_id,
    concat_ws(' ', nullif(employee.title, ''), employee.name)::text,
    employee.department,
    leave_type.name,
    leave_type.code,
    leave_type.colour,
    request.start_date,
    request.end_date,
    request.working_days,
    request.status,
    case
      when request.employee_id = public.get_my_employee_id()
        or public.time_off_can_manage_employee(request.employee_id)
      then request.reason else null
    end,
    request.employee_id = public.get_my_employee_id(),
    request.employee_id = public.get_my_employee_id()
      or public.time_off_can_manage_employee(request.employee_id),
    employee.reporting_manager_id,
    manager.name
  from public.leave_requests request
  join public.employees employee on employee.id = request.employee_id
  join public.leave_types leave_type on leave_type.id = request.leave_type_id
  left join public.employees manager on manager.id = employee.reporting_manager_id
  where request.end_date >= p_from and request.start_date <= p_to
    and request.status in ('pending', 'approved', 'cancellation_requested', 'cancellation_rejected')
  order by request.start_date, employee.name
$$;

revoke all on function public.get_time_off_dashboard(uuid, integer) from public, anon;
revoke all on function public.get_time_off_calendar(date, date) from public, anon;
grant execute on function public.get_time_off_dashboard(uuid, integer) to authenticated;
grant execute on function public.get_time_off_calendar(date, date) to authenticated;

notify pgrst, 'reload schema';

commit;
