create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  singleton_key boolean not null default true,
  company_name text not null default 'Despacho Inc.',
  legal_name text,
  address_line_1 text,
  address_line_2 text,
  city text,
  state_province text,
  postal_code text,
  country text,
  business_email text,
  website text,
  phone text,
  logo_url text,
  invoice_logo_url text,
  default_currency text not null default 'USD',
  default_payment_terms_days integer not null default 7,
  invoice_number_prefix text,
  invoice_number_start integer not null default 1001,
  default_tax_rate numeric(8,4) not null default 0,
  tax_label text not null default 'Tax',
  tax_registration_number text,
  bank_name text,
  bank_address text,
  institution_number text,
  routing_number text,
  swift_bic text,
  transit_number text,
  account_number text,
  account_name text,
  payment_instructions text,
  default_invoice_notes text,
  default_reminder_before_due_days integer[] not null default '{}',
  default_reminder_after_due_days integer[] not null default '{}',
  default_reminder_subject text,
  default_friendly_reminder_message text,
  default_overdue_reminder_message text,
  default_recurring_frequency text not null default 'monthly',
  default_recurring_generate_as_draft boolean not null default true,
  timezone text not null default 'Asia/Kolkata',
  date_format text not null default 'DD MMM YYYY',
  time_format text not null default '12h',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint company_settings_singleton_key_check check (singleton_key = true),
  constraint company_settings_payment_terms_check check (default_payment_terms_days >= 0),
  constraint company_settings_invoice_number_start_check check (invoice_number_start > 0),
  constraint company_settings_tax_rate_check check (default_tax_rate >= 0),
  constraint company_settings_currency_check check (default_currency in ('USD', 'CAD', 'INR')),
  constraint company_settings_time_format_check check (time_format in ('12h', '24h')),
  constraint company_settings_date_format_check check (date_format in ('DD MMM YYYY', 'DD-MM-YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD')),
  constraint company_settings_recurring_frequency_check check (default_recurring_frequency in ('monthly', 'quarterly', 'annually', 'custom'))
);

alter table public.company_settings
  add column if not exists default_reminder_subject text,
  add column if not exists default_friendly_reminder_message text,
  add column if not exists default_overdue_reminder_message text;

create unique index if not exists company_settings_singleton_idx
  on public.company_settings(singleton_key);

insert into public.company_settings (
  singleton_key,
  company_name,
  legal_name,
  address_line_1,
  city,
  state_province,
  postal_code,
  country,
  business_email,
  website,
  logo_url,
  invoice_logo_url,
  bank_name,
  bank_address,
  institution_number,
  routing_number,
  swift_bic,
  transit_number,
  account_number,
  account_name,
  payment_instructions,
  default_reminder_before_due_days,
  default_reminder_after_due_days,
  default_reminder_subject,
  default_friendly_reminder_message,
  default_overdue_reminder_message
)
values (
  true,
  'Despacho Inc.',
  'Despacho Inc.',
  '900, 332 6th Avenue S.W.',
  'Calgary',
  'Alberta',
  'T2P 0B1',
  'Canada',
  'sales@despacho.io',
  'https://www.despacho.io',
  '/kairo-logo-full.png',
  '/despacho-logo-full.png',
  'Royal Bank of Canada',
  'P.O. BAG SERVICE 2650, Calgary, Alberta, Canada T2P 2M7',
  '003',
  '021000021',
  'ROYCCAT2',
  '01549',
  '4002036',
  'Despacho Inc',
  'Thank you for choosing Despacho.',
  array[7, 3, 1],
  array[1, 7, 14, 30],
  'Payment reminder for Invoice #{{invoice_number}}',
  E'Hi {{client_name}},\n\nThis is a friendly reminder that Invoice #{{invoice_number}} for {{amount}} is due on {{due_date}}.\n\nThank you.\n\nRegards,\n{{company_name}}',
  E'Hi {{client_name}},\n\nInvoice #{{invoice_number}} for {{amount}} was due on {{due_date}} and remains outstanding.\n\nPlease arrange payment at your earliest convenience.\n\nRegards,\n{{company_name}}'
)
on conflict (singleton_key) do nothing;

create or replace function public.set_company_settings_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists company_settings_set_updated_at on public.company_settings;
create trigger company_settings_set_updated_at
before update on public.company_settings
for each row execute function public.set_company_settings_updated_at();

alter table public.company_settings enable row level security;

drop policy if exists company_settings_admin_all on public.company_settings;
create policy company_settings_admin_all
  on public.company_settings for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.user_id = auth.uid()
        and lower(trim(coalesce(profiles.role, ''))) = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.user_id = auth.uid()
        and lower(trim(coalesce(profiles.role, ''))) = 'admin'
    )
  );

drop policy if exists company_settings_manager_read on public.company_settings;

notify pgrst, 'reload schema';
