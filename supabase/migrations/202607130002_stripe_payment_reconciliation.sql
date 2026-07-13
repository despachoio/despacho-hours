alter table public.invoices
  add column if not exists stripe_payment_attempt_number integer not null default 1;

-- These compatibility tables are used by the existing wallet foreign key and
-- invoice timeline. Define their actual columns explicitly instead of assuming
-- they were created outside the migration history.
create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  payment_method text not null,
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  stripe_payment_intent_id text,
  reference_number text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.invoice_payments
  add column if not exists stripe_payment_intent_id text,
  add column if not exists reference_number text,
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.invoice_activities (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  event_type text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists invoice_activities_invoice_created_idx
  on public.invoice_activities(invoice_id, created_at);

alter table public.invoice_activities enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'invoice_activities'
      and policyname = 'invoice_activities_staff_read'
  ) then
    create policy invoice_activities_staff_read
      on public.invoice_activities
      for select
      to authenticated
      using (
        exists (
          select 1 from public.profiles
          where profiles.user_id = auth.uid()
            and lower(trim(coalesce(profiles.role, ''))) in ('admin', 'manager')
        )
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.invoices'::regclass
      and conname = 'invoices_stripe_payment_attempt_number_check'
  ) then
    alter table public.invoices
      add constraint invoices_stripe_payment_attempt_number_check
      check (stripe_payment_attempt_number >= 1);
  end if;
end;
$$;

alter table public.payments
  add column if not exists status text not null default 'completed',
  add column if not exists source text not null default 'manual',
  add column if not exists stripe_payment_intent_id text;

