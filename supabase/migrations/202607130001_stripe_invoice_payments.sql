alter table public.clients
  add column if not exists stripe_customer_id text,
  add column if not exists autopay_enabled boolean not null default false,
  add column if not exists stripe_default_payment_method_id text,
  add column if not exists autopay_consent_at timestamptz,
  add column if not exists autopay_consent_email text;

alter table public.invoices
  add column if not exists public_payment_token uuid default gen_random_uuid(),
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_checkout_status text,
  add column if not exists payment_link_created_at timestamptz,
  add column if not exists payment_attempted_at timestamptz,
  add column if not exists payment_failed_at timestamptz,
  add column if not exists payment_failure_message text,
  add column if not exists autopay_attempted_at timestamptz;

update public.invoices
set public_payment_token = gen_random_uuid()
where public_payment_token is null;

alter table public.invoices
  alter column public_payment_token set default gen_random_uuid(),
  alter column public_payment_token set not null;

alter table public.payments
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_charge_id text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_payment_method_id text,
  add column if not exists source text not null default 'manual';

alter table public.payments
  drop constraint if exists payments_source_check;

alter table public.payments
  add constraint payments_source_check
  check (source in ('manual', 'stripe', 'autopay'));

create unique index if not exists invoices_public_payment_token_unique
  on public.invoices(public_payment_token);

