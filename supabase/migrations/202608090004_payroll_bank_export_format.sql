-- Bank-upload master fields are text so leading zeroes are preserved exactly.

alter table public.company_settings
  add column if not exists payroll_bank_branch_code text,
  add column if not exists payroll_bank_currency text default 'INR';

update public.company_settings
set payroll_bank_currency = 'INR'
where payroll_bank_currency is null or btrim(payroll_bank_currency) = '';

comment on column public.company_settings.payroll_bank_branch_code is
  'Branch code emitted unchanged in payroll bank transfer files; stored as text to preserve leading zeroes.';

comment on column public.company_settings.payroll_bank_currency is
  'ISO currency code emitted in payroll bank transfer files.';
