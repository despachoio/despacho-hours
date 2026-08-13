begin;

alter table public.payroll_settings
  add column if not exists payslip_distribution_method text not null default 'notify_and_attach'
    check (payslip_distribution_method in ('notify_only','protected_pdf_only','notify_and_attach')),
  add column if not exists payslip_password_protection boolean not null default true,
  add column if not exists payslip_password_rule text not null default 'employee_code_dob'
    check (payslip_password_rule in ('employee_code_dob','employee_code','dob')),
  add column if not exists payslip_email_subject text not null default 'Salary Slip - {{Month}} {{Year}}',
  add column if not exists payslip_email_template text not null default E'Hi {{EmployeeName}},\n\nYour salary slip for {{PayrollMonth}} is now available.\n\nYou can download it from the Kairo Employee Portal.{{AttachmentMessage}}\n\nPassword: {{PasswordRuleDescription}}\n\nRegards,\nPayroll Team\nDespacho Inc.';

create table if not exists public.payslip_distributions (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  payroll_entry_id uuid not null references public.payroll_entries(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  payslip_status text not null default 'pending' check (payslip_status in ('pending','generating','generated','failed')),
  storage_path text,
  generated_by uuid references auth.users(id),
  generated_at timestamptz,
  password_protected boolean not null default false,
  email_status text not null default 'pending' check (email_status in ('pending','sending','completed','failed','not_required')),
  email_message_id text,
  email_sent_at timestamptz,
  email_error text,
  last_retry_at timestamptz,
  last_download_at timestamptz,
  downloaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(payroll_entry_id)
);
create index if not exists payslip_distributions_run_idx on public.payslip_distributions(payroll_run_id, email_status);

alter table public.payslip_distributions enable row level security;
create policy payslip_distributions_finance_all on public.payslip_distributions for all to authenticated
using (public.get_my_actual_role() = 'finance admin') with check (public.get_my_actual_role() = 'finance admin');
create policy payslip_distributions_employee_read on public.payslip_distributions for select to authenticated
using (employee_id = public.get_my_employee_id());
revoke all on public.payslip_distributions from anon;
grant select, insert, update, delete on public.payslip_distributions to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payroll-payslips', 'payroll-payslips', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

commit;
