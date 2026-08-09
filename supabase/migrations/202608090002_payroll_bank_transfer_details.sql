-- Store the processing date with each immutable payroll run and keep the
-- company's payroll debit-account identifiers separate from invoice banking.

alter table public.payroll_runs
  add column if not exists processing_date date;

update public.payroll_runs
set processing_date = coalesce(generated_at::date, payroll_month)
where processing_date is null;

alter table public.payroll_runs
  alter column processing_date set not null;

alter table public.company_settings
  add column if not exists payroll_bank_customer_id text,
  add column if not exists payroll_bank_account_number text,
  add column if not exists payroll_bank_ifsc_code text;

comment on column public.payroll_runs.processing_date is
  'Requested bank processing date captured when the payroll snapshot is generated.';

comment on column public.company_settings.payroll_bank_customer_id is
  'Customer identifier used in payroll bank transfer files.';

comment on column public.company_settings.payroll_bank_account_number is
  'Company debit account used in payroll bank transfer files.';

comment on column public.company_settings.payroll_bank_ifsc_code is
  'Company debit account IFSC used in payroll bank transfer files.';
