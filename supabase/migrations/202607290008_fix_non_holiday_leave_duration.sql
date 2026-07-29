begin;

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
  if p_start_date < p_end_date and p_start_day_part = 'first_half' then
    raise exception 'A multi-day request may start with Full Day or Second Half.';
  end if;
  if p_start_date < p_end_date and p_end_day_part = 'second_half' then
    raise exception 'A multi-day request may end with Full Day or First Half.';
  end if;

  select * into v_type
  from public.leave_types
  where id = p_leave_type_id;
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
      and holiday.is_active
      and calendar.is_active
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
      -- A SELECT INTO with no holiday returns NULL. Coerce that result to false
      -- so an ordinary weekday remains working leave time.
      v_is_holiday := coalesce(
        v_holiday_part = 'full_day' or v_holiday_part = v_part,
        false
      );
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

revoke all on function public.time_off_calculate_duration(
  uuid, date, date, text, text, uuid
) from public, anon;
grant execute on function public.time_off_calculate_duration(
  uuid, date, date, text, text, uuid
) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
