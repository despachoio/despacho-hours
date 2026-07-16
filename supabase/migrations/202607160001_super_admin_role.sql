begin;

-- Bootstrap the existing workspace owner before Admin loses invoice access.
update public.profiles
set role = 'Super Admin'
where lower(trim(coalesce(role, ''))) = 'admin';

-- Super Admin inherits all existing Admin operational access.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'active_timers',
    'clients',
    'employees',
    'project_resources',
    'projects',
    'project_notes',
    'time_entries',
    'project_hour_transactions',
    'client_contacts'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_super_admin_all', table_name);
    execute format(
      'create policy %I on public.%I to authenticated using (lower(trim(coalesce(public.get_my_role(), ''''))) = ''super admin'') with check (lower(trim(coalesce(public.get_my_role(), ''''))) = ''super admin'')',
      table_name || '_super_admin_all',
      table_name
    );
  end loop;
end
$$;

-- Admin can manage ordinary profiles but cannot create, modify, or demote a
-- Super Admin. This prevents restoring invoice access by changing roles.
drop policy if exists "Only admin updates profiles" on public.profiles;
drop policy if exists "Super Admins can update profiles" on public.profiles;
drop policy if exists "Admins can update non-super-admin profiles" on public.profiles;
drop policy if exists "Super Admins can insert profiles" on public.profiles;
drop policy if exists "Admins can insert non-super-admin profiles" on public.profiles;
drop policy if exists "Super Admins can delete profiles" on public.profiles;
drop policy if exists "Profiles read access" on public.profiles;

create policy "Profiles read access"
on public.profiles for select to authenticated
using (
  lower(trim(coalesce(public.get_my_role(), ''))) in ('super admin', 'admin', 'manager')
  or user_id = auth.uid()
);

create policy "Super Admins can update profiles"
on public.profiles for update to authenticated
using (lower(trim(coalesce(public.get_my_role(), ''))) = 'super admin')
with check (
  lower(trim(coalesce(public.get_my_role(), ''))) = 'super admin'
  and lower(trim(coalesce(role, ''))) in ('super admin', 'admin', 'manager', 'employee')
);

create policy "Admins can update non-super-admin profiles"
on public.profiles for update to authenticated
using (
  lower(trim(coalesce(public.get_my_role(), ''))) = 'admin'
  and lower(trim(coalesce(role, ''))) <> 'super admin'
)
with check (
  lower(trim(coalesce(public.get_my_role(), ''))) = 'admin'
  and lower(trim(coalesce(role, ''))) in ('admin', 'manager', 'employee')
);

create policy "Super Admins can insert profiles"
on public.profiles for insert to authenticated
with check (
  lower(trim(coalesce(public.get_my_role(), ''))) = 'super admin'
  and lower(trim(coalesce(role, ''))) in ('super admin', 'admin', 'manager', 'employee')
);

create policy "Admins can insert non-super-admin profiles"
on public.profiles for insert to authenticated
with check (
  lower(trim(coalesce(public.get_my_role(), ''))) = 'admin'
  and lower(trim(coalesce(role, ''))) in ('admin', 'manager', 'employee')
);

create policy "Super Admins can delete profiles"
on public.profiles for delete to authenticated
using (lower(trim(coalesce(public.get_my_role(), ''))) = 'super admin');

-- Company settings contains bank details and invoice defaults. Admin accesses
-- only the general fields through the filtered server API; direct row access is
-- reserved for Super Admin.
drop policy if exists company_settings_admin_all on public.company_settings;
drop policy if exists company_settings_super_admin_all on public.company_settings;
create policy company_settings_super_admin_all
on public.company_settings to authenticated
using (lower(trim(coalesce(public.get_my_role(), ''))) = 'super admin')
with check (lower(trim(coalesce(public.get_my_role(), ''))) = 'super admin');

-- Replace all authenticated invoice policies with one Super Admin policy per
-- billing table. Service-role webhooks and scheduled jobs remain unaffected.
drop policy if exists "Admins can create invoice items" on public.invoice_items;
drop policy if exists "Admins can delete invoice items" on public.invoice_items;
drop policy if exists "Admins can update invoice items" on public.invoice_items;
drop policy if exists "Admins can view invoice items" on public.invoice_items;
drop policy if exists "Admins can create invoices" on public.invoices;
drop policy if exists "Admins can delete invoices" on public.invoices;
drop policy if exists "Admins can update invoices" on public.invoices;
drop policy if exists "Admins can view invoices" on public.invoices;
drop policy if exists invoice_activities_staff_read on public.invoice_activities;
drop policy if exists invoice_reminders_admin_all on public.invoice_reminders;
drop policy if exists payments_admin_all on public.payments;
drop policy if exists recurring_invoice_items_admin_all on public.recurring_invoice_items;
drop policy if exists recurring_invoice_occurrence_items_admin_all on public.recurring_invoice_occurrence_items;
drop policy if exists recurring_invoice_occurrences_admin_all on public.recurring_invoice_occurrences;
drop policy if exists recurring_invoice_schedules_admin_all on public.recurring_invoice_schedules;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'invoices',
    'invoice_items',
    'invoice_activities',
    'invoice_payments',
    'invoice_reminders',
    'payments',
    'recurring_invoices',
    'recurring_invoice_items',
    'recurring_invoice_occurrence_items',
    'recurring_invoice_occurrences',
    'recurring_invoice_schedules'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_super_admin_all', table_name);
    execute format(
      'create policy %I on public.%I to authenticated using (lower(trim(coalesce(public.get_my_role(), ''''))) = ''super admin'') with check (lower(trim(coalesce(public.get_my_role(), ''''))) = ''super admin'')',
      table_name || '_super_admin_all',
      table_name
    );
  end loop;
