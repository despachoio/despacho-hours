begin;

create or replace function public.get_time_off_managed_employee_directory()
returns table (
  id uuid,
  employee_code text,
  title text,
  name text,
  department text,
  reporting_manager_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_current_employee_id uuid := public.get_my_employee_id();
  v_role text;
begin
  select lower(trim(profile.role)) into v_role
  from public.profiles profile
  where profile.user_id = auth.uid();

  if v_current_employee_id is null
    or v_role not in ('manager', 'admin', 'super admin', 'finance admin') then
    raise exception 'You do not have access to the managed employee directory.';
  end if;

  return query
  select
    employee.id,
    employee.employee_code,
    employee.title,
    employee.name,
    employee.department,
    employee.reporting_manager_id
  from public.employees employee
  where lower(trim(coalesce(employee.status, ''))) = 'active'
    and employee.id <> v_current_employee_id
    and (
      v_role in ('admin', 'super admin', 'finance admin')
      or employee.reporting_manager_id = v_current_employee_id
    )
  order by employee.employee_code nulls last, employee.name;
end;
$$;

revoke all on function public.get_time_off_managed_employee_directory()
from public, anon;
grant execute on function public.get_time_off_managed_employee_directory()
to authenticated;

comment on function public.get_time_off_managed_employee_directory() is
  'Returns only safe display fields for employees visible through Time Off reporting access.';

notify pgrst, 'reload schema';

commit;
