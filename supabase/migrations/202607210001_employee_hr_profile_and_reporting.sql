begin;

alter table public.employees
  add column if not exists title text,
  add column if not exists gender text,
  add column if not exists date_of_joining date,
  add column if not exists date_of_birth date,
  add column if not exists epf_number text,
  add column if not exists uan_number text,
  add column if not exists reporting_manager_id uuid;

alter table public.employees
  drop constraint if exists employees_title_check,
  add constraint employees_title_check
    check (title is null or title in ('Mr', 'Miss', 'Mrs.', 'Dr')),
  drop constraint if exists employees_gender_check,
  add constraint employees_gender_check
    check (gender is null or gender in ('Male', 'Female', 'Others')),
  drop constraint if exists employees_reporting_manager_id_fkey,
  add constraint employees_reporting_manager_id_fkey
    foreign key (reporting_manager_id)
    references public.employees(id)
    on delete set null,
  drop constraint if exists employees_reporting_manager_not_self,
  add constraint employees_reporting_manager_not_self
    check (reporting_manager_id is null or reporting_manager_id <> id);

create index if not exists employees_reporting_manager_id_idx
  on public.employees(reporting_manager_id);

create or replace function public.get_my_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select employee_id
  from public.profiles
  where user_id = auth.uid()
  limit 1
$$;

create or replace function public.is_super_admin_employee(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where employee_id = p_employee_id
      and lower(trim(coalesce(role, ''))) = 'super admin'
  )
$$;

create or replace function public.validate_employee_reporting_manager()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reporting_manager_id is null then
    return new;
  end if;

  if new.reporting_manager_id = new.id then
    raise exception 'An employee cannot report to themselves';
  end if;

  if not exists (
    select 1
    from public.employees manager_employee
    join public.profiles manager_profile
      on manager_profile.employee_id = manager_employee.id
    where manager_employee.id = new.reporting_manager_id
      and lower(trim(coalesce(manager_profile.role, ''))) in (
        'manager', 'admin', 'super admin'
      )
      and lower(trim(coalesce(manager_employee.status, 'active'))) = 'active'
  ) then
    raise exception 'Reporting manager must be an active Manager, Admin, or Super Admin';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_employee_reporting_manager
  on public.employees;
drop trigger if exists validate_employee_reporting_manager_trigger
  on public.employees;
create trigger validate_employee_reporting_manager_trigger
before insert or update of reporting_manager_id on public.employees
for each row execute function public.validate_employee_reporting_manager();

create or replace function public.get_reporting_manager_options()
returns table (
  id uuid,
  name text,
  access_role text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    employee.id,
    concat_ws(' ', nullif(employee.title, ''), employee.name)::text,
    profile.role
  from public.profiles profile
  join public.employees employee on employee.id = profile.employee_id
  where lower(trim(coalesce(public.get_my_role(), ''))) in ('admin', 'super admin')
    and lower(trim(coalesce(profile.role, ''))) in ('manager', 'admin', 'super admin')
    and lower(trim(coalesce(employee.status, 'active'))) = 'active'
  order by
    case lower(trim(coalesce(profile.role, '')))
      when 'super admin' then 1
      when 'admin' then 2
      else 3
    end,
    employee.name;
$$;

revoke all on function public.get_my_employee_id() from public, anon;
revoke all on function public.is_super_admin_employee(uuid) from public, anon;
revoke all on function public.validate_employee_reporting_manager() from public, anon;
revoke all on function public.get_reporting_manager_options() from public, anon;
grant execute on function public.get_my_employee_id() to authenticated, service_role;
grant execute on function public.is_super_admin_employee(uuid) to authenticated, service_role;
grant execute on function public.get_reporting_manager_options() to authenticated, service_role;

drop policy if exists employees_super_admin_all on public.employees;
drop policy if exists employees_admin_all on public.employees;
drop policy if exists employees_admin_ordinary_all on public.employees;
drop policy if exists employees_staff_read on public.employees;
drop policy if exists employees_role_scoped_read on public.employees;
drop policy if exists employees_role_scoped_insert on public.employees;
drop policy if exists employees_role_scoped_update on public.employees;
drop policy if exists employees_role_scoped_delete on public.employees;
drop policy if exists employees_manager_direct_reports_read on public.employees;
drop policy if exists employees_self_read on public.employees;

create policy employees_super_admin_all
on public.employees to authenticated
using (lower(trim(coalesce(public.get_my_role(), ''))) = 'super admin')
with check (lower(trim(coalesce(public.get_my_role(), ''))) = 'super admin');

create policy employees_admin_ordinary_all
on public.employees to authenticated
using (
  lower(trim(coalesce(public.get_my_role(), ''))) = 'admin'
  and not public.is_super_admin_employee(id)
)
with check (
  lower(trim(coalesce(public.get_my_role(), ''))) = 'admin'
  and not public.is_super_admin_employee(id)
);

create policy employees_manager_direct_reports_read
on public.employees for select to authenticated
using (
  lower(trim(coalesce(public.get_my_role(), ''))) = 'manager'
  and reporting_manager_id = public.get_my_employee_id()
);

create policy employees_self_read
on public.employees for select to authenticated
using (id = public.get_my_employee_id());

commit;
