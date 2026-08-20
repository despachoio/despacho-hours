begin;

-- Workforce Overview and annual Reviews both filter the high-volume
-- time_entries table by employee and a bounded date range.  INCLUDE keeps the
-- aggregation inputs available to an index-only scan when PostgreSQL can use
-- one, without changing uniqueness or write behaviour.
create index if not exists time_entries_employee_entry_date_metrics_idx
  on public.time_entries(employee_id, entry_date)
  include (project_id, hours);

-- Direct-report scope is used by both the Overview and Organization Chart.
create index if not exists employees_reporting_status_idx
  on public.employees(reporting_manager_id, status, id);

-- Expected-capacity calculation only needs approved working leave slots for
-- the visible workforce and selected period.
create index if not exists leave_request_days_employee_date_working_idx
  on public.leave_request_days(employee_id, leave_date)
  where is_working_day = true
    and status in ('approved', 'cancellation_requested');

create or replace function public.get_workforce_overview_employees()
returns table (
  id uuid,
  employee_code text,
  title text,
  name text,
  email text,
  role text,
  department text,
  reporting_manager_id uuid,
  reporting_manager_name text,
  reporting_manager_title text,
  status text
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
  )
  select
    employee.id,
    case when actor.role = 'manager' then null else employee.employee_code end,
    employee.title,
    employee.name,
    case when actor.role = 'manager' then '' else employee.email end,
    employee.role,
    employee.department,
    employee.reporting_manager_id,
    manager.name,
    manager.title,
    employee.status
  from public.employees employee
  cross join actor
  left join public.employees manager
    on manager.id = employee.reporting_manager_id
  where
    actor.role in ('admin', 'super admin', 'finance admin')
    or (actor.role = 'employee' and employee.id = actor.employee_id)
    or (
      actor.role = 'manager'
      and employee.reporting_manager_id = actor.employee_id
      and lower(trim(coalesce(employee.status, 'active'))) = 'active'
    )
  order by employee.created_at;
$$;

revoke all on function public.get_workforce_overview_employees()
  from public, anon;
grant execute on function public.get_workforce_overview_employees()
  to authenticated, service_role;

create or replace function public.get_workforce_overview_time_summary(
  p_start_date date,
  p_end_date date
)
returns table (
  employee_id uuid,
  total_hours numeric,
  billable_hours numeric,
  entry_count bigint,
  longest_session numeric,
  project_ids uuid[],
  client_ids uuid[]
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
  )
  select
    entry.employee_id,
    coalesce(sum(entry.hours), 0)::numeric as total_hours,
    coalesce(
      sum(entry.hours) filter (where project.is_billable is not false),
      0
    )::numeric as billable_hours,
    count(*)::bigint as entry_count,
    coalesce(max(entry.hours), 0)::numeric as longest_session,
    array_agg(distinct entry.project_id)
      filter (where entry.project_id is not null) as project_ids,
    array_agg(distinct project.client_id)
      filter (where project.client_id is not null) as client_ids
  from public.time_entries entry
  join public.employees employee on employee.id = entry.employee_id
  left join public.projects project on project.id = entry.project_id
  cross join actor
  where entry.entry_date between p_start_date and p_end_date
    and (
      actor.role in ('admin', 'super admin', 'finance admin')
      or (actor.role = 'employee' and entry.employee_id = actor.employee_id)
      or (
        actor.role = 'manager'
        and employee.reporting_manager_id = actor.employee_id
        and lower(trim(coalesce(employee.status, 'active'))) = 'active'
      )
    )
  group by entry.employee_id;
$$;

revoke all on function public.get_workforce_overview_time_summary(date, date)
  from public, anon;
grant execute on function public.get_workforce_overview_time_summary(date, date)
  to authenticated, service_role;

-- Server-only Reviews aggregate.  The API establishes and validates the
-- authorized employee scope before calling this function.  It is deliberately
-- unavailable to browser/authenticated clients.
create or replace function public.get_performance_billable_monthly_summary(
  p_start_date date,
  p_end_date date,
  p_employee_ids uuid[]
)
returns table (
  employee_id uuid,
  month_start date,
  billable_hours numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    entry.employee_id,
    date_trunc('month', entry.entry_date)::date as month_start,
    coalesce(sum(entry.hours), 0)::numeric as billable_hours
  from public.time_entries entry
  join public.projects project on project.id = entry.project_id
  where entry.entry_date between p_start_date and p_end_date
    and entry.employee_id = any(p_employee_ids)
    and project.is_billable = true
  group by entry.employee_id, date_trunc('month', entry.entry_date)
  order by entry.employee_id, month_start;
$$;

revoke all on function public.get_performance_billable_monthly_summary(
  date,
  date,
  uuid[]
) from public, anon, authenticated;
grant execute on function public.get_performance_billable_monthly_summary(
  date,
  date,
  uuid[]
) to service_role;

comment on function public.get_workforce_overview_time_summary(date, date) is
  'Role-scoped, date-bounded Workforce metrics aggregated inside PostgreSQL.';
comment on function public.get_performance_billable_monthly_summary(
  date,
  date,
  uuid[]
) is
  'Server-only monthly billable-hours aggregation for an authorized review scope.';

commit;
