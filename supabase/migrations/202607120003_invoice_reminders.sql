alter table public.invoices
  add column if not exists sent_cc text,
  add column if not exists reminders_enabled boolean not null default true,
  add column if not exists reminders_stopped_at timestamptz,
  add column if not exists reminders_stopped_by uuid references auth.users(id),
  add column if not exists reminders_stop_reason text,
  add column if not exists last_reminder_sent_at timestamptz,
  add column if not exists next_reminder_at timestamptz,
  add column if not exists reminder_count integer not null default 0;

create table if not exists public.invoice_reminders (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  sent_to text not null,
  cc text,
  subject text not null,
  message text not null,
  gmail_message_id text,
  reminder_number integer not null,
  scheduled_for date,
  sent_at timestamptz not null default now(),
  sent_by uuid references auth.users(id),
  send_type text not null default 'automatic',
  status text not null default 'sent',
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.invoice_reminders
  drop constraint if exists invoice_reminders_send_type_check,
  drop constraint if exists invoice_reminders_status_check;

alter table public.invoice_reminders
  add constraint invoice_reminders_send_type_check
    check (send_type in ('automatic', 'manual')),
  add constraint invoice_reminders_status_check
    check (status in ('sent', 'failed', 'skipped'));

create unique index if not exists invoice_reminders_unique_automatic_schedule
  on public.invoice_reminders(invoice_id, scheduled_for)
  where send_type = 'automatic';

alter table public.invoice_reminders enable row level security;

drop policy if exists invoice_reminders_admin_all on public.invoice_reminders;
create policy invoice_reminders_admin_all
  on public.invoice_reminders for all to authenticated
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

drop policy if exists invoice_reminders_manager_read on public.invoice_reminders;

create or replace function public.enforce_invoice_reminder_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if lower(coalesce(new.status, '')) in ('paid', 'void', 'cancelled') then
    new.reminders_enabled := false;
    new.next_reminder_at := null;
  elsif lower(coalesce(old.status, '')) = 'paid'
    and lower(coalesce(new.status, '')) = 'sent' then
    new.reminders_enabled := false;
    new.next_reminder_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_enforce_reminder_status on public.invoices;
create trigger invoices_enforce_reminder_status
before update of status on public.invoices
for each row execute function public.enforce_invoice_reminder_status();

update public.invoices
set next_reminder_at = ((due_date + 1)::timestamp at time zone 'Asia/Kolkata')
where lower(coalesce(status, '')) in ('sent', 'overdue')
  and reminders_enabled = true
  and next_reminder_at is null;

notify pgrst, 'reload schema';