end
$$;

-- Invoice mutation RPCs are server-only. Recreate the reversal function so
-- its internal actor check recognizes Super Admin after the bootstrap.
create or replace function public.reverse_invoice_payment(
  p_invoice_id uuid,
  p_reason text,
  p_notes text,
  p_reversed_by uuid
)
returns table (
  invoice_id uuid,
  invoice_status text,
  payment_id uuid,
  total_reversed_hours numeric,
  projects_affected integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_payment public.payments%rowtype;
  v_credit record;
  v_total_hours numeric := 0;
  v_project_count integer := 0;
  v_reversed_at timestamptz := now();
begin
  if not exists (
    select 1 from public.profiles
    where user_id = p_reversed_by
      and lower(trim(coalesce(role, ''))) = 'super admin'
  ) then
    raise exception 'Forbidden';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Reversal reason is required';
  end if;

  select invoice_row.* into v_invoice
  from public.invoices as invoice_row
  where invoice_row.id = p_invoice_id
  for update;
  if not found then raise exception 'Invoice not found'; end if;

  if lower(coalesce(v_invoice.status, '')) <> 'paid' then
    if exists (
      select 1 from public.payments as prior_payment
      where prior_payment.invoice_id = p_invoice_id
        and prior_payment.status = 'reversed'
    ) then
      raise exception 'Payment has already been reversed.';
    end if;
    raise exception 'Invoice is not paid';
  end if;

  select payment_row.* into v_payment
  from public.payments as payment_row
  where payment_row.invoice_id = p_invoice_id
    and payment_row.status = 'completed'
  order by payment_row.created_at desc
  limit 1
  for update;
  if not found then raise exception 'Payment not found'; end if;

  if exists (
    select 1
    from public.project_hour_transactions as reversal_row
    where reversal_row.payment_id = v_payment.id
      and reversal_row.transaction_type = 'invoice_credit_reversal'
  ) then
    raise exception 'Payment has already been reversed.';
  end if;

  select coalesce(sum(abs(hours_delta)), 0), count(distinct project_id)
  into v_total_hours, v_project_count
  from public.project_hour_transactions as credit_summary
  where credit_summary.invoice_id = p_invoice_id
    and credit_summary.payment_id = v_payment.id
    and credit_summary.transaction_type = 'invoice_credit';

  if v_project_count = 0 then
    raise exception 'No wallet credits found for this payment';
  end if;

  for v_credit in
    select credit_row.*
    from public.project_hour_transactions as credit_row
    where credit_row.invoice_id = p_invoice_id
      and credit_row.payment_id = v_payment.id
      and credit_row.transaction_type = 'invoice_credit'
    order by credit_row.id
  loop
    insert into public.project_hour_transactions (
      project_id, invoice_id, invoice_item_id, payment_id,
      original_transaction_id, transaction_type, hours_delta,
      notes, source_key, created_by
    ) values (
      v_credit.project_id, v_credit.invoice_id, v_credit.invoice_item_id,
      v_credit.payment_id, v_credit.id, 'invoice_credit_reversal',
      v_credit.hours_delta * -1,
      'Payment reversed for Invoice #' || v_invoice.invoice_number,
      'invoice-credit-reversal:' || v_credit.id,
      p_reversed_by
    );
  end loop;

  update public.payments
  set status = 'reversed',
      reversed_at = v_reversed_at,
      reversed_by = p_reversed_by,
      reversal_reason = trim(p_reason),
      reversal_notes = nullif(trim(coalesce(p_notes, '')), '')
  where payments.id = v_payment.id;

  update public.invoices
  set status = 'sent',
      paid_at = null,
      paid_amount = null,
      payment_method = null,
      payment_reference = null,
      payment_reversed_at = v_reversed_at,
      payment_reversal_reason = trim(p_reason)
  where invoices.id = p_invoice_id;

  return query select p_invoice_id, 'sent'::text, v_payment.id,
    v_total_hours, v_project_count;
exception
  when unique_violation then raise exception 'Payment has already been reversed.';
  when others then raise;
end;
$$;

revoke all on function public.record_invoice_payment(
  uuid, numeric, date, text, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.record_invoice_payment(
  uuid, numeric, date, text, text, text, uuid
) to service_role;

revoke all on function public.reverse_invoice_payment(
  uuid, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.reverse_invoice_payment(
  uuid, text, text, uuid
) to service_role;

commit;
