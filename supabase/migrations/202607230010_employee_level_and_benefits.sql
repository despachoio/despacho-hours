begin;

alter table public.employees
  add column if not exists level text;

create table if not exists public.employee_benefit_details (
  employee_id uuid primary key
    references public.employees(id)
    on delete cascade,
  accidental_policy_number text,
  accidental_policy_expiration_date date,
  health_policy_number text,
  health_policy_expiration_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employee_benefit_details enable row level security;

revoke all on table public.employee_benefit_details from public, anon;
grant select, insert, update, delete
  on table public.employee_benefit_details
  to authenticated, service_role;

drop policy if exists employee_benefit_details_privileged_read
  on public.employee_benefit_details;
drop policy if exists employee_benefit_details_self_read
  on public.employee_benefit_details;
drop policy if exists employee_benefit_details_finance_admin_all
  on public.employee_benefit_details;

-- Admin and Super Admin may view policy information while managing a profile.
-- Employees may view their own coverage. Only Finance Admin can change it.
create policy employee_benefit_details_privileged_read
on public.employee_benefit_details for select to authenticated
using (
  public.get_my_actual_role() in (
    'finance admin',
    'super admin',
    'admin'
  )
);

create policy employee_benefit_details_self_read
on public.employee_benefit_details for select to authenticated
using (employee_id = public.get_my_employee_id());

create policy employee_benefit_details_finance_admin_all
on public.employee_benefit_details to authenticated
using (public.get_my_actual_role() = 'finance admin')
with check (public.get_my_actual_role() = 'finance admin');

comment on table public.employee_benefit_details is
  'Employee insurance policy information; Finance Admin maintained, employee self-readable.';

commit;
