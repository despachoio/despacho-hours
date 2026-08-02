begin;

-- Kairo Payroll: normalized configuration, versioned structures, immutable snapshots and audit.
create table if not exists public.payroll_settings (
  id uuid primary key default gen_random_uuid(),
  singleton_key boolean not null default true unique check (singleton_key),
  period_start_day integer not null default 26 check (period_start_day between 1 and 28),
  period_end_day integer not null default 25 check (period_end_day between 1 and 28),
  currency text not null default 'INR',
  professional_tax_threshold numeric(14,2) not null default 25000,
  professional_tax_amount numeric(14,2) not null default 200,
  conveyance_allowance numeric(14,2) not null default 1600,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.payroll_settings(singleton_key) values (true)
on conflict (singleton_key) do nothing;

create table if not exists public.salary_structures (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  version integer not null,
  gross_salary numeric(14,2) not null check (gross_salary >= 0),
  effective_from date not null,
  effective_to date,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique(employee_id, version),
  check (effective_to is null or effective_to >= effective_from)
);
create unique index if not exists salary_structures_one_active_idx
on public.salary_structures(employee_id) where is_active;

create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  payroll_month date not null unique check (payroll_month = date_trunc('month', payroll_month)::date),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft','under_review','approved','locked','published')),
  employee_count integer not null default 0,
  gross_payroll numeric(16,2) not null default 0,
  net_payroll numeric(16,2) not null default 0,
  employer_pf_total numeric(16,2) not null default 0,
  employer_eps_total numeric(16,2) not null default 0,
  generated_at timestamptz not null default now(),
  generated_by uuid references auth.users(id),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  locked_at timestamptz,
  locked_by uuid references auth.users(id),
  published_at timestamptz,
  published_by uuid references auth.users(id),
  cancellation_reason text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  check (period_end >= period_start)
);

create table if not exists public.payroll_entries (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  salary_structure_id uuid not null references public.salary_structures(id) on delete restrict,
  salary_structure_version integer not null,
  employee_code text not null,
  employee_name text not null,
  department text,
  payroll_month date not null,
  period_start date not null,
  period_end date not null,
  gross_salary numeric(14,2) not null,
  basic_pay numeric(14,2) not null,
  hra numeric(14,2) not null,
  conveyance_allowance numeric(14,2) not null,
  other_allowance numeric(14,2) not null,
  bonus numeric(14,2) not null default 0,
  leave_encashment numeric(14,2) not null default 0,
  reimbursements numeric(14,2) not null default 0,
  epf_salary numeric(14,2) not null,
  employee_pf numeric(14,2) not null,
  employer_pf numeric(14,2) not null,
  employer_eps numeric(14,2) not null,
  employer_total_contribution numeric(14,2) not null,
  professional_tax numeric(14,2) not null,
  lop_days numeric(8,2) not null default 0,
  lop_recommended numeric(14,2) not null default 0,
  lop_deduction numeric(14,2) not null default 0,
  previous_month_adjustment numeric(14,2) not null default 0,
  tds numeric(14,2) not null default 0,
  total_earnings numeric(14,2) not null,
  total_deductions numeric(14,2) not null,
  net_salary numeric(14,2) not null,
  status text not null default 'draft' check (status in ('draft','under_review','approved','locked','published')),
  published_at timestamptz,
  manual_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(payroll_run_id, employee_id)
);

create table if not exists public.payroll_reimbursements (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  payroll_month date not null,
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  status text not null default 'approved' check (status in ('pending','approved','paid','rejected')),
  payroll_entry_id uuid references public.payroll_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists public.payroll_audit_log (
  id bigint generated always as identity primary key,
  payroll_run_id uuid references public.payroll_runs(id) on delete set null,
  payroll_entry_id uuid references public.payroll_entries(id) on delete set null,
  salary_structure_id uuid references public.salary_structures(id) on delete set null,
  action text not null,
  actor_user_id uuid not null references auth.users(id),
  actor_role text not null,
  reason text,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payroll_entries_employee_month_idx on public.payroll_entries(employee_id, payroll_month desc);
create index if not exists payroll_reimbursements_employee_month_idx on public.payroll_reimbursements(employee_id, payroll_month desc);
create index if not exists payroll_audit_run_idx on public.payroll_audit_log(payroll_run_id, created_at desc);

alter table public.payroll_settings enable row level security;
alter table public.salary_structures enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payroll_entries enable row level security;
alter table public.payroll_reimbursements enable row level security;
alter table public.payroll_audit_log enable row level security;

create policy payroll_settings_finance_all on public.payroll_settings for all to authenticated
using (public.get_my_actual_role() = 'finance admin') with check (public.get_my_actual_role() = 'finance admin');
create policy salary_structures_finance_all on public.salary_structures for all to authenticated
using (public.get_my_actual_role() = 'finance admin') with check (public.get_my_actual_role() = 'finance admin');
create policy payroll_runs_finance_all on public.payroll_runs for all to authenticated
using (public.get_my_actual_role() = 'finance admin') with check (public.get_my_actual_role() = 'finance admin');
create policy payroll_entries_finance_all on public.payroll_entries for all to authenticated
using (public.get_my_actual_role() = 'finance admin') with check (public.get_my_actual_role() = 'finance admin');
create policy payroll_entries_employee_published on public.payroll_entries for select to authenticated
using (employee_id = public.get_my_employee_id() and published_at is not null and status = 'published');
create policy payroll_reimbursements_finance_all on public.payroll_reimbursements for all to authenticated
using (public.get_my_actual_role() = 'finance admin') with check (public.get_my_actual_role() = 'finance admin');
create policy payroll_reimbursements_employee_read on public.payroll_reimbursements for select to authenticated
using (employee_id = public.get_my_employee_id());
create policy payroll_audit_finance_read on public.payroll_audit_log for select to authenticated
using (public.get_my_actual_role() = 'finance admin');

revoke all on public.payroll_settings, public.salary_structures, public.payroll_runs,
  public.payroll_entries, public.payroll_reimbursements, public.payroll_audit_log from anon;
grant select on public.payroll_settings, public.salary_structures, public.payroll_runs,
  public.payroll_entries, public.payroll_reimbursements, public.payroll_audit_log to authenticated;
grant insert, update, delete on public.payroll_settings, public.salary_structures, public.payroll_runs,
  public.payroll_entries, public.payroll_reimbursements to authenticated;
grant usage, select on sequence public.payroll_audit_log_id_seq to authenticated;

comment on table public.payroll_entries is 'Immutable payroll-month snapshots. Published employee views must never recalculate from live structures.';

commit;
