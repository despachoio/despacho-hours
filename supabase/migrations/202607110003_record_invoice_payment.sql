create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  amount numeric(12,2) not null,
  currency text not null,
  payment_date date not null,
  payment_method text not null,
  reference_number text,
  notes text,
  stripe_payment_intent_id text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists payments_one_full_payment_per_invoice
  on public.payments(invoice_id)
  where stripe_payment_intent_id is null;

alter table public.invoices
  add column if not exists paid_at timestamptz,
  add column if not exists paid_amount numeric(12,2),
  add column if not exists payment_method text,
  add column if not exists payment_reference text;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'project_hour_transactions_unique_invoice_item_credit'
  ) then
    begin
      create unique index project_hour_transactions_unique_invoice_item_credit
        on public.project_hour_transactions(invoice_item_id, transaction_type)
        where transaction_type = 'invoice_credit';
    exception
      when unique_violation then
        raise notice 'Existing duplicate invoice credits prevented creation of project_hour_transactions_unique_invoice_item_credit';
    end;
  end if;
end;
$$;

alter table public.payments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payments'
      and policyname = 'payments_admin_all'
  ) then
    create policy payments_admin_all
      on public.payments
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.profiles
          where profiles.user_id = auth.uid()
            and lower(trim(coalesce(profiles.role, ''))) = 'admin'
        )
      )
      with check (
        exists (
          select 1
          from public.profiles
          where profiles.user_id = auth.uid()
            and lower(trim(coalesce(profiles.role, ''))) = 'admin'
        )
      );
  end if;
end;
$$;

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
  select *
  into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'Invoice not found';
  end if;

  if lower(coalesce(v_invoice.status, '')) = 'paid'
    or exists (
      select 1
      from public.payments
      where invoice_id = p_invoice_id
        and stripe_payment_intent_id is null
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

  select count(*)
  into v_billable_count
  from public.invoice_items
  where invoice_id = p_invoice_id
    and project_id is not null
    and coalesce(hours, 0) > 0;

  if v_billable_count = 0 then
    raise exception 'No billable invoice items found';
  end if;

  v_paid_at := p_payment_date::timestamp at time zone 'UTC';

  insert into public.payments (
    id,
    invoice_id,
    amount,
    currency,
    payment_date,
    payment_method,
    reference_number,
    notes,
    created_by
  ) values (
    v_payment_id,
    p_invoice_id,
    round(p_amount, 2),
    v_invoice.currency,
    p_payment_date,
    p_payment_method,
    nullif(trim(p_reference_number), ''),
    nullif(trim(p_notes), ''),
    p_created_by
  );

  -- Existing wallet transactions reference invoice_payments, so retain a
  -- compatibility row with the same UUID as the authoritative payment row.
  insert into public.invoice_payments (
    id,
    invoice_id,
    payment_method,
    amount,
    currency,
    reference_number,
    paid_at
  ) values (
    v_payment_id,
    p_invoice_id,
    p_payment_method,
    round(p_amount, 2),
    v_invoice.currency,
    nullif(trim(p_reference_number), ''),
    v_paid_at
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
      project_id,
      invoice_id,
      invoice_item_id,
      payment_id,
      transaction_type,
      hours_delta,
      notes,
      source_key,
      created_by
    ) values (
      v_item.project_id,
      p_invoice_id,
      v_item.id,
      v_payment_id,
      'invoice_credit',
      v_item.hours,
      'Invoice #' || v_invoice.invoice_number || ' paid',
      'invoice-credit:' || v_item.id,
      p_created_by
    );
  end loop;

  update public.invoices
  set
    status = 'paid',
    paid_at = v_paid_at,
    paid_amount = round(p_amount, 2),
    payment_method = p_payment_method,
    payment_reference = nullif(trim(p_reference_number), '')
  where id = p_invoice_id;

  return query
  select
    v_payment_id,
    'paid'::text,
    v_paid_at,
    round(p_amount, 2),
    p_payment_method,
    nullif(trim(p_reference_number), '');
exception
  when unique_violation then
    raise exception 'Invoice has already been paid.';
  when others then
    raise;
end;
$$;

revoke all on function public.record_invoice_payment(uuid, numeric, date, text, text, text, uuid) from public;
grant execute on function public.record_invoice_payment(uuid, numeric, date, text, text, text, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
