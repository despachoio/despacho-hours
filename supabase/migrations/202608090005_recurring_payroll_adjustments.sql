-- Finance-controlled recurring payroll inputs. Salary structures remain the
-- contractual source; these rows only contribute to future payroll snapshots.

create table if not exists public.recurring_payroll_adjustments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  adjustment_type text not null check (adjustment_type in ('earning', 'deduction')),
  component text not null check (component in ('bonus', 'tds')),
  amount numeric(14,2) not null check (amount >= 0),
  from_month date not null check (extract(day from from_month) = 1),
  to_month date check (to_month is null or extract(day from to_month) = 1),
  enabled boolean not null default true,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  check (to_month is null or to_month >= from_month),
  check ((adjustment_type = 'earning' and component = 'bonus') or (adjustment_type = 'deduction' and component = 'tds'))
);

create index if not exists recurring_payroll_adjustments_employee_idx on public.recurring_payroll_adjustments(employee_id);
create index if not exists recurring_payroll_adjustments_from_month_idx on public.recurring_payroll_adjustments(from_month);
create index if not exists recurring_payroll_adjustments_to_month_idx on public.recurring_payroll_adjustments(to_month);
create index if not exists recurring_payroll_adjustments_enabled_idx on public.recurring_payroll_adjustments(enabled);

alter table public.payroll_entries
  add column if not exists recurring_adjustment_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists manual_override_fields text[] not null default '{}'::text[];

alter table public.recurring_payroll_adjustments enable row level security;

-- Restore the payroll administration boundary to Finance Admin only. The
-- employee published-entry policy remains in place for self-service payslips.
drop policy if exists payroll_settings_admin_all on public.payroll_settings;
drop policy if exists salary_structures_admin_all on public.salary_structures;
drop policy if exists payroll_runs_admin_all on public.payroll_runs;
drop policy if exists payroll_entries_admin_all on public.payroll_entries;
drop policy if exists payroll_audit_admin_read on public.payroll_audit_log;

drop policy if exists payroll_settings_finance_all on public.payroll_settings;
create policy payroll_settings_finance_all on public.payroll_settings for all to authenticated
using (public.get_my_actual_role() = 'finance admin') with check (public.get_my_actual_role() = 'finance admin');
drop policy if exists salary_structures_finance_all on public.salary_structures;
create policy salary_structures_finance_all on public.salary_structures for all to authenticated
using (public.get_my_actual_role() = 'finance admin') with check (public.get_my_actual_role() = 'finance admin');
drop policy if exists payroll_runs_finance_all on public.payroll_runs;
create policy payroll_runs_finance_all on public.payroll_runs for all to authenticated
using (public.get_my_actual_role() = 'finance admin') with check (public.get_my_actual_role() = 'finance admin');
drop policy if exists payroll_entries_finance_all on public.payroll_entries;
create policy payroll_entries_finance_all on public.payroll_entries for all to authenticated
using (public.get_my_actual_role() = 'finance admin') with check (public.get_my_actual_role() = 'finance admin');
drop policy if exists payroll_audit_finance_read on public.payroll_audit_log;
create policy payroll_audit_finance_read on public.payroll_audit_log for select to authenticated
using (public.get_my_actual_role() = 'finance admin');

drop policy if exists recurring_payroll_adjustments_finance_all on public.recurring_payroll_adjustments;
create policy recurring_payroll_adjustments_finance_all on public.recurring_payroll_adjustments for all to authenticated
using (public.get_my_actual_role() = 'finance admin')
with check (public.get_my_actual_role() = 'finance admin');

revoke all on table public.recurring_payroll_adjustments from anon;
grant select, insert, update, delete on table public.recurring_payroll_adjustments to authenticated;

comment on table public.recurring_payroll_adjustments is
  'Finance-owned recurring payroll inputs applied only while generating future editable payroll snapshots.';
comment on column public.payroll_entries.recurring_adjustment_snapshot is
  'Immutable description of recurring master rows used when this payroll entry was generated.';
comment on column public.payroll_entries.manual_override_fields is
  'Payroll-entry fields intentionally overridden for this month and preserved during reprocessing.';
