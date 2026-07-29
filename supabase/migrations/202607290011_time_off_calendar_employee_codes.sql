begin;

drop function if exists public.get_time_off_calendar(date, date);

create function public.get_time_off_calendar(
  p_from date,
  p_to date
)
returns table (
  id uuid,
  employee_id uuid,
  employee_name text,
  employee_code text,
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
  manager_name text,
  manager_code text
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
    employee.employee_code,
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
    manager.name,
    manager.employee_code
  from public.leave_requests request
  join public.employees employee on employee.id = request.employee_id
  join public.leave_types leave_type on leave_type.id = request.leave_type_id
  left join public.employees manager on manager.id = employee.reporting_manager_id
  where request.end_date >= p_from and request.start_date <= p_to
    and request.status in (
      'pending', 'approved', 'cancellation_requested', 'cancellation_rejected'
    )
  order by request.start_date, employee.employee_code, employee.name
$$;

revoke all on function public.get_time_off_calendar(date, date)
from public, anon;
grant execute on function public.get_time_off_calendar(date, date)
to authenticated;

notify pgrst, 'reload schema';

commit;