create unique index if not exists invoices_stripe_payment_intent_unique
  on public.invoices(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index if not exists payments_stripe_payment_intent_unique
  on public.payments(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create table if not exists public.stripe_webhook_events (
  id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now(),
  invoice_id uuid references public.invoices(id),
  payment_intent_id text,
  result text,
  error_message text
);

alter table public.stripe_webhook_events enable row level security;

create or replace function public.record_stripe_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_currency text,
  p_payment_intent_id text,
  p_charge_id text,
  p_customer_id text,
  p_payment_method_id text,
  p_source text
)
returns table (
  payment_id uuid,
  invoice_status text,
  paid_at timestamptz,
  credited_hours numeric,
  projects_affected integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_existing public.payments%rowtype;
  v_payment_id uuid := gen_random_uuid();
  v_paid_at timestamptz := now();
  v_item record;
  v_credited_hours numeric := 0;
  v_projects integer := 0;
begin
  if p_source not in ('stripe', 'autopay') then
    raise exception 'Invalid Stripe payment source';
  end if;
  if nullif(trim(coalesce(p_payment_intent_id, '')), '') is null then
    raise exception 'Stripe PaymentIntent is required';
  end if;

  select payment_row.* into v_existing
  from public.payments as payment_row
  where payment_row.stripe_payment_intent_id = p_payment_intent_id
  limit 1;

  if found then
    select coalesce(sum(abs(transaction_row.hours_delta)), 0),
           count(distinct transaction_row.project_id)
    into v_credited_hours, v_projects
    from public.project_hour_transactions as transaction_row
    where transaction_row.payment_id = v_existing.id
      and transaction_row.transaction_type = 'invoice_credit';

    return query select v_existing.id, 'paid'::text,
      coalesce(v_existing.created_at, now()), v_credited_hours, v_projects;
    return;
  end if;

  select invoice_row.* into v_invoice
  from public.invoices as invoice_row
  where invoice_row.id = p_invoice_id
  for update;

  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.stripe_payment_intent_id is distinct from p_payment_intent_id then
    raise exception 'Stripe PaymentIntent does not match invoice';
  end if;
  if lower(coalesce(v_invoice.status, '')) = 'paid' then
    raise exception 'Invoice has already been paid';
  end if;
  if lower(coalesce(v_invoice.status, '')) = 'void' then
    raise exception 'Invoice has been voided';
  end if;
  if lower(coalesce(v_invoice.status, '')) = 'cancelled' then
    raise exception 'Cancelled invoices cannot be paid';
  end if;
  if lower(coalesce(v_invoice.status, '')) not in ('sent', 'overdue') then
    raise exception 'Invoice is not payable';
  end if;
  if upper(trim(coalesce(p_currency, ''))) <> upper(trim(coalesce(v_invoice.currency, ''))) then
    raise exception 'Payment currency does not match invoice';
  end if;
  if round(coalesce(p_amount, 0), 2) <> round(coalesce(v_invoice.total_amount, 0), 2) then
    raise exception 'Payment amount does not match invoice';
  end if;

  select coalesce(sum(item.hours), 0), count(distinct item.project_id)
  into v_credited_hours, v_projects
  from public.invoice_items as item
  where item.invoice_id = p_invoice_id
    and item.project_id is not null
    and coalesce(item.hours, 0) > 0;

  if v_projects = 0 then raise exception 'No billable invoice items found'; end if;

  insert into public.payments (
    id, invoice_id, amount, currency, payment_date, payment_method,
    reference_number, notes, status, stripe_payment_intent_id,
    stripe_charge_id, stripe_customer_id, stripe_payment_method_id, source
  ) values (
    v_payment_id, p_invoice_id, round(p_amount, 2), upper(p_currency),
    v_paid_at::date, 'stripe', p_payment_intent_id,
    case when p_source = 'autopay' then 'Stripe Autopay' else 'Stripe online payment' end,
    'completed', p_payment_intent_id, nullif(p_charge_id, ''),
    nullif(p_customer_id, ''), nullif(p_payment_method_id, ''), p_source
  );

  insert into public.invoice_payments (
    id, invoice_id, payment_method, amount, currency, reference_number, paid_at
  ) values (
    v_payment_id, p_invoice_id,
    case when p_source = 'autopay' then 'stripe_autopay' else 'stripe' end,
    round(p_amount, 2), upper(p_currency), p_payment_intent_id, v_paid_at
  );

  for v_item in
    select item.id, item.project_id, item.hours
    from public.invoice_items as item
    where item.invoice_id = p_invoice_id
      and item.project_id is not null
      and coalesce(item.hours, 0) > 0
    order by item.id
  loop
    insert into public.project_hour_transactions (
      project_id, invoice_id, invoice_item_id, payment_id, transaction_type,
      hours_delta, notes, source_key, created_by
    ) values (
      v_item.project_id, p_invoice_id, v_item.id, v_payment_id,
      'invoice_credit', v_item.hours,
      'Invoice #' || v_invoice.invoice_number || ' paid via Stripe',
      'stripe-invoice-credit:' || p_payment_intent_id || ':' || v_item.id,
      null
    );
  end loop;

  update public.invoices
  set status = 'paid',
      paid_at = v_paid_at,
      paid_amount = round(p_amount, 2),
      payment_method = case when p_source = 'autopay' then 'stripe_autopay' else 'stripe' end,
      payment_reference = p_payment_intent_id,
      stripe_checkout_status = 'succeeded',
      payment_failure_message = null,
      payment_reversed_at = null,
      payment_reversal_reason = null
  where id = p_invoice_id;

  insert into public.invoice_activities (
    invoice_id, event_type, description, created_at
  ) values (
    p_invoice_id, 'stripe_payment_succeeded',
    case when p_source = 'autopay'
      then 'Stripe Autopay payment succeeded'
      else 'Stripe payment succeeded'
    end,
    v_paid_at
  );

  return query select v_payment_id, 'paid'::text, v_paid_at,
    v_credited_hours, v_projects;
exception
  when unique_violation then
    select payment_row.* into v_existing
    from public.payments as payment_row
    where payment_row.stripe_payment_intent_id = p_payment_intent_id
    limit 1;
    if found then
      return query select v_existing.id, 'paid'::text,
        coalesce(v_existing.created_at, now()), 0::numeric, 0;
      return;
    end if;
    raise;
end;
$$;

revoke all on function public.record_stripe_invoice_payment(
  uuid, numeric, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.record_stripe_invoice_payment(
  uuid, numeric, text, text, text, text, text, text
) to service_role;

notify pgrst, 'reload schema';