create unique index if not exists invoices_stripe_payment_intent_unique
  on public.invoices(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index if not exists payments_stripe_payment_intent_unique
  on public.payments(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- Reversed payments no longer satisfy this predicate, so an explicitly
-- authorized later repayment remains possible without weakening the guard on
-- the current completed Stripe payment.
create unique index if not exists payments_one_completed_stripe_payment_per_invoice
  on public.payments(invoice_id)
  where source in ('stripe', 'autopay')
    and status = 'completed';

-- Retain the existing per-payment/per-item wallet-credit protection. The
-- payment uniqueness above prevents a second completed Stripe payment from
-- reaching the wallet loop for the same invoice.
create unique index if not exists project_hour_transactions_unique_payment_item_credit
  on public.project_hour_transactions(payment_id, invoice_item_id, transaction_type)
  where transaction_type = 'invoice_credit';

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

  select invoice_row.* into v_invoice
  from public.invoices as invoice_row
  where invoice_row.id = p_invoice_id
  for update;

  if not found then raise exception 'Invoice not found'; end if;
  if v_invoice.stripe_payment_intent_id is distinct from p_payment_intent_id then
    raise exception 'Stripe PaymentIntent does not match invoice';
  end if;
  if lower(coalesce(v_invoice.status, '')) = 'void' then
    raise exception 'Invoice has been voided';
  end if;
  if lower(coalesce(v_invoice.status, '')) = 'cancelled' then
    raise exception 'Cancelled invoices cannot be paid';
  end if;
  if upper(trim(coalesce(p_currency, ''))) <> upper(trim(coalesce(v_invoice.currency, ''))) then
    raise exception 'Payment currency does not match invoice';
  end if;
  if round(coalesce(p_amount, 0), 2) <> round(coalesce(v_invoice.total_amount, 0), 2) then
    raise exception 'Payment amount does not match invoice';
  end if;

  select payment_row.* into v_existing
  from public.payments as payment_row
  where payment_row.stripe_payment_intent_id = p_payment_intent_id
  limit 1;

  if found and v_existing.status = 'reversed' then
    raise exception 'Stripe payment has been reversed';
  end if;

  -- This is the concurrency guard shared by the webhook and the public status
  -- reconciliation fallback. If this exact PaymentIntent has no payment row,
  -- look for the single completed Stripe payment protected by the partial
  -- unique index.
  if not found then
    select payment_row.* into v_existing
    from public.payments as payment_row
    where payment_row.invoice_id = p_invoice_id
      and payment_row.source in ('stripe', 'autopay')
      and payment_row.status = 'completed'
    limit 1;
  end if;

  if found then
    -- Repair an older partially reconciled record without duplicating credits.
    -- Each invoice item is protected by the existing partial unique index.
    insert into public.invoice_payments (
      id, invoice_id, payment_method, amount, currency,
      stripe_payment_intent_id, reference_number, paid_at
    ) values (
      v_existing.id, p_invoice_id,
      case when v_existing.source = 'autopay' then 'stripe_autopay' else 'stripe' end,
      v_existing.amount, upper(v_existing.currency),
      v_existing.stripe_payment_intent_id,
      v_existing.stripe_payment_intent_id,
      coalesce(v_existing.created_at, now())
    ) on conflict (id) do nothing;

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
        v_item.project_id, p_invoice_id, v_item.id, v_existing.id,
        'invoice_credit', v_item.hours,
        'Invoice #' || v_invoice.invoice_number || ' paid via Stripe',
        'stripe-invoice-credit:' || v_existing.stripe_payment_intent_id || ':' || v_item.id,
        null
      ) on conflict (payment_id, invoice_item_id, transaction_type)
        where transaction_type = 'invoice_credit'
        do nothing;
    end loop;

    select coalesce(sum(abs(transaction_row.hours_delta)), 0),
           count(distinct transaction_row.project_id)
    into v_credited_hours, v_projects
    from public.project_hour_transactions as transaction_row
    where transaction_row.payment_id = v_existing.id
      and transaction_row.transaction_type = 'invoice_credit';

    update public.invoices
    set status = 'paid',
        paid_at = coalesce(v_existing.created_at, now()),
        paid_amount = v_existing.amount,
        payment_method = case when v_existing.source = 'autopay' then 'stripe_autopay' else 'stripe' end,
        payment_reference = v_existing.stripe_payment_intent_id,
        stripe_checkout_status = 'succeeded',
        payment_failure_message = null,
        payment_reversed_at = null,
        payment_reversal_reason = null
    where id = p_invoice_id;

    if lower(coalesce(v_invoice.status, '')) <> 'paid' then
      begin
        insert into public.invoice_activities (
          invoice_id, event_type, description, created_at
        ) values (
          p_invoice_id, 'stripe_payment_succeeded',
          'Stripe payment reconciliation completed', now()
        );
      exception when others then
        raise warning 'Optional invoice activity insert failed: %', sqlerrm;
      end;
    end if;

    return query select v_existing.id, 'paid'::text,
      coalesce(v_existing.created_at, now()), v_credited_hours, v_projects;
    return;
  end if;

  if lower(coalesce(v_invoice.status, '')) = 'paid' then
    raise exception 'Invoice is already paid without a reconciled Stripe payment';
  end if;
  if lower(coalesce(v_invoice.status, '')) not in ('sent', 'overdue') then
    raise exception 'Invoice is not payable';
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
    id, invoice_id, payment_method, amount, currency,
    stripe_payment_intent_id, reference_number, paid_at
  ) values (
    v_payment_id, p_invoice_id,
    case when p_source = 'autopay' then 'stripe_autopay' else 'stripe' end,
    round(p_amount, 2), upper(p_currency), p_payment_intent_id,
    p_payment_intent_id, v_paid_at
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

  begin
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
  exception when others then
    raise warning 'Optional invoice activity insert failed: %', sqlerrm;
  end;

  return query select v_payment_id, 'paid'::text, v_paid_at,
    v_credited_hours, v_projects;
exception
  when unique_violation then
    select payment_row.* into v_existing
    from public.payments as payment_row
    where payment_row.invoice_id = p_invoice_id
      and payment_row.source in ('stripe', 'autopay')
      and payment_row.status = 'completed'
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
