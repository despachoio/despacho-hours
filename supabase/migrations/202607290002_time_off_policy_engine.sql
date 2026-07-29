begin;

create or replace function public.time_off_completed_months(
  p_joining_date date,
  p_as_of date
)
returns integer
language sql
immutable
as $$
  select case
    when p_joining_date is null or p_as_of < p_joining_date then 0
    else greatest(
      extract(year from age(p_as_of, p_joining_date))::integer * 12
      + extract(month from age(p_as_of, p_joining_date))::integer,
      0
    )
  end
$$;

create or replace function public.time_off_paid_entitlement(
  p_joining_date date,
  p_as_of date
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_year_start date := make_date(extract(year from p_as_of)::integer, 1, 1);
  v_anniversary date := (p_joining_date + interval '1 year')::date;
  v_months_at_start integer;
  v_months_at_as_of integer;
  v_monthly_rate numeric := 1;
  v_annual_entitlement numeric := 12;
  v_policy_id uuid;
begin
  if p_joining_date is null or p_as_of < p_joining_date then
    return 0;
  end if;
  select id into v_policy_id from public.leave_policies
  where is_active and effective_start_date <= p_as_of
    and (effective_end_date is null or effective_end_date >= p_as_of)
  order by effective_start_date desc, version desc limit 1;
  select
    coalesce(max((rule.rule_value #>> '{}')::numeric) filter (where rule.rule_key = 'first_year_monthly_accrual'), 1),
    coalesce(max((rule.rule_value #>> '{}')::numeric) filter (where rule.rule_key = 'annual_paid_entitlement'), 12)
  into v_monthly_rate, v_annual_entitlement
  from public.leave_policy_rules rule where rule.policy_id = v_policy_id;
  if p_as_of >= v_anniversary then
    return v_annual_entitlement;
  end if;
  v_months_at_start := public.time_off_completed_months(
    p_joining_date, v_year_start - 1
  );
  v_months_at_as_of := public.time_off_completed_months(
    p_joining_date, p_as_of
  );
  return least(
    greatest(v_months_at_as_of - v_months_at_start, 0) * v_monthly_rate,
    v_annual_entitlement
  );
end;
$$;

create or replace function public.time_off_calculate_duration(
  p_leave_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_start_day_part text default 'full_day',
  p_end_day_part text default 'full_day',
  p_employee_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_type public.leave_types%rowtype;
  v_date date;
  v_part text;
  v_parts text[];
  v_is_weekend boolean;
  v_holiday_part text;
  v_is_holiday boolean;
  v_is_working boolean;
  v_requested numeric := 0;
  v_working numeric := 0;
  v_holidays numeric := 0;
  v_weekly_offs numeric := 0;
  v_days jsonb := '[]'::jsonb;
  v_employee_department text;
  v_employee_country text;
  v_employee_location text;
begin
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Enter a valid leave date range.';
  end if;
  if p_start_day_part not in ('full_day', 'first_half', 'second_half')
    or p_end_day_part not in ('full_day', 'first_half', 'second_half') then
    raise exception 'Select a valid day duration.';
  end if;
  if p_start_date < p_end_date
    and p_start_day_part = 'first_half' then
    raise exception 'A multi-day request may start with Full Day or Second Half.';
  end if;
  if p_start_date < p_end_date
    and p_end_day_part = 'second_half' then
    raise exception 'A multi-day request may end with Full Day or First Half.';
  end if;

  select * into v_type from public.leave_types where id = p_leave_type_id;
  if not found or not v_type.is_active then
    raise exception 'Select an active leave type.';
  end if;

  if p_employee_id is not null then
    select employee.department, details.country, details.city
    into v_employee_department, v_employee_country, v_employee_location
    from public.employees employee
    left join public.employee_extended_details details
      on details.employee_id = employee.id
    where employee.id = p_employee_id;
  end if;

  for v_date in
    select generate_series(p_start_date, p_end_date, interval '1 day')::date
  loop
    if p_start_date = p_end_date then
      v_parts := case p_start_day_part
        when 'first_half' then array['first_half']
        when 'second_half' then array['second_half']
        else array['first_half', 'second_half']
      end;
    elsif v_date = p_start_date then
      v_parts := case p_start_day_part
        when 'second_half' then array['second_half']
        else array['first_half', 'second_half']
      end;
    elsif v_date = p_end_date then
      v_parts := case p_end_day_part
        when 'first_half' then array['first_half']
        else array['first_half', 'second_half']
      end;
    else
      v_parts := array['first_half', 'second_half'];
    end if;

    v_is_weekend := extract(dow from v_date)::integer in (0, 6);
    select holiday.day_part into v_holiday_part
    from public.holidays holiday
    join public.holiday_calendars calendar
      on calendar.id = holiday.holiday_calendar_id
    where holiday.holiday_date = v_date
      and holiday.is_active and calendar.is_active
      and (
        calendar.audience = 'ALL'
        or calendar.audience is null
        or (
          p_employee_id is not null
          and upper(calendar.audience) = 'DEPARTMENT'
          and calendar.department is not null
          and lower(calendar.department) = lower(coalesce(v_employee_department, ''))
        )
        or (
          p_employee_id is not null
          and upper(calendar.audience) = 'COUNTRY'
          and calendar.country is not null
          and lower(calendar.country) = lower(coalesce(v_employee_country, ''))
        )
        or (
          p_employee_id is not null
          and upper(calendar.audience) = 'LOCATION'
          and calendar.location is not null
          and lower(calendar.location) = lower(coalesce(v_employee_location, ''))
        )
      )
    order by case holiday.day_part when 'full_day' then 0 else 1 end
    limit 1;

    foreach v_part in array v_parts loop
      v_requested := v_requested + 0.5;
      v_is_holiday := v_holiday_part = 'full_day'
        or v_holiday_part = v_part;
      v_is_working := not (
        (v_type.exclude_weekends and v_is_weekend)
        or (v_type.exclude_holidays and v_is_holiday)
      );
      if v_is_working then
        v_working := v_working + 0.5;
      elsif v_type.exclude_holidays and v_is_holiday then
        v_holidays := v_holidays + 0.5;
      elsif v_type.exclude_weekends and v_is_weekend then
        v_weekly_offs := v_weekly_offs + 0.5;
      end if;
      v_days := v_days || jsonb_build_array(jsonb_build_object(
        'leave_date', v_date,
        'day_part', v_part,
        'duration', 0.5,
        'is_working_day', v_is_working,
        'is_holiday', v_is_holiday,
        'is_weekly_off', v_is_weekend
      ));
    end loop;
    v_holiday_part := null;
  end loop;

  return jsonb_build_object(
    'requested_days', v_requested,
    'working_days', v_working,
    'calendar_span_days', p_end_date - p_start_date + 1,
    'holidays_excluded', v_holidays,
    'weekly_offs_excluded', v_weekly_offs,
    'days', v_days
  );
end;
$$;

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
  v_employee public.employees%rowtype;
  v_type public.leave_types%rowtype;
  v_policy public.leave_policies%rowtype;
  v_duration jsonb;
  v_working numeric;
  v_calendar_span integer;
  v_completed_months integer;
  v_tier text;
  v_entitlement numeric;
  v_paid_approved numeric := 0;
  v_paid_pending numeric := 0;
  v_adjustments numeric := 0;
  v_unplanned numeric := 0;
  v_lop numeric := 0;
  v_available numeric;
  v_projected numeric;
  v_month record;
  v_existing_month_days numeric;
  v_existing_month_apps integer;
  v_candidate_month_days numeric;
  v_app_limit integer;
  v_selected_month_applications integer := 0;
  v_selected_month_days numeric := 0;
  v_year integer;
  v_candidate_year_days numeric;
  v_year_entitlement numeric;
  v_year_approved numeric;
  v_year_pending numeric;
  v_year_adjustments numeric;
  v_year_available numeric;
  v_extended_status text := 'not_applicable';
  v_extended_reason text;
  v_extended_consumed boolean := false;
  v_override boolean := false;
  v_normal_monthly_days numeric := 2;
  v_first_year_apps integer := 1;
  v_post_year_apps integer := 2;
  v_unplanned_limit numeric := 6;
  v_lop_reference numeric := 3;
  v_lop_multiplier numeric := 1.5;
  v_extended_working_limit numeric := 5;
  v_extended_span_limit integer := 9;
  v_maternity_months integer := 6;
  v_errors jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_info jsonb := '[]'::jsonb;
begin
  if auth.uid() is not null
    and p_employee_id <> public.get_my_employee_id()
    and not public.time_off_can_manage_employee(p_employee_id) then
    raise exception 'You are not authorised to evaluate leave for this employee.';
  end if;
  select * into v_employee from public.employees where id = p_employee_id;
  if not found then raise exception 'Employee not found.'; end if;
  if lower(trim(coalesce(v_employee.status, ''))) <> 'active' then
    v_errors := v_errors || jsonb_build_array('The employee account is not active.');
  end if;
  if v_employee.date_of_joining is null then
    v_errors := v_errors || jsonb_build_array('Date of joining is required before leave can be requested.');
  end if;

  select * into v_type from public.leave_types where id = p_leave_type_id;
  if not found or not v_type.is_active then raise exception 'Select an active leave type.'; end if;
  select * into v_policy
  from public.leave_policies
  where is_active and effective_start_date <= p_start_date
    and (effective_end_date is null or effective_end_date >= p_start_date)
  order by effective_start_date desc, version desc limit 1;
  if not found then raise exception 'No active leave policy covers the selected date.'; end if;
  select
    coalesce(max((rule_value #>> '{}')::numeric) filter (where rule_key = 'normal_monthly_paid_days'), 2),
    coalesce(max((rule_value #>> '{}')::integer) filter (where rule_key = 'first_year_monthly_applications'), 1),
    coalesce(max((rule_value #>> '{}')::integer) filter (where rule_key = 'post_first_year_monthly_applications'), 2),
    coalesce(max((rule_value #>> '{}')::numeric) filter (where rule_key = 'annual_unplanned_limit'), 6),
    coalesce(max((rule_value #>> '{}')::numeric) filter (where rule_key = 'annual_lop_reference'), 3),
    coalesce(max((rule_value #>> '{}')::numeric) filter (where rule_key = 'lop_salary_multiplier'), 1.5),
    coalesce(max((rule_value #>> '{}')::numeric) filter (where rule_key = 'extended_planned_working_days'), 5),
    coalesce(max((rule_value #>> '{}')::integer) filter (where rule_key = 'extended_planned_calendar_span'), 9),
    coalesce(max((rule_value #>> '{}')::integer) filter (where rule_key = 'maternity_calendar_months'), 6)
  into v_normal_monthly_days, v_first_year_apps, v_post_year_apps,
    v_unplanned_limit, v_lop_reference, v_lop_multiplier,
    v_extended_working_limit, v_extended_span_limit, v_maternity_months
  from public.leave_policy_rules where policy_id = v_policy.id;

  v_duration := public.time_off_calculate_duration(
    p_leave_type_id, p_start_date, p_end_date,
    p_start_day_part, p_end_day_part, p_employee_id
  );
  v_working := (v_duration ->> 'working_days')::numeric;
  v_calendar_span := (v_duration ->> 'calendar_span_days')::integer;
  if v_working <= 0 then
    v_errors := v_errors || jsonb_build_array('The selected range contains no chargeable leave time.');
  end if;

  v_completed_months := public.time_off_completed_months(
    v_employee.date_of_joining, p_start_date
  );
  v_tier := case when v_completed_months >= 12
    then 'post_first_year' else 'first_year' end;
  v_entitlement := public.time_off_paid_entitlement(
    v_employee.date_of_joining, p_start_date
  );

  if v_type.gender_eligibility <> 'All'
    and coalesce(v_employee.gender, '') <> v_type.gender_eligibility then
    v_errors := v_errors || jsonb_build_array(
      format('%s is available only to employees with gender %s.',
        v_type.name, v_type.gender_eligibility)
    );
  end if;
  if v_completed_months < v_type.minimum_service_months then
    v_errors := v_errors || jsonb_build_array(
      format('%s requires %s completed months of service.',
        v_type.name, v_type.minimum_service_months)
    );
  end if;
  if v_type.maximum_days_per_request is not null
    and v_working > v_type.maximum_days_per_request then
    v_errors := v_errors || jsonb_build_array(
      format('%s permits at most %s working days per request.',
        v_type.name, v_type.maximum_days_per_request)
    );
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(v_duration -> 'days') as candidate(
      leave_date date, day_part text, duration numeric,
      is_working_day boolean, is_holiday boolean, is_weekly_off boolean
    )
    join public.leave_request_days existing
      on existing.employee_id = p_employee_id
      and existing.leave_date = candidate.leave_date
      and existing.day_part = candidate.day_part
      and existing.is_working_day and candidate.is_working_day
      and existing.status in ('pending', 'approved', 'cancellation_requested', 'cancellation_rejected')
    where p_existing_request_id is null
      or existing.leave_request_id <> p_existing_request_id
  ) then
    v_errors := v_errors || jsonb_build_array('The selected dates overlap an existing leave request.');
  end if;

  v_paid_approved := 0;
  v_paid_pending := 0;
  v_adjustments := 0;
  v_available := 0;
  v_projected := 0;
  for v_year in
    select distinct extract(year from candidate.leave_date)::integer
    from jsonb_to_recordset(v_duration -> 'days') as candidate(
      leave_date date, day_part text, duration numeric,
      is_working_day boolean, is_holiday boolean, is_weekly_off boolean
    )
    where candidate.is_working_day
    order by 1
  loop
    select coalesce(sum(candidate.duration), 0)
    into v_candidate_year_days
    from jsonb_to_recordset(v_duration -> 'days') as candidate(
      leave_date date, day_part text, duration numeric,
      is_working_day boolean, is_holiday boolean, is_weekly_off boolean
    )
    where candidate.is_working_day
      and extract(year from candidate.leave_date)::integer = v_year;
    v_year_entitlement := public.time_off_paid_entitlement(
      v_employee.date_of_joining,
      least(p_end_date, make_date(v_year, 12, 31))
    );
    select
      coalesce(sum(case when request.status in ('approved', 'cancellation_rejected') then day.duration else 0 end), 0),
      coalesce(sum(case when request.status in ('pending', 'cancellation_requested') then day.duration else 0 end), 0)
    into v_year_approved, v_year_pending
    from public.leave_request_days day
    join public.leave_requests request on request.id = day.leave_request_id
    join public.leave_types leave_type on leave_type.id = request.leave_type_id
    where request.employee_id = p_employee_id
      and extract(year from day.leave_date)::integer = v_year
      and leave_type.code in ('PL', 'UL') and day.is_working_day
      and (p_existing_request_id is null or request.id <> p_existing_request_id);
    select coalesce(sum(adjustment.adjustment_days), 0)
    into v_year_adjustments
    from public.leave_balance_adjustments adjustment
    join public.leave_types leave_type on leave_type.id = adjustment.leave_type_id
    where adjustment.employee_id = p_employee_id
      and adjustment.leave_year = v_year and leave_type.code in ('PL', 'UL');
    v_year_available := v_year_entitlement + v_year_adjustments
      - v_year_approved - v_year_pending;
    if v_type.code in ('PL', 'UL')
      and v_year_available - v_candidate_year_days < 0
      and not v_type.negative_balance_allowed then
      v_errors := v_errors || jsonb_build_array(
        format('Your remaining paid leave balance for %s is insufficient.', v_year)
      );
    end if;
    v_entitlement := v_entitlement + case
      when v_year = extract(year from p_start_date)::integer then 0
      else v_year_entitlement end;
    v_paid_approved := v_paid_approved + v_year_approved;
    v_paid_pending := v_paid_pending + v_year_pending;
    v_adjustments := v_adjustments + v_year_adjustments;
    v_available := v_available + v_year_available;
    v_projected := v_projected + v_year_available
      - case when v_type.code in ('PL', 'UL') then v_candidate_year_days else 0 end;
  end loop;

  for v_month in
    select distinct date_trunc('month', candidate.leave_date)::date as month_start
    from jsonb_to_recordset(v_duration -> 'days') as candidate(
      leave_date date, day_part text, duration numeric,
      is_working_day boolean, is_holiday boolean, is_weekly_off boolean
    )
    where candidate.is_working_day
  loop
    select coalesce(sum(day.duration), 0), count(distinct request.id)
    into v_existing_month_days, v_existing_month_apps
    from public.leave_request_days day
    join public.leave_requests request on request.id = day.leave_request_id
    join public.leave_types leave_type on leave_type.id = request.leave_type_id
    where request.employee_id = p_employee_id
      and day.leave_date >= v_month.month_start
      and day.leave_date < (v_month.month_start + interval '1 month')::date
      and day.is_working_day
      and request.status in ('pending', 'approved', 'cancellation_requested', 'cancellation_rejected')
      and leave_type.code in ('PL', 'UL')
      and (p_existing_request_id is null or request.id <> p_existing_request_id);
    select coalesce(sum(candidate.duration), 0)
    into v_candidate_month_days
    from jsonb_to_recordset(v_duration -> 'days') as candidate(
      leave_date date, day_part text, duration numeric,
      is_working_day boolean, is_holiday boolean, is_weekly_off boolean
    )
    where candidate.is_working_day
      and candidate.leave_date >= v_month.month_start
      and candidate.leave_date < (v_month.month_start + interval '1 month')::date;
    if p_start_date >= v_month.month_start
      and p_start_date < (v_month.month_start + interval '1 month')::date then
      v_selected_month_applications := v_existing_month_apps + 1;
      v_selected_month_days := v_existing_month_days + v_candidate_month_days;
    end if;
    v_app_limit := case
      when public.time_off_completed_months(
        v_employee.date_of_joining,
        greatest(p_start_date, v_month.month_start)
      ) >= 12 then v_post_year_apps else v_first_year_apps end;

    if v_type.code in ('PL', 'UL')
      and v_existing_month_apps + 1 > v_app_limit then
      v_errors := v_errors || jsonb_build_array(
        format('The monthly Planned/Unplanned application limit for %s has been reached.',
          to_char(v_month.month_start, 'FMMonth YYYY'))
      );
    end if;
    if v_type.code in ('PL', 'UL')
      and v_existing_month_days + v_candidate_month_days > v_normal_monthly_days then
      if v_type.code = 'PL'
        and public.time_off_completed_months(
          v_employee.date_of_joining,
          greatest(p_start_date, v_month.month_start)
        ) >= 12
        and v_existing_month_days + v_candidate_month_days <= v_extended_working_limit
        and v_calendar_span <= v_extended_span_limit
        and date_trunc('month', p_start_date) = date_trunc('month', p_end_date)
      then
        v_extended_consumed := true;
      else
        v_errors := v_errors || jsonb_build_array(
          format('This request exceeds the two-day paid leave limit for %s.',
            to_char(v_month.month_start, 'FMMonth YYYY'))
        );
      end if;
    end if;
  end loop;

  v_unplanned := 0;
  v_lop := 0;
  for v_year in
    select distinct extract(year from candidate.leave_date)::integer
    from jsonb_to_recordset(v_duration -> 'days') as candidate(
      leave_date date, day_part text, duration numeric,
      is_working_day boolean, is_holiday boolean, is_weekly_off boolean
    ) where candidate.is_working_day order by 1
  loop
    select coalesce(sum(candidate.duration), 0) into v_candidate_year_days
    from jsonb_to_recordset(v_duration -> 'days') as candidate(
      leave_date date, day_part text, duration numeric,
      is_working_day boolean, is_holiday boolean, is_weekly_off boolean
    ) where candidate.is_working_day
      and extract(year from candidate.leave_date)::integer = v_year;
    select coalesce(sum(day.duration), 0) into v_year_approved
    from public.leave_request_days day
    join public.leave_requests request on request.id = day.leave_request_id
    join public.leave_types leave_type on leave_type.id = request.leave_type_id
    where request.employee_id = p_employee_id
      and extract(year from day.leave_date)::integer = v_year
      and leave_type.code = 'UL' and day.is_working_day
      and request.status in ('pending', 'approved', 'cancellation_requested', 'cancellation_rejected')
      and (p_existing_request_id is null or request.id <> p_existing_request_id);
    v_unplanned := v_unplanned + v_year_approved;
    if v_type.code = 'UL' and v_year_approved + v_candidate_year_days > v_unplanned_limit then
      v_errors := v_errors || jsonb_build_array(
        format('Unplanned Leave cannot exceed six days in %s.', v_year)
      );
    end if;
    select coalesce(sum(day.duration), 0) into v_year_pending
    from public.leave_request_days day
    join public.leave_requests request on request.id = day.leave_request_id
    join public.leave_types leave_type on leave_type.id = request.leave_type_id
    where request.employee_id = p_employee_id
      and extract(year from day.leave_date)::integer = v_year
      and leave_type.code = 'LOP' and day.is_working_day
      and request.status in ('pending', 'approved', 'cancellation_requested', 'cancellation_rejected')
      and (p_existing_request_id is null or request.id <> p_existing_request_id);
    v_lop := v_lop + v_year_pending;
    if v_type.code = 'LOP' and v_year_pending + v_candidate_year_days > v_lop_reference then
      v_override := true;
      v_warnings := v_warnings || jsonb_build_array(
        format('This request exceeds the three-day LOP reference for %s and requires an administrative override.', v_year)
      );
    end if;
  end loop;

  if v_extended_consumed then
    if exists (
      select 1 from public.leave_extended_exceptions exception
      where exception.employee_id = p_employee_id
        and exception.leave_year = extract(year from p_start_date)::integer
        and exception.status in ('reserved', 'used', 'ineligible')
        and (p_existing_request_id is null or exception.leave_request_id <> p_existing_request_id)
    ) then
      v_errors := v_errors || jsonb_build_array('The annual extended planned-leave exception is unavailable.');
      v_extended_status := 'unavailable';
      v_extended_reason := 'Already used, reserved, or marked ineligible.';
    elsif exists (
      select 1
      from public.leave_requests request
      join public.leave_types leave_type on leave_type.id = request.leave_type_id
      where request.employee_id = p_employee_id
        and request.leave_year = extract(year from p_start_date)::integer
        and request.status in ('approved', 'cancellation_rejected')
        and leave_type.code = 'LOP'
        and request.lop_reason_category = 'monthly_paid_leave_limit_exceeded'
    ) then
      v_errors := v_errors || jsonb_build_array('The extended exception is unavailable because qualifying excess leave was recorded as LOP.');
      v_extended_status := 'ineligible';
      v_extended_reason := 'LOP caused by exceeding the normal monthly paid-leave entitlement.';
    else
      v_extended_status := 'will_be_consumed';
      v_warnings := v_warnings || jsonb_build_array('Approval will consume the annual extended planned-leave exception.');
    end if;
  elsif v_tier = 'post_first_year' then
    v_extended_status := 'available';
  end if;

  if v_type.code = 'ML' then
    if p_end_date > (p_start_date + make_interval(months => v_maternity_months) - interval '1 day')::date then
      v_errors := v_errors || jsonb_build_array('Maternity Leave cannot exceed six calendar months.');
    end if;
    if p_end_date <> (p_start_date + make_interval(months => v_maternity_months) - interval '1 day')::date then
      v_info := v_info || jsonb_build_array(
        format('Six calendar months from the selected start date ends on %s.',
          to_char((p_start_date + make_interval(months => v_maternity_months) - interval '1 day')::date, 'DD Mon YYYY'))
      );
    end if;
    if p_start_day_part <> 'full_day' or p_end_day_part <> 'full_day' then
      v_info := v_info || jsonb_build_array('Half-day maternity leave is unusual; confirm the selected duration.');
    end if;
  end if;
  if v_type.code = 'PTL' and v_working > 5 then
    v_errors := v_errors || jsonb_build_array('Paternity Leave cannot exceed five working days.');
  end if;

  return jsonb_build_object(
    'valid', jsonb_array_length(v_errors) = 0,
    'blocking_errors', v_errors,
    'warnings', v_warnings,
    'informational_messages', v_info,
    'calculated_duration', v_duration,
    'projected_balance', v_projected,
    'balance_before_request', v_available,
    'entitlement_days', v_entitlement,
    'used_paid_days', v_paid_approved,
    'pending_paid_days', v_paid_pending,
    'policy_tier', v_tier,
    'service_completed_months', v_completed_months,
    'first_anniversary', (v_employee.date_of_joining + interval '1 year')::date,
    'annual_unplanned_used', v_unplanned,
    'annual_unplanned_limit', v_unplanned_limit,
    'annual_unplanned_remaining', greatest(v_unplanned_limit - v_unplanned, 0),
    'annual_lop_used', v_lop,
    'selected_month_application_count', v_selected_month_applications,
    'selected_month_paid_days', v_selected_month_days,
    'lop_salary_deduction_days', case when v_type.code = 'LOP' then v_working * v_lop_multiplier else 0 end,
    'extended_exception_status', v_extended_status,
    'extended_exception_reason', v_extended_reason,
    'extended_exception_consumed', v_extended_consumed,
    'override_required', v_override,
    'maternity_expected_end_date', case when v_type.code = 'ML'
      then (p_start_date + make_interval(months => v_maternity_months) - interval '1 day')::date
      else null end,
    'policy_id', v_policy.id,
    'policy_name', v_policy.name,
    'policy_version', v_policy.version
  );
end;
$$;

create or replace function public.time_off_refresh_balances(
  p_employee_id uuid,
  p_leave_year integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type public.leave_types%rowtype;
  v_entitlement numeric;
  v_used numeric;
  v_pending numeric;
  v_adjustment numeric;
  v_joining date;
begin
  select date_of_joining into v_joining from public.employees where id = p_employee_id;
  for v_type in select * from public.leave_types loop
    v_entitlement := case
      when v_type.code = 'PL' then public.time_off_paid_entitlement(
        v_joining, make_date(p_leave_year, 12, 31)
      )
      when v_type.code = 'PTL' then 5
      else 0
    end;
    select
      coalesce(sum(case when request.status in ('approved', 'cancellation_rejected') then day.duration else 0 end), 0),
      coalesce(sum(case when request.status in ('pending', 'cancellation_requested') then day.duration else 0 end), 0)
    into v_used, v_pending
    from public.leave_request_days day
    join public.leave_requests request on request.id = day.leave_request_id
    where request.employee_id = p_employee_id
      and request.leave_type_id = v_type.id
      and extract(year from day.leave_date)::integer = p_leave_year
      and day.is_working_day;
    select coalesce(sum(adjustment_days), 0) into v_adjustment
    from public.leave_balance_adjustments
    where employee_id = p_employee_id
      and leave_type_id = v_type.id and leave_year = p_leave_year;
    insert into public.employee_leave_balances (
      employee_id, leave_type_id, leave_year, entitled_days,
      used_days, pending_days, adjustment_days, updated_at
    ) values (
      p_employee_id, v_type.id, p_leave_year, v_entitlement,
      v_used, v_pending, v_adjustment, now()
    )
    on conflict (employee_id, leave_type_id, leave_year) do update set
      entitled_days = excluded.entitled_days,
      used_days = excluded.used_days,
      pending_days = excluded.pending_days,
      adjustment_days = excluded.adjustment_days,
      updated_at = now();
  end loop;
end;
$$;

revoke all on function public.time_off_completed_months(date, date) from public, anon;
revoke all on function public.time_off_paid_entitlement(date, date) from public, anon;
revoke all on function public.time_off_calculate_duration(uuid, date, date, text, text, uuid) from public, anon;
revoke all on function public.time_off_evaluate_leave_request(uuid, uuid, date, date, text, text, uuid) from public, anon;
revoke all on function public.time_off_refresh_balances(uuid, integer) from public, anon;
grant execute on function public.time_off_completed_months(date, date) to authenticated, service_role;
grant execute on function public.time_off_paid_entitlement(date, date) to authenticated, service_role;
grant execute on function public.time_off_calculate_duration(uuid, date, date, text, text, uuid) to authenticated, service_role;
grant execute on function public.time_off_evaluate_leave_request(uuid, uuid, date, date, text, text, uuid) to authenticated, service_role;
grant execute on function public.time_off_refresh_balances(uuid, integer) to service_role;

notify pgrst, 'reload schema';

commit;
