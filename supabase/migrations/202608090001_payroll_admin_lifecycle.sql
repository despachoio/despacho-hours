begin;

drop policy if exists payroll_settings_finance_all on public.payroll_settings;
drop policy if exists salary_structures_finance_all on public.salary_structures;
drop policy if exists payroll_runs_finance_all on public.payroll_runs;
drop policy if exists payroll_entries_finance_all on public.payroll_entries;
drop policy if exists payroll_audit_finance_read on public.payroll_audit_log;

create policy payroll_settings_admin_all on public.payroll_settings for all to authenticated
using (public.get_my_actual_role() in ('finance admin', 'super admin', 'admin'))
with check (public.get_my_actual_role() in ('finance admin', 'super admin', 'admin'));

create policy salary_structures_admin_all on public.salary_structures for all to authenticated
using (public.get_my_actual_role() in ('finance admin', 'super admin', 'admin'))
with check (public.get_my_actual_role() in ('finance admin', 'super admin', 'admin'));

create policy payroll_runs_admin_all on public.payroll_runs for all to authenticated
using (public.get_my_actual_role() in ('finance admin', 'super admin', 'admin'))
with check (public.get_my_actual_role() in ('finance admin', 'super admin', 'admin'));

create policy payroll_entries_admin_all on public.payroll_entries for all to authenticated
using (public.get_my_actual_role() in ('finance admin', 'super admin', 'admin'))
with check (public.get_my_actual_role() in ('finance admin', 'super admin', 'admin'));

create policy payroll_audit_admin_read on public.payroll_audit_log for select to authenticated
using (public.get_my_actual_role() in ('finance admin', 'super admin', 'admin'));

commit;
