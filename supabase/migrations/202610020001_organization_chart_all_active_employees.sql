begin;

-- The organization chart is a company directory, not an HR profile read.
-- Return only the minimal hierarchy fields for every active employee and keep
-- profile navigation aligned with the existing self/direct-report/admin scope.
create or replace function public.get_organization_chart_employees()
returns table (
  id uuid,
  employee_code text,
  title text,
  name text,
  role text,
  department text,
  reporting_manager_id uuid,
  reporting_manager_name text,
  reporting_manager_title text,
  status text,
  can_view_profile boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with actor as (
    select
      public.get_my_actual_role() as role,
      public.get_my_employee_id() as employee_id
  ),
  chart as (
    select
      employee.id,
      employee.employee_code,
      employee.title,
      employee.name,
      employee.role,
      employee.department,
      employee.reporting_manager_id,
      manager.name as reporting_manager_name,
      manager.title as reporting_manager_title,
      employee.status,
      case
        when employee.id = actor.employee_id then true
        when actor.role in ('finance admin', 'super admin') then true
        when actor.role = 'admin'
          and lower(trim(coalesce(target_profile.role, 'employee')))
            not in ('finance admin', 'super admin') then true
        when actor.role = 'manager'
          and employee.reporting_manager_id = actor.employee_id then true
        else false
      end as can_view_profile
    from public.employees employee
    cross join actor
    left join public.employees manager
      on manager.id = employee.reporting_manager_id
    left join public.profiles target_profile
      on target_profile.employee_id = employee.id
    where lower(trim(coalesce(employee.status, 'active'))) = 'active'
  )
  select
    chart.id,
    case when chart.can_view_profile then chart.employee_code else null end,
    chart.title,
    chart.name,
    chart.role,
    chart.department,
    chart.reporting_manager_id,
    chart.reporting_manager_name,
    chart.reporting_manager_title,
    chart.status,
    chart.can_view_profile
  from chart
  order by chart.name, chart.id;
$$;

revoke all on function public.get_organization_chart_employees()
  from public, anon;
grant execute on function public.get_organization_chart_employees()
  to authenticated, service_role;

comment on function public.get_organization_chart_employees() is
  'Minimal active-workforce hierarchy visible to authenticated users; profile links remain role-scoped.';

commit;
