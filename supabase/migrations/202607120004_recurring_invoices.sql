create table if not exists public.recurring_invoice_schedules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  name text not null,
  status text not null default 'active',
  frequency text not null,
  interval_count integer not null default 1,
  start_date date not null,
  end_date date,
  next_generation_date date not null,
  last_generated_at timestamptz,
  last_generated_invoice_id uuid references public.invoices(id),
  currency text not null,
  payment_terms_days integer not null default 7,
  tax_amount numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  notes text,
  email_to text,
  email_cc text,
  email_subject text,
  email_body text,
  auto_send boolean not null default false,
  autopay_enabled boolean not null default false,
  autopay_provider text,
  autopay_customer_reference text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recurring_invoice_schedules
  drop constraint if exists recurring_invoice_schedules_status_check,
  drop constraint if exists recurring_invoice_schedules_frequency_check,
  drop constraint if exists recurring_invoice_schedules_interval_check,
  drop constraint if exists recurring_invoice_schedules_dates_check;

alter table public.recurring_invoice_schedules
  add constraint recurring_invoice_schedules_status_check
    check (status in ('active', 'paused', 'cancelled', 'completed')),
  add constraint recurring_invoice_schedules_frequency_check
    check (frequency in ('weekly', 'monthly', 'quarterly', 'yearly', 'custom')),
  add constraint recurring_invoice_schedules_interval_check
    check (interval_count > 0),
  add constraint recurring_invoice_schedules_dates_check
    check (end_date is null or end_date >= start_date);

create table if not exists public.recurring_invoice_items (
  id uuid primary key default gen_random_uuid(),
  recurring_schedule_id uuid not null references public.recurring_invoice_schedules(id) on delete cascade,
  project_id uuid references public.projects(id) on delete restrict,
  description text not null,
  hours numeric(12,2) not null default 0,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recurring_invoice_occurrences (
  id uuid primary key default gen_random_uuid(),
  recurring_schedule_id uuid not null references public.recurring_invoice_schedules(id) on delete cascade,
  scheduled_date date not null,
  status text not null default 'pending',
  issue_date date,
  due_date date,
  currency text,
  tax_amount numeric(12,2),
  discount_amount numeric(12,2),
  notes text,
  email_to text,
  email_cc text,
  email_subject text,
  email_body text,
  generated_invoice_id uuid references public.invoices(id),
  skip_reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(recurring_schedule_id, scheduled_date)
);

alter table public.recurring_invoice_occurrences
  drop constraint if exists recurring_invoice_occurrences_status_check;

alter table public.recurring_invoice_occurrences
  add constraint recurring_invoice_occurrences_status_check
    check (status in ('pending', 'generated', 'skipped', 'cancelled'));

create table if not exists public.recurring_invoice_occurrence_items (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.recurring_invoice_occurrences(id) on delete cascade,
  project_id uuid references public.projects(id) on delete restrict,
  description text not null,
  hours numeric(12,2) not null default 0,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  sort_order integer not null default 0
);

alter table public.invoices
  add column if not exists discount_amount numeric(12,2) not null default 0,
  add column if not exists recurring_schedule_id uuid references public.recurring_invoice_schedules(id),
  add column if not exists recurring_occurrence_id uuid references public.recurring_invoice_occurrences(id),
  add column if not exists recurring_period_start date,
  add column if not exists recurring_period_end date,
  add column if not exists generated_from_recurring boolean not null default false,
  add column if not exists draft_email_to text,
  add column if not exists draft_email_cc text,
  add column if not exists draft_email_subject text,
  add column if not exists draft_email_body text;

create unique index if not exists invoices_unique_recurring_occurrence
  on public.invoices(recurring_occurrence_id)
  where recurring_occurrence_id is not null;

create index if not exists recurring_occurrences_upcoming_idx
  on public.recurring_invoice_occurrences(status, scheduled_date);

create index if not exists recurring_schedules_generation_idx
  on public.recurring_invoice_schedules(status, next_generation_date);

create or replace function public.set_recurring_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists recurring_schedules_set_updated_at on public.recurring_invoice_schedules;
create trigger recurring_schedules_set_updated_at before update on public.recurring_invoice_schedules
for each row execute function public.set_recurring_updated_at();

drop trigger if exists recurring_items_set_updated_at on public.recurring_invoice_items;
create trigger recurring_items_set_updated_at before update on public.recurring_invoice_items
for each row execute function public.set_recurring_updated_at();

drop trigger if exists recurring_occurrences_set_updated_at on public.recurring_invoice_occurrences;
create trigger recurring_occurrences_set_updated_at before update on public.recurring_invoice_occurrences
for each row execute function public.set_recurring_updated_at();

alter table public.recurring_invoice_schedules enable row level security;
alter table public.recurring_invoice_items enable row level security;
alter table public.recurring_invoice_occurrences enable row level security;
alter table public.recurring_invoice_occurrence_items enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'recurring_invoice_schedules',
    'recurring_invoice_items',
    'recurring_invoice_occurrences',
    'recurring_invoice_occurrence_items'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_admin_all', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (exists (select 1 from public.profiles where profiles.user_id = auth.uid() and lower(trim(coalesce(profiles.role, ''''))) = ''admin'')) with check (exists (select 1 from public.profiles where profiles.user_id = auth.uid() and lower(trim(coalesce(profiles.role, ''''))) = ''admin''))',
      table_name || '_admin_all', table_name
    );
    -- Existing Kairo invoice navigation is Admin-only. Keep Manager access closed
    -- unless a future invoice-visibility policy explicitly enables it.
    execute format('drop policy if exists %I on public.%I', table_name || '_manager_read', table_name);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
