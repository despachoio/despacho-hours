alter table public.payments
  add column if not exists status text not null default 'completed',
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by uuid references auth.users(id),
  add column if not exists reversal_reason text,
  add column if not exists reversal_notes text;

alter table public.payments
  drop constraint if exists payments_status_check;

alter table public.payments
  add constraint payments_status_check
  check (status in ('completed', 'reversed'));

alter table public.invoices
  add column if not exists payment_reversed_at timestamptz,
  add column if not exists payment_reversal_reason text;

alter table public.project_hour_transactions
  add column if not exists original_transaction_id uuid
    references public.project_hour_transactions(id);

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.project_hour_transactions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%transaction_type%'
  loop
    execute format(
      'alter table public.project_hour_transactions drop constraint %I',
      v_constraint.conname
    );
  end loop;

  alter table public.project_hour_transactions
    add constraint project_hour_transactions_transaction_type_check
    check (
      transaction_type in (
        'opening_credit',
        'invoice_credit',
        'invoice_credit_reversal',
        'time_debit',
        'manual_credit',
        'manual_debit',
        'adjustment',
        'refund'
      )
    );
exception
  when duplicate_object then null;
end;
$$;

drop index if exists public.payments_one_full_payment_per_invoice;
create unique index if not exists payments_one_completed_payment_per_invoice
  on public.payments(invoice_id)
  where stripe_payment_intent_id is null and status = 'completed';

drop index if exists public.project_hour_transactions_unique_invoice_item_credit;
create unique index if not exists project_hour_transactions_unique_payment_item_credit
  on public.project_hour_transactions(payment_id, invoice_item_id, transaction_type)
  where transaction_type = 'invoice_credit';

create unique index if not exists project_hour_transactions_unique_credit_reversal
  on public.project_hour_transactions(original_transaction_id)
  where transaction_type = 'invoice_credit_reversal';

create or replace function public.record_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_reference_number text,
  p_notes text,
  p_created_by uuid
)
returns table (
  payment_id uuid,
  invoice_status text,
  paid_at timestamptz,
  paid_amount numeric,
  payment_method text,
  payment_reference text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_payment_id uuid := gen_random_uuid();
  v_paid_at timestamptz;
  v_item record;
  v_billable_count integer;
begin
  select invoice_row.* into v_invoice
  from public.invoices as invoice_row
  where invoice_row.id = p_invoice_id
  for update;

  if not found then raise exception 'Invoice not found'; end if;

  if lower(coalesce(v_invoice.status, '')) = 'paid'
    or exists (
      select 1 from public.payments
      where invoice_id = p_invoice_id
        and stripe_payment_intent_id is null
        and status = 'completed'
    ) then
    raise exception 'Invoice has already been paid.';
  end if;

  if lower(coalesce(v_invoice.status, '')) = 'void' then
    raise exception 'Void invoices cannot be paid';
  end if;
  if lower(coalesce(v_invoice.status, '')) = 'cancelled' then
    raise exception 'Cancelled invoices cannot be paid';
  end if;
  if round(coalesce(p_amount, 0), 2) <> round(coalesce(v_invoice.total_amount, 0), 2) then
    raise exception 'Partial payments are not supported yet.';
  end if;

  select count(*) into v_billable_count
  from public.invoice_items
  where invoice_id = p_invoice_id
    and project_id is not null
    and coalesce(hours, 0) > 0;

  if v_billable_count = 0 then
    raise exception 'No billable invoice items found';
  end if;

  v_paid_at := p_payment_date::timestamp at time zone 'UTC';

  insert into public.payments (
    id, invoice_id, amount, currency, payment_date, payment_method,
    reference_number, notes, created_by, status
  ) values (
    v_payment_id, p_invoice_id, round(p_amount, 2), v_invoice.currency,
    p_payment_date, p_payment_method, nullif(trim(p_reference_number), ''),
    nullif(trim(p_notes), ''), p_created_by, 'completed'
  );

  insert into public.invoice_payments (
    id, invoice_id, payment_method, amount, currency, reference_number, paid_at
  ) values (
    v_payment_id, p_invoice_id, p_payment_method, round(p_amount, 2),
    v_invoice.currency, nullif(trim(p_reference_number), ''), v_paid_at
  );

  for v_item in
    select id, project_id, hours
    from public.invoice_items
    where invoice_id = p_invoice_id
      and project_id is not null
      and coalesce(hours, 0) > 0
    order by id
  loop
    insert into public.project_hour_transactions (
      project_id, invoice_id, invoice_item_id, payment_id, transaction_type,
      hours_delta, notes, source_key, created_by
    ) values (
      v_item.project_id, p_invoice_id, v_item.id, v_payment_id,
      'invoice_credit', v_item.hours,
      'Invoice #' || v_invoice.invoice_number || ' paid',
      'invoice-credit:' || v_payment_id || ':' || v_item.id,
      p_created_by
    );
  end loop;

  update public.invoices
  set status = 'paid',
      paid_at = v_paid_at,
      paid_amount = round(p_amount, 2),
      payment_method = p_payment_method,
      payment_reference = nullif(trim(p_reference_number), ''),
      payment_reversed_at = null,
      payment_reversal_reason = null
  where id = p_invoice_id;

  return query select v_payment_id, 'paid'::text, v_paid_at,
    round(p_amount, 2), p_payment_method,
    nullif(trim(p_reference_number), '');
exception
  when unique_violation then raise exception 'Invoice has already been paid.';
  when others then raise;
end;
$$;

drop function if exists public.reverse_invoice_payment(uuid, text, text, uuid);

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
      and lower(trim(coalesce(role, ''))) = 'admin'
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

revoke all on function public.reverse_invoice_payment(uuid, text, text, uuid) from public;
revoke all on function public.reverse_invoice_payment(uuid, text, text, uuid) from anon;
revoke all on function public.reverse_invoice_payment(uuid, text, text, uuid) from authenticated;
grant execute on function public.reverse_invoice_payment(uuid, text, text, uuid) to service_role;

revoke all on function public.record_invoice_payment(uuid, numeric, date, text, text, text, uuid) from public;
grant execute on function public.record_invoice_payment(uuid, numeric, date, text, text, text, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
