begin;

alter table public.payroll_settings
  add column if not exists ytd_password_protection boolean not null default true,
  add column if not exists performance_password_protection boolean not null default true;

alter table public.payslip_distributions
  add column if not exists password_rule_used text;

alter table public.payslip_distributions
  drop constraint if exists payslip_distributions_password_rule_used_check;

alter table public.payslip_distributions
  add constraint payslip_distributions_password_rule_used_check
  check (password_rule_used is null or password_rule_used in ('employee_code_dob', 'employee_code', 'dob'));

update public.payroll_settings
set payslip_password_protection = coalesce(payslip_password_protection, true),
    ytd_password_protection = coalesce(ytd_password_protection, true),
    performance_password_protection = coalesce(performance_password_protection, true),
    payslip_password_rule = coalesce(payslip_password_rule, 'employee_code_dob')
where singleton_key = true;

commit;
