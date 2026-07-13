
-- Kairo production baseline (schema only, hardened).
-- Generated from the working development schema; contains no application data.
-- Apply to an empty Supabase project as a single transaction.

BEGIN;

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."enforce_invoice_reminder_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."enforce_invoice_reminder_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_invoice_dashboard_dimensions"() RETURNS TABLE("invoice_year" integer, "currency" "text", "invoice_count" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select
    extract(year from invoices.issue_date)::integer as invoice_year,
    invoices.currency,
    count(*) as invoice_count
  from public.invoices
  group by
    extract(year from invoices.issue_date)::integer,
    invoices.currency
  order by invoice_year desc, invoice_count desc;
$$;


ALTER FUNCTION "public"."get_invoice_dashboard_dimensions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_invoice_kpi_summary"("p_year" integer) RETURNS TABLE("currency" "text", "open_amount" numeric, "paid_amount" numeric, "overdue_count" bigint, "overdue_amount" numeric, "invoices_in_year" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select
    invoices.currency,
    coalesce(sum(invoices.total_amount) filter (
      where lower(invoices.status) in ('sent', 'overdue')
    ), 0)::numeric as open_amount,
    coalesce(sum(coalesce(invoices.paid_amount, invoices.total_amount)) filter (
      where lower(invoices.status) = 'paid'
    ), 0)::numeric as paid_amount,
    count(*) filter (
      where lower(invoices.status) = 'overdue'
    ) as overdue_count,
    coalesce(sum(invoices.total_amount) filter (
      where lower(invoices.status) = 'overdue'
    ), 0)::numeric as overdue_amount,
    count(*) filter (
      where extract(year from invoices.issue_date)::integer = p_year
        and lower(invoices.status) not in ('void', 'cancelled')
    ) as invoices_in_year
  from public.invoices
  where lower(invoices.status) not in ('void', 'cancelled')
  group by invoices.currency
  order by invoices.currency;
$$;


ALTER FUNCTION "public"."get_invoice_kpi_summary"("p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_invoice_monthly_summary"("p_year" integer, "p_currency" "text") RETURNS TABLE("month_number" integer, "open_amount" numeric, "paid_amount" numeric, "total_invoiced" numeric, "invoice_count" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  with months as (
    select generate_series(1, 12)::integer as month_number
  ), invoice_totals as (
    select
      extract(month from invoices.issue_date)::integer as month_number,
      coalesce(sum(invoices.total_amount) filter (
        where lower(invoices.status) in ('sent', 'overdue')
      ), 0)::numeric as open_amount,
      coalesce(sum(coalesce(invoices.paid_amount, invoices.total_amount)) filter (
        where lower(invoices.status) = 'paid'
      ), 0)::numeric as paid_amount,
      coalesce(sum(invoices.total_amount), 0)::numeric as total_invoiced,
      count(*) as invoice_count
    from public.invoices
    where extract(year from invoices.issue_date)::integer = p_year
      and invoices.currency = p_currency
      and lower(invoices.status) not in ('draft', 'void', 'cancelled')
    group by extract(month from invoices.issue_date)::integer
  )
  select
    months.month_number,
    coalesce(invoice_totals.open_amount, 0)::numeric,
    coalesce(invoice_totals.paid_amount, 0)::numeric,
    coalesce(invoice_totals.total_invoiced, 0)::numeric,
    coalesce(invoice_totals.invoice_count, 0)::bigint
  from months
  left join invoice_totals using (month_number)
  order by months.month_number;
$$;


ALTER FUNCTION "public"."get_invoice_monthly_summary"("p_year" integer, "p_currency" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_role"() RETURNS "text"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select role
  from public.profiles
  where user_id = auth.uid()
$$;


ALTER FUNCTION "public"."get_my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_project_wallet"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if coalesce(new.purchased_hours, 0) > 0 then

    insert into public.project_hour_transactions (
      project_id,
      transaction_type,
      hours_delta,
      notes,
      source_key,
      created_by
    )
    values (
      new.id,
      'opening_credit',
      round(new.purchased_hours::numeric, 2),
      'Initial hours purchased',
      'project-opening:' || new.id::text,
      auth.uid()
    )
    on conflict (source_key) do nothing;

  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_project_wallet"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_time_entry_wallet"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'DELETE' then

    delete from public.project_hour_transactions
    where source_key = 'time-entry:' || old.id::text;

    return old;
  end if;


  insert into public.project_hour_transactions (
    project_id,
    time_entry_id,
    transaction_type,
    hours_delta,
    notes,
    source_key,
    created_at
  )
  values (
    new.project_id,
    new.id,
    'time_debit',
    -round(coalesce(new.hours, 0)::numeric, 2),

    case
      when nullif(trim(coalesce(new.description, '')), '') is not null
        then 'Time entry: ' || trim(new.description)
      else 'Time entry hours consumed'
    end,

    'time-entry:' || new.id::text,

    coalesce(
      new.stopped_at,
      new.started_at,
      new.entry_date::timestamptz,
      now()
    )
  )

  on conflict (source_key)
  do update set
    project_id = excluded.project_id,
    time_entry_id = excluded.time_entry_id,
    transaction_type = excluded.transaction_type,
    hours_delta = excluded.hours_delta,
    notes = excluded.notes,
    created_at = excluded.created_at;


  return new;
end;
$$;


ALTER FUNCTION "public"."handle_time_entry_wallet"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_wallet_transaction_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_project_wallet(old.project_id);
    return old;
  end if;

  if tg_op = 'UPDATE'
     and old.project_id is distinct from new.project_id then

    perform public.sync_project_wallet(old.project_id);
    perform public.sync_project_wallet(new.project_id);

    return new;
  end if;

  perform public.sync_project_wallet(new.project_id);

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_wallet_transaction_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_invoice_payment"("p_invoice_id" "uuid", "p_amount" numeric, "p_payment_date" "date", "p_payment_method" "text", "p_reference_number" "text", "p_notes" "text", "p_created_by" "uuid") RETURNS TABLE("payment_id" "uuid", "invoice_status" "text", "paid_at" timestamp with time zone, "paid_amount" numeric, "payment_method" "text", "payment_reference" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."record_invoice_payment"("p_invoice_id" "uuid", "p_amount" numeric, "p_payment_date" "date", "p_payment_method" "text", "p_reference_number" "text", "p_notes" "text", "p_created_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_stripe_invoice_payment"("p_invoice_id" "uuid", "p_amount" numeric, "p_currency" "text", "p_payment_intent_id" "text", "p_charge_id" "text", "p_customer_id" "text", "p_payment_method_id" "text", "p_source" "text") RETURNS TABLE("payment_id" "uuid", "invoice_status" "text", "paid_at" timestamp with time zone, "credited_hours" numeric, "projects_affected" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."record_stripe_invoice_payment"("p_invoice_id" "uuid", "p_amount" numeric, "p_currency" "text", "p_payment_intent_id" "text", "p_charge_id" "text", "p_customer_id" "text", "p_payment_method_id" "text", "p_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reverse_invoice_payment"("p_invoice_id" "uuid", "p_reason" "text", "p_notes" "text", "p_reversed_by" "uuid") RETURNS TABLE("invoice_id" "uuid", "invoice_status" "text", "payment_id" "uuid", "total_reversed_hours" numeric, "projects_affected" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."reverse_invoice_payment"("p_invoice_id" "uuid", "p_reason" "text", "p_notes" "text", "p_reversed_by" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."client_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'primary'::"text",
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contact_type" "text" DEFAULT 'general'::"text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "phone" "text",
    "job_title" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "client_contacts_contact_type_check" CHECK (("contact_type" = ANY (ARRAY['primary'::"text", 'billing'::"text", 'manager'::"text", 'general'::"text"])))
);


ALTER TABLE "public"."client_contacts" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_client_contact"("p_contact_id" "uuid", "p_client_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_job_title" "text", "p_email" "text", "p_phone" "text", "p_contact_type" "text", "p_is_primary" boolean) RETURNS "public"."client_contacts"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_contact public.client_contacts;
  v_name text;
begin
  if trim(coalesce(p_email, '')) = '' then
    raise exception 'Email is required.';
  end if;

  if lower(
    trim(coalesce(p_contact_type, ''))
  ) not in (
    'primary',
    'billing',
    'manager',
    'general'
  ) then
    raise exception 'Select a valid contact type.';
  end if;

  v_name := nullif(
    trim(
      concat_ws(
        ' ',
        nullif(trim(p_first_name), ''),
        nullif(trim(p_last_name), '')
      )
    ),
    ''
  );

  if coalesce(p_is_primary, false) then
    update public.client_contacts
    set is_primary = false
    where client_id = p_client_id
      and is_primary = true
      and is_active = true
      and (
        p_contact_id is null
        or id <> p_contact_id
      );
  end if;

  if p_contact_id is null then
    insert into public.client_contacts (
      client_id,
      first_name,
      last_name,
      name,
      email,
      phone,
      contact_type,
      job_title,
      is_primary,
      is_active
    ) values (
      p_client_id,
      nullif(trim(p_first_name), ''),
      nullif(trim(p_last_name), ''),
      v_name,
      lower(trim(p_email)),
      nullif(trim(p_phone), ''),
      lower(trim(p_contact_type)),
      nullif(trim(p_job_title), ''),
      coalesce(p_is_primary, false),
      true
    )
    returning * into v_contact;
  else
    update public.client_contacts
    set
      first_name = nullif(trim(p_first_name), ''),
      last_name = nullif(trim(p_last_name), ''),
      name = v_name,
      email = lower(trim(p_email)),
      phone = nullif(trim(p_phone), ''),
      contact_type = lower(trim(p_contact_type)),
      job_title = nullif(trim(p_job_title), ''),
      is_primary = coalesce(p_is_primary, false)
    where id = p_contact_id
      and client_id = p_client_id
      and is_active = true
    returning * into v_contact;

    if not found then
      raise exception 'Contact not found.';
    end if;
  end if;

  return v_contact;

exception
  when unique_violation then
    raise exception
      'A contact with this email already exists for this client.';
end;
$$;


ALTER FUNCTION "public"."save_client_contact"("p_contact_id" "uuid", "p_client_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_job_title" "text", "p_email" "text", "p_phone" "text", "p_contact_type" "text", "p_is_primary" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_client_contact_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_client_contact_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_company_settings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_company_settings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_recurring_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_recurring_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_project_wallet"("target_project_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  credited numeric(12,2);
  consumed numeric(12,2);
  available numeric(12,2);
begin
  select
    coalesce(
      sum(
        case
          when hours_delta > 0 then hours_delta
          else 0
        end
      ),
      0
    ),

    coalesce(
      sum(
        case
          when hours_delta < 0 then abs(hours_delta)
          else 0
        end
      ),
      0
    ),

    coalesce(sum(hours_delta), 0)

  into
    credited,
    consumed,
    available

  from public.project_hour_transactions
  where project_id = target_project_id;


  update public.projects
  set
    purchased_hours = round(credited, 2),
    used_hours = round(consumed, 2),
    remaining_hours = round(available, 2)
  where id = target_project_id;
end;
$$;


ALTER FUNCTION "public"."sync_project_wallet"("target_project_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."active_timers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid",
    "project_id" "uuid",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "paused_at" timestamp with time zone,
    "total_paused_seconds" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."active_timers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "stripe_customer_id" "text",
    "autopay_enabled" boolean DEFAULT false NOT NULL,
    "stripe_default_payment_method_id" "text",
    "autopay_consent_at" timestamp with time zone,
    "autopay_consent_email" "text"
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "singleton_key" boolean DEFAULT true NOT NULL,
    "company_name" "text" DEFAULT 'Despacho Inc.'::"text" NOT NULL,
    "legal_name" "text",
    "address_line_1" "text",
    "address_line_2" "text",
    "city" "text",
    "state_province" "text",
    "postal_code" "text",
    "country" "text",
    "business_email" "text",
    "website" "text",
    "phone" "text",
    "logo_url" "text",
    "invoice_logo_url" "text",
    "default_currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "default_payment_terms_days" integer DEFAULT 7 NOT NULL,
    "invoice_number_prefix" "text",
    "invoice_number_start" integer DEFAULT 1001 NOT NULL,
    "default_tax_rate" numeric(8,4) DEFAULT 0 NOT NULL,
    "tax_label" "text" DEFAULT 'Tax'::"text" NOT NULL,
    "tax_registration_number" "text",
    "bank_name" "text",
    "bank_address" "text",
    "institution_number" "text",
    "routing_number" "text",
    "swift_bic" "text",
    "transit_number" "text",
    "account_number" "text",
    "account_name" "text",
    "payment_instructions" "text",
    "default_invoice_notes" "text",
    "default_reminder_before_due_days" integer[] DEFAULT '{}'::integer[] NOT NULL,
    "default_reminder_after_due_days" integer[] DEFAULT '{}'::integer[] NOT NULL,
    "default_reminder_subject" "text",
    "default_friendly_reminder_message" "text",
    "default_overdue_reminder_message" "text",
    "default_recurring_frequency" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "default_recurring_generate_as_draft" boolean DEFAULT true NOT NULL,
    "timezone" "text" DEFAULT 'Asia/Kolkata'::"text" NOT NULL,
    "date_format" "text" DEFAULT 'DD MMM YYYY'::"text" NOT NULL,
    "time_format" "text" DEFAULT '12h'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "company_settings_currency_check" CHECK (("default_currency" = ANY (ARRAY['USD'::"text", 'CAD'::"text", 'INR'::"text"]))),
    CONSTRAINT "company_settings_date_format_check" CHECK (("date_format" = ANY (ARRAY['DD MMM YYYY'::"text", 'DD-MM-YYYY'::"text", 'MM/DD/YYYY'::"text", 'YYYY-MM-DD'::"text"]))),
    CONSTRAINT "company_settings_invoice_number_start_check" CHECK (("invoice_number_start" > 0)),
    CONSTRAINT "company_settings_payment_terms_check" CHECK (("default_payment_terms_days" >= 0)),
    CONSTRAINT "company_settings_recurring_frequency_check" CHECK (("default_recurring_frequency" = ANY (ARRAY['monthly'::"text", 'quarterly'::"text", 'annually'::"text", 'custom'::"text"]))),
    CONSTRAINT "company_settings_singleton_key_check" CHECK (("singleton_key" = true)),
    CONSTRAINT "company_settings_tax_rate_check" CHECK (("default_tax_rate" >= (0)::numeric)),
    CONSTRAINT "company_settings_time_format_check" CHECK (("time_format" = ANY (ARRAY['12h'::"text", '24h'::"text"])))
);


ALTER TABLE "public"."company_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'employee'::"text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "employee_code" "text",
    "department" "text",
    "status" "text" DEFAULT 'active'::"text",
    "hourly_cost" numeric DEFAULT 0
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invoice_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "item_type" "text" DEFAULT 'Service'::"text" NOT NULL,
    "description" "text" NOT NULL,
    "hours" numeric(12,2) DEFAULT 0 NOT NULL,
    "quantity" numeric(12,2) DEFAULT 1 NOT NULL,
    "unit_price" numeric(12,2) DEFAULT 0 NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invoice_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."invoice_number_seq"
    START WITH 1118
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."invoice_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "payment_method" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "stripe_payment_intent_id" "text",
    "reference_number" "text",
    "paid_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invoice_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "sent_to" "text" NOT NULL,
    "cc" "text",
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "gmail_message_id" "text",
    "reminder_number" integer NOT NULL,
    "scheduled_for" "date",
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_by" "uuid",
    "send_type" "text" DEFAULT 'automatic'::"text" NOT NULL,
    "status" "text" DEFAULT 'sent'::"text" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invoice_reminders_send_type_check" CHECK (("send_type" = ANY (ARRAY['automatic'::"text", 'manual'::"text"]))),
    CONSTRAINT "invoice_reminders_status_check" CHECK (("status" = ANY (ARRAY['sent'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."invoice_reminders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_number" bigint DEFAULT "nextval"('"public"."invoice_number_seq"'::"regclass") NOT NULL,
    "client_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "issue_date" "date" NOT NULL,
    "due_date" "date" NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "subtotal" numeric(12,2) DEFAULT 0 NOT NULL,
    "tax_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "hours_purchased" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "payment_method" "text",
    "stripe_payment_url" "text",
    "stripe_checkout_session_id" "text",
    "stripe_payment_intent_id" "text",
    "email_to" "text",
    "sent_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_to" "text",
    "email_subject" "text",
    "email_body" "text",
    "gmail_message_id" "text",
    "paid_amount" numeric(12,2),
    "payment_reference" "text",
    "payment_reversed_at" timestamp with time zone,
    "payment_reversal_reason" "text",
    "voided_at" timestamp with time zone,
    "voided_by" "uuid",
    "void_reason" "text",
    "void_notes" "text",
    "sent_cc" "text",
    "reminders_enabled" boolean DEFAULT true NOT NULL,
    "reminders_stopped_at" timestamp with time zone,
    "reminders_stopped_by" "uuid",
    "reminders_stop_reason" "text",
    "last_reminder_sent_at" timestamp with time zone,
    "next_reminder_at" timestamp with time zone,
    "reminder_count" integer DEFAULT 0 NOT NULL,
    "discount_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "recurring_schedule_id" "uuid",
    "recurring_occurrence_id" "uuid",
    "recurring_period_start" "date",
    "recurring_period_end" "date",
    "generated_from_recurring" boolean DEFAULT false NOT NULL,
    "draft_email_to" "text",
    "draft_email_cc" "text",
    "draft_email_subject" "text",
    "draft_email_body" "text",
    "public_payment_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_checkout_status" "text",
    "payment_link_created_at" timestamp with time zone,
    "payment_attempted_at" timestamp with time zone,
    "payment_failed_at" timestamp with time zone,
    "payment_failure_message" "text",
    "autopay_attempted_at" timestamp with time zone,
    "stripe_payment_attempt_number" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "invoices_stripe_payment_attempt_number_check" CHECK (("stripe_payment_attempt_number" >= 1))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" NOT NULL,
    "payment_date" "date" NOT NULL,
    "payment_method" "text" NOT NULL,
    "reference_number" "text",
    "notes" "text",
    "stripe_payment_intent_id" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "reversed_at" timestamp with time zone,
    "reversed_by" "uuid",
    "reversal_reason" "text",
    "reversal_notes" "text",
    "stripe_charge_id" "text",
    "stripe_customer_id" "text",
    "stripe_payment_method_id" "text",
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    CONSTRAINT "payments_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'stripe'::"text", 'autopay'::"text"]))),
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['completed'::"text", 'reversed'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "full_name" "text" NOT NULL,
    "role" "text" DEFAULT 'Admin'::"text" NOT NULL,
    "employee_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_hour_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "invoice_id" "uuid",
    "invoice_item_id" "uuid",
    "payment_id" "uuid",
    "time_entry_id" "uuid",
    "transaction_type" "text" NOT NULL,
    "hours_delta" numeric(12,2) NOT NULL,
    "notes" "text",
    "source_key" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "original_transaction_id" "uuid",
    CONSTRAINT "project_hour_transactions_hours_delta_check" CHECK (("hours_delta" <> (0)::numeric)),
    CONSTRAINT "project_hour_transactions_transaction_type_check" CHECK (("transaction_type" = ANY (ARRAY['opening_credit'::"text", 'invoice_credit'::"text", 'invoice_credit_reversal'::"text", 'time_debit'::"text", 'manual_credit'::"text", 'manual_debit'::"text", 'adjustment'::"text", 'refund'::"text"])))
);


ALTER TABLE "public"."project_hour_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "name" "text" NOT NULL,
    "purchased_hours" numeric DEFAULT 0,
    "used_hours" numeric DEFAULT 0,
    "remaining_hours" numeric DEFAULT 0,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "hourly_rate" numeric DEFAULT 0,
    "alert_hours" numeric DEFAULT 10,
    "description" "text",
    "project_code" "text",
    "start_date" "date"
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."project_hour_wallets" AS
 SELECT "p"."id" AS "project_id",
    (COALESCE("sum"(
        CASE
            WHEN ("tx"."hours_delta" > (0)::numeric) THEN "tx"."hours_delta"
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(12,2) AS "purchased_hours",
    (COALESCE("sum"(
        CASE
            WHEN ("tx"."hours_delta" < (0)::numeric) THEN "abs"("tx"."hours_delta")
            ELSE (0)::numeric
        END), (0)::numeric))::numeric(12,2) AS "used_hours",
    (COALESCE("sum"("tx"."hours_delta"), (0)::numeric))::numeric(12,2) AS "remaining_hours"
   FROM ("public"."projects" "p"
     LEFT JOIN "public"."project_hour_transactions" "tx" ON (("tx"."project_id" = "p"."id")))
  GROUP BY "p"."id";


ALTER VIEW "public"."project_hour_wallets" OWNER TO "postgres";

-- Enforce the caller's project and wallet-ledger RLS policies through the
-- summary view instead of evaluating it with the view owner's privileges.
ALTER VIEW "public"."project_hour_wallets" SET (security_invoker = true);


CREATE TABLE IF NOT EXISTS "public"."project_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "note" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "employee_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."project_resources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_invoice_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recurring_schedule_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "description" "text" NOT NULL,
    "hours" numeric(12,2) DEFAULT 0 NOT NULL,
    "quantity" numeric(12,2) DEFAULT 1 NOT NULL,
    "unit_price" numeric(12,2) DEFAULT 0 NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."recurring_invoice_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_invoice_occurrence_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "occurrence_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "description" "text" NOT NULL,
    "hours" numeric(12,2) DEFAULT 0 NOT NULL,
    "quantity" numeric(12,2) DEFAULT 1 NOT NULL,
    "unit_price" numeric(12,2) DEFAULT 0 NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."recurring_invoice_occurrence_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_invoice_occurrences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recurring_schedule_id" "uuid" NOT NULL,
    "scheduled_date" "date" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "issue_date" "date",
    "due_date" "date",
    "currency" "text",
    "tax_amount" numeric(12,2),
    "discount_amount" numeric(12,2),
    "notes" "text",
    "email_to" "text",
    "email_cc" "text",
    "email_subject" "text",
    "email_body" "text",
    "generated_invoice_id" "uuid",
    "skip_reason" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "recurring_invoice_occurrences_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'generated'::"text", 'skipped'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."recurring_invoice_occurrences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_invoice_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "frequency" "text" NOT NULL,
    "interval_count" integer DEFAULT 1 NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "next_generation_date" "date" NOT NULL,
    "last_generated_at" timestamp with time zone,
    "last_generated_invoice_id" "uuid",
    "currency" "text" NOT NULL,
    "payment_terms_days" integer DEFAULT 7 NOT NULL,
    "tax_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "discount_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "email_to" "text",
    "email_cc" "text",
    "email_subject" "text",
    "email_body" "text",
    "auto_send" boolean DEFAULT false NOT NULL,
    "autopay_enabled" boolean DEFAULT false NOT NULL,
    "autopay_provider" "text",
    "autopay_customer_reference" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cancellation_reason" "text",
    "cancelled_at" timestamp with time zone,
    "cancelled_by" "uuid",
    CONSTRAINT "recurring_invoice_schedules_dates_check" CHECK ((("end_date" IS NULL) OR ("end_date" >= "start_date"))),
    CONSTRAINT "recurring_invoice_schedules_frequency_check" CHECK (("frequency" = ANY (ARRAY['weekly'::"text", 'monthly'::"text", 'quarterly'::"text", 'yearly'::"text", 'custom'::"text"]))),
    CONSTRAINT "recurring_invoice_schedules_interval_check" CHECK (("interval_count" > 0)),
    CONSTRAINT "recurring_invoice_schedules_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'cancelled'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."recurring_invoice_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "frequency" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "invoice_day" integer DEFAULT 1 NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "hours_purchased" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "next_invoice_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."recurring_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_webhook_events" (
    "id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invoice_id" "uuid",
    "payment_intent_id" "text",
    "result" "text",
    "error_message" "text"
);


ALTER TABLE "public"."stripe_webhook_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."time_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid",
    "project_id" "uuid",
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "duration_hours" numeric,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "entry_date" "date",
    "hours" numeric,
    "started_at" timestamp with time zone,
    "stopped_at" timestamp with time zone
);


ALTER TABLE "public"."time_entries" OWNER TO "postgres";


ALTER TABLE ONLY "public"."active_timers"
    ADD CONSTRAINT "active_timers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_contacts"
    ADD CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_settings"
    ADD CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_activities"
    ADD CONSTRAINT "invoice_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_payments"
    ADD CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_reminders"
    ADD CONSTRAINT "invoice_reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_employee_id_unique" UNIQUE ("employee_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."project_hour_transactions"
    ADD CONSTRAINT "project_hour_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_hour_transactions"
    ADD CONSTRAINT "project_hour_transactions_source_key_key" UNIQUE ("source_key");



ALTER TABLE ONLY "public"."project_notes"
    ADD CONSTRAINT "project_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_resources"
    ADD CONSTRAINT "project_resources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_invoice_items"
    ADD CONSTRAINT "recurring_invoice_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_invoice_occurrence_items"
    ADD CONSTRAINT "recurring_invoice_occurrence_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_invoice_occurrences"
    ADD CONSTRAINT "recurring_invoice_occurrences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_invoice_occurrences"
    ADD CONSTRAINT "recurring_invoice_occurrences_recurring_schedule_id_schedul_key" UNIQUE ("recurring_schedule_id", "scheduled_date");



ALTER TABLE ONLY "public"."recurring_invoice_schedules"
    ADD CONSTRAINT "recurring_invoice_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_invoices"
    ADD CONSTRAINT "recurring_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_webhook_events"
    ADD CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "client_contacts_client_email_unique" ON "public"."client_contacts" USING "btree" ("client_id", "lower"("email"));



CREATE UNIQUE INDEX "client_contacts_one_active_primary" ON "public"."client_contacts" USING "btree" ("client_id") WHERE (("is_primary" = true) AND ("is_active" = true));



CREATE UNIQUE INDEX "company_settings_singleton_idx" ON "public"."company_settings" USING "btree" ("singleton_key");



CREATE INDEX "invoice_activities_invoice_created_idx" ON "public"."invoice_activities" USING "btree" ("invoice_id", "created_at");



CREATE UNIQUE INDEX "invoice_reminders_unique_automatic_schedule" ON "public"."invoice_reminders" USING "btree" ("invoice_id", "scheduled_for") WHERE ("send_type" = 'automatic'::"text");



CREATE UNIQUE INDEX "invoices_public_payment_token_unique" ON "public"."invoices" USING "btree" ("public_payment_token");



CREATE UNIQUE INDEX "invoices_stripe_payment_intent_unique" ON "public"."invoices" USING "btree" ("stripe_payment_intent_id") WHERE ("stripe_payment_intent_id" IS NOT NULL);



CREATE UNIQUE INDEX "invoices_unique_recurring_occurrence" ON "public"."invoices" USING "btree" ("recurring_occurrence_id") WHERE ("recurring_occurrence_id" IS NOT NULL);



CREATE UNIQUE INDEX "payments_one_completed_payment_per_invoice" ON "public"."payments" USING "btree" ("invoice_id") WHERE (("stripe_payment_intent_id" IS NULL) AND ("status" = 'completed'::"text"));



CREATE UNIQUE INDEX "payments_one_completed_stripe_payment_per_invoice" ON "public"."payments" USING "btree" ("invoice_id") WHERE (("source" = ANY (ARRAY['stripe'::"text", 'autopay'::"text"])) AND ("status" = 'completed'::"text"));



CREATE UNIQUE INDEX "payments_stripe_payment_intent_unique" ON "public"."payments" USING "btree" ("stripe_payment_intent_id") WHERE ("stripe_payment_intent_id" IS NOT NULL);



CREATE INDEX "project_hour_transactions_created_at_idx" ON "public"."project_hour_transactions" USING "btree" ("created_at" DESC);



CREATE INDEX "project_hour_transactions_invoice_id_idx" ON "public"."project_hour_transactions" USING "btree" ("invoice_id");



CREATE INDEX "project_hour_transactions_project_id_idx" ON "public"."project_hour_transactions" USING "btree" ("project_id");



CREATE INDEX "project_hour_transactions_time_entry_id_idx" ON "public"."project_hour_transactions" USING "btree" ("time_entry_id");



CREATE UNIQUE INDEX "project_hour_transactions_unique_credit_reversal" ON "public"."project_hour_transactions" USING "btree" ("original_transaction_id") WHERE ("transaction_type" = 'invoice_credit_reversal'::"text");



CREATE UNIQUE INDEX "project_hour_transactions_unique_payment_item_credit" ON "public"."project_hour_transactions" USING "btree" ("payment_id", "invoice_item_id", "transaction_type") WHERE ("transaction_type" = 'invoice_credit'::"text");



CREATE INDEX "recurring_occurrences_upcoming_idx" ON "public"."recurring_invoice_occurrences" USING "btree" ("status", "scheduled_date");



CREATE INDEX "recurring_schedules_generation_idx" ON "public"."recurring_invoice_schedules" USING "btree" ("status", "next_generation_date");



CREATE OR REPLACE FUNCTION "public"."enforce_employee_project_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_consumed numeric(12,2);
  v_available numeric(12,2);
begin
  if lower(trim(coalesce(public.get_my_role(), ''))) in ('employee', 'manager') then
    if row(
      new.client_id,
      new.name,
      new.purchased_hours,
      new.status,
      new.created_at,
      new.hourly_rate,
      new.alert_hours,
      new.description,
      new.project_code,
      new.start_date
    ) is distinct from row(
      old.client_id,
      old.name,
      old.purchased_hours,
      old.status,
      old.created_at,
      old.hourly_rate,
      old.alert_hours,
      old.description,
      old.project_code,
      old.start_date
    ) then
      raise exception 'Only Admin users can modify project administration fields';
    end if;

    select
      coalesce(sum(case when tx.hours_delta < 0 then abs(tx.hours_delta) else 0 end), 0),
      coalesce(sum(tx.hours_delta), 0)
    into v_consumed, v_available
    from public.project_hour_transactions tx
    where tx.project_id = new.id;

    -- The browser currently submits cached totals after timer operations. Do
    -- not trust those values; normalize them to the authoritative ledger so
    -- the existing workflow succeeds without permitting balance tampering.
    new.used_hours := round(v_consumed, 2);
    new.remaining_hours := round(v_available, 2);
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_employee_project_update"() OWNER TO "postgres";


CREATE OR REPLACE TRIGGER "projects_enforce_employee_operational_update"
  BEFORE UPDATE ON "public"."projects"
  FOR EACH ROW EXECUTE FUNCTION "public"."enforce_employee_project_update"();



CREATE OR REPLACE TRIGGER "company_settings_set_updated_at" BEFORE UPDATE ON "public"."company_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_company_settings_updated_at"();



CREATE OR REPLACE TRIGGER "create_wallet_for_new_project" AFTER INSERT ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_project_wallet"();



CREATE OR REPLACE TRIGGER "invoices_enforce_reminder_status" BEFORE UPDATE OF "status" ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_invoice_reminder_status"();



CREATE OR REPLACE TRIGGER "maintain_wallet_from_time_entries" AFTER INSERT OR DELETE OR UPDATE ON "public"."time_entries" FOR EACH ROW EXECUTE FUNCTION "public"."handle_time_entry_wallet"();



CREATE OR REPLACE TRIGGER "recurring_items_set_updated_at" BEFORE UPDATE ON "public"."recurring_invoice_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_recurring_updated_at"();



CREATE OR REPLACE TRIGGER "recurring_occurrences_set_updated_at" BEFORE UPDATE ON "public"."recurring_invoice_occurrences" FOR EACH ROW EXECUTE FUNCTION "public"."set_recurring_updated_at"();



CREATE OR REPLACE TRIGGER "recurring_schedules_set_updated_at" BEFORE UPDATE ON "public"."recurring_invoice_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."set_recurring_updated_at"();



CREATE OR REPLACE TRIGGER "set_client_contact_updated_at" BEFORE UPDATE ON "public"."client_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."set_client_contact_updated_at"();



CREATE OR REPLACE TRIGGER "sync_project_wallet_after_transaction" AFTER INSERT OR DELETE OR UPDATE ON "public"."project_hour_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_wallet_transaction_change"();



ALTER TABLE ONLY "public"."active_timers"
    ADD CONSTRAINT "active_timers_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."active_timers"
    ADD CONSTRAINT "active_timers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_contacts"
    ADD CONSTRAINT "client_contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_settings"
    ADD CONSTRAINT "company_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."invoice_activities"
    ADD CONSTRAINT "invoice_activities_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");



ALTER TABLE ONLY "public"."invoice_payments"
    ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_reminders"
    ADD CONSTRAINT "invoice_reminders_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_reminders"
    ADD CONSTRAINT "invoice_reminders_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_recurring_occurrence_id_fkey" FOREIGN KEY ("recurring_occurrence_id") REFERENCES "public"."recurring_invoice_occurrences"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_recurring_schedule_id_fkey" FOREIGN KEY ("recurring_schedule_id") REFERENCES "public"."recurring_invoice_schedules"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_reminders_stopped_by_fkey" FOREIGN KEY ("reminders_stopped_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_reversed_by_fkey" FOREIGN KEY ("reversed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_hour_transactions"
    ADD CONSTRAINT "project_hour_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_hour_transactions"
    ADD CONSTRAINT "project_hour_transactions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_hour_transactions"
    ADD CONSTRAINT "project_hour_transactions_invoice_item_id_fkey" FOREIGN KEY ("invoice_item_id") REFERENCES "public"."invoice_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_hour_transactions"
    ADD CONSTRAINT "project_hour_transactions_original_transaction_id_fkey" FOREIGN KEY ("original_transaction_id") REFERENCES "public"."project_hour_transactions"("id");



ALTER TABLE ONLY "public"."project_hour_transactions"
    ADD CONSTRAINT "project_hour_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."invoice_payments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_hour_transactions"
    ADD CONSTRAINT "project_hour_transactions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_hour_transactions"
    ADD CONSTRAINT "project_hour_transactions_time_entry_id_fkey" FOREIGN KEY ("time_entry_id") REFERENCES "public"."time_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_notes"
    ADD CONSTRAINT "project_notes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_resources"
    ADD CONSTRAINT "project_resources_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_resources"
    ADD CONSTRAINT "project_resources_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."recurring_invoice_items"
    ADD CONSTRAINT "recurring_invoice_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."recurring_invoice_items"
    ADD CONSTRAINT "recurring_invoice_items_recurring_schedule_id_fkey" FOREIGN KEY ("recurring_schedule_id") REFERENCES "public"."recurring_invoice_schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_invoice_occurrence_items"
    ADD CONSTRAINT "recurring_invoice_occurrence_items_occurrence_id_fkey" FOREIGN KEY ("occurrence_id") REFERENCES "public"."recurring_invoice_occurrences"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_invoice_occurrence_items"
    ADD CONSTRAINT "recurring_invoice_occurrence_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."recurring_invoice_occurrences"
    ADD CONSTRAINT "recurring_invoice_occurrences_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."recurring_invoice_occurrences"
    ADD CONSTRAINT "recurring_invoice_occurrences_generated_invoice_id_fkey" FOREIGN KEY ("generated_invoice_id") REFERENCES "public"."invoices"("id");



ALTER TABLE ONLY "public"."recurring_invoice_occurrences"
    ADD CONSTRAINT "recurring_invoice_occurrences_recurring_schedule_id_fkey" FOREIGN KEY ("recurring_schedule_id") REFERENCES "public"."recurring_invoice_schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_invoice_schedules"
    ADD CONSTRAINT "recurring_invoice_schedules_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."recurring_invoice_schedules"
    ADD CONSTRAINT "recurring_invoice_schedules_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."recurring_invoice_schedules"
    ADD CONSTRAINT "recurring_invoice_schedules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."recurring_invoice_schedules"
    ADD CONSTRAINT "recurring_invoice_schedules_last_generated_invoice_id_fkey" FOREIGN KEY ("last_generated_invoice_id") REFERENCES "public"."invoices"("id");



ALTER TABLE ONLY "public"."recurring_invoices"
    ADD CONSTRAINT "recurring_invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."recurring_invoices"
    ADD CONSTRAINT "recurring_invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");



ALTER TABLE ONLY "public"."stripe_webhook_events"
    ADD CONSTRAINT "stripe_webhook_events_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");



CREATE POLICY "Admins can create invoice items" ON "public"."invoice_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'Admin'::"text")))));



CREATE POLICY "Admins can create invoices" ON "public"."invoices" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'Admin'::"text")))));



CREATE POLICY "Admins can delete invoice items" ON "public"."invoice_items" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'Admin'::"text")))));



CREATE POLICY "Admins can delete invoices" ON "public"."invoices" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'Admin'::"text")))));



CREATE POLICY "Admins can insert project notes" ON "public"."project_notes" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'Admin'::"text")))));



CREATE POLICY "Admins can manage wallet transactions" ON "public"."project_hour_transactions" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'Admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'Admin'::"text")))));



CREATE POLICY "Admins can update invoice items" ON "public"."invoice_items" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'Admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'Admin'::"text")))));



CREATE POLICY "Admins can update invoices" ON "public"."invoices" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'Admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'Admin'::"text")))));



CREATE POLICY "Admins can view invoice items" ON "public"."invoice_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'Admin'::"text")))));



CREATE POLICY "Admins can view invoices" ON "public"."invoices" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = 'Admin'::"text")))));



-- Hardened role-aware access for operational tables. These policies replace
-- the development policies that granted every authenticated user unrestricted
-- write access.

CREATE POLICY "active_timers_staff_read" ON "public"."active_timers"
  FOR SELECT TO "authenticated"
  USING (
    lower(trim(coalesce("public"."get_my_role"(), ''))) IN ('admin', 'manager')
    OR EXISTS (
      SELECT 1 FROM "public"."profiles" p
      WHERE p.user_id = auth.uid()
        AND p.employee_id = active_timers.employee_id
    )
  );

CREATE POLICY "active_timers_staff_insert" ON "public"."active_timers"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    lower(trim(coalesce("public"."get_my_role"(), ''))) IN ('admin', 'manager')
    OR (
      EXISTS (
        SELECT 1 FROM "public"."profiles" p
        WHERE p.user_id = auth.uid()
          AND p.employee_id = active_timers.employee_id
      )
      AND EXISTS (
        SELECT 1
        FROM "public"."project_resources" pr
        JOIN "public"."profiles" p ON p.employee_id = pr.employee_id
        WHERE p.user_id = auth.uid()
          AND pr.project_id = active_timers.project_id
      )
    )
  );

CREATE POLICY "active_timers_staff_update" ON "public"."active_timers"
  FOR UPDATE TO "authenticated"
  USING (
    lower(trim(coalesce("public"."get_my_role"(), ''))) IN ('admin', 'manager')
    OR EXISTS (
      SELECT 1 FROM "public"."profiles" p
      WHERE p.user_id = auth.uid()
        AND p.employee_id = active_timers.employee_id
    )
  )
  WITH CHECK (
    lower(trim(coalesce("public"."get_my_role"(), ''))) IN ('admin', 'manager')
    OR EXISTS (
      SELECT 1 FROM "public"."profiles" p
      WHERE p.user_id = auth.uid()
        AND p.employee_id = active_timers.employee_id
    )
  );

CREATE POLICY "active_timers_staff_delete" ON "public"."active_timers"
  FOR DELETE TO "authenticated"
  USING (
    lower(trim(coalesce("public"."get_my_role"(), ''))) IN ('admin', 'manager')
    OR EXISTS (
      SELECT 1 FROM "public"."profiles" p
      WHERE p.user_id = auth.uid()
        AND p.employee_id = active_timers.employee_id
    )
  );

CREATE POLICY "clients_admin_all" ON "public"."clients"
  TO "authenticated"
  USING (lower(trim(coalesce("public"."get_my_role"(), ''))) = 'admin')
  WITH CHECK (lower(trim(coalesce("public"."get_my_role"(), ''))) = 'admin');

CREATE POLICY "clients_staff_read" ON "public"."clients"
  FOR SELECT TO "authenticated"
  USING (
    lower(trim(coalesce("public"."get_my_role"(), ''))) IN ('admin', 'manager')
    OR EXISTS (
      SELECT 1
      FROM "public"."projects" project_row
      JOIN "public"."project_resources" pr ON pr.project_id = project_row.id
      JOIN "public"."profiles" p ON p.employee_id = pr.employee_id
      WHERE p.user_id = auth.uid()
        AND project_row.client_id = clients.id
    )
  );

CREATE POLICY "employees_admin_all" ON "public"."employees"
  TO "authenticated"
  USING (lower(trim(coalesce("public"."get_my_role"(), ''))) = 'admin')
  WITH CHECK (lower(trim(coalesce("public"."get_my_role"(), ''))) = 'admin');

CREATE POLICY "employees_staff_read" ON "public"."employees"
  FOR SELECT TO "authenticated"
  USING (
    lower(trim(coalesce("public"."get_my_role"(), ''))) IN ('admin', 'manager')
    OR EXISTS (
      SELECT 1 FROM "public"."profiles" p
      WHERE p.user_id = auth.uid()
        AND p.employee_id = employees.id
    )
  );

CREATE POLICY "project_resources_admin_all" ON "public"."project_resources"
  TO "authenticated"
  USING (lower(trim(coalesce("public"."get_my_role"(), ''))) = 'admin')
  WITH CHECK (lower(trim(coalesce("public"."get_my_role"(), ''))) = 'admin');

CREATE POLICY "project_resources_staff_read" ON "public"."project_resources"
  FOR SELECT TO "authenticated"
  USING (
    lower(trim(coalesce("public"."get_my_role"(), ''))) IN ('admin', 'manager')
    OR EXISTS (
      SELECT 1 FROM "public"."profiles" p
      WHERE p.user_id = auth.uid()
        AND p.employee_id = project_resources.employee_id
    )
  );

CREATE POLICY "projects_admin_all" ON "public"."projects"
  TO "authenticated"
  USING (lower(trim(coalesce("public"."get_my_role"(), ''))) = 'admin')
  WITH CHECK (lower(trim(coalesce("public"."get_my_role"(), ''))) = 'admin');

CREATE POLICY "projects_staff_read" ON "public"."projects"
  FOR SELECT TO "authenticated"
  USING (
    lower(trim(coalesce("public"."get_my_role"(), ''))) IN ('admin', 'manager')
    OR EXISTS (
      SELECT 1
      FROM "public"."project_resources" pr
      JOIN "public"."profiles" p ON p.employee_id = pr.employee_id
      WHERE p.user_id = auth.uid()
        AND pr.project_id = projects.id
    )
  );

-- The current Time page recalculates these two cached totals after writing an
-- employee's own time entry or a Manager-controlled team timer. Only
-- ledger-validated cached totals may change; project administration remains
-- Admin-only.
CREATE POLICY "projects_staff_operational_update" ON "public"."projects"
  FOR UPDATE TO "authenticated"
  USING (
    lower(trim(coalesce("public"."get_my_role"(), ''))) = 'manager'
    OR (
      lower(trim(coalesce("public"."get_my_role"(), ''))) = 'employee'
      AND EXISTS (
        SELECT 1
        FROM "public"."project_resources" pr
        JOIN "public"."profiles" p ON p.employee_id = pr.employee_id
        WHERE p.user_id = auth.uid()
          AND pr.project_id = projects.id
      )
    )
  )
  WITH CHECK (
    lower(trim(coalesce("public"."get_my_role"(), ''))) = 'manager'
    OR (
      lower(trim(coalesce("public"."get_my_role"(), ''))) = 'employee'
      AND EXISTS (
        SELECT 1
        FROM "public"."project_resources" pr
        JOIN "public"."profiles" p ON p.employee_id = pr.employee_id
        WHERE p.user_id = auth.uid()
          AND pr.project_id = projects.id
      )
    )
  );

CREATE POLICY "project_notes_admin_all" ON "public"."project_notes"
  TO "authenticated"
  USING (lower(trim(coalesce("public"."get_my_role"(), ''))) = 'admin')
  WITH CHECK (lower(trim(coalesce("public"."get_my_role"(), ''))) = 'admin');

CREATE POLICY "project_notes_staff_read" ON "public"."project_notes"
  FOR SELECT TO "authenticated"
  USING (
    lower(trim(coalesce("public"."get_my_role"(), ''))) IN ('admin', 'manager')
    OR EXISTS (
      SELECT 1
      FROM "public"."project_resources" pr
      JOIN "public"."profiles" p ON p.employee_id = pr.employee_id
      WHERE p.user_id = auth.uid()
        AND pr.project_id = project_notes.project_id
    )
  );

CREATE POLICY "time_entries_admin_all" ON "public"."time_entries"
  TO "authenticated"
  USING (lower(trim(coalesce("public"."get_my_role"(), ''))) = 'admin')
  WITH CHECK (lower(trim(coalesce("public"."get_my_role"(), ''))) = 'admin');

CREATE POLICY "time_entries_staff_read" ON "public"."time_entries"
  FOR SELECT TO "authenticated"
  USING (
    lower(trim(coalesce("public"."get_my_role"(), ''))) IN ('admin', 'manager')
    OR EXISTS (
      SELECT 1 FROM "public"."profiles" p
      WHERE p.user_id = auth.uid()
        AND p.employee_id = time_entries.employee_id
    )
  );

CREATE POLICY "time_entries_operational_insert" ON "public"."time_entries"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    lower(trim(coalesce("public"."get_my_role"(), ''))) = 'admin'
    OR (
      lower(trim(coalesce("public"."get_my_role"(), ''))) = 'manager'
      AND EXISTS (
        SELECT 1 FROM "public"."active_timers" timer_row
        WHERE timer_row.employee_id = time_entries.employee_id
          AND timer_row.project_id = time_entries.project_id
      )
    )
    OR (
      lower(trim(coalesce("public"."get_my_role"(), ''))) = 'employee'
      AND EXISTS (
        SELECT 1 FROM "public"."profiles" p
        WHERE p.user_id = auth.uid()
          AND p.employee_id = time_entries.employee_id
      )
      AND EXISTS (
        SELECT 1
        FROM "public"."project_resources" pr
        JOIN "public"."profiles" p ON p.employee_id = pr.employee_id
        WHERE p.user_id = auth.uid()
          AND pr.project_id = time_entries.project_id
      )
    )
  );



CREATE POLICY "Employees can view assigned project wallet" ON "public"."project_hour_transactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."project_resources" "pr"
     JOIN "public"."profiles" "p" ON (("p"."employee_id" = "pr"."employee_id")))
  WHERE (("p"."user_id" = "auth"."uid"()) AND ("pr"."project_id" = "project_hour_transactions"."project_id")))));



CREATE POLICY "Managers can view wallet transactions" ON "public"."project_hour_transactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['Admin'::"text", 'Manager'::"text"]))))));



CREATE POLICY "Only admin updates profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("public"."get_my_role"() = 'Admin'::"text")) WITH CHECK (("public"."get_my_role"() = 'Admin'::"text"));



CREATE POLICY "Profiles read access" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("public"."get_my_role"() = ANY (ARRAY['Admin'::"text", 'Manager'::"text"])) OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."active_timers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_contacts_admin_all" ON "public"."client_contacts" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("lower"(TRIM(BOTH FROM COALESCE("profiles"."role", ''::"text"))) = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("lower"(TRIM(BOTH FROM COALESCE("profiles"."role", ''::"text"))) = 'admin'::"text")))));



CREATE POLICY "client_contacts_manager_read" ON "public"."client_contacts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("lower"(TRIM(BOTH FROM COALESCE("profiles"."role", ''::"text"))) = 'manager'::"text")))));



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_settings_admin_all" ON "public"."company_settings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("lower"(TRIM(BOTH FROM COALESCE("profiles"."role", ''::"text"))) = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("lower"(TRIM(BOTH FROM COALESCE("profiles"."role", ''::"text"))) = 'admin'::"text")))));



ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoice_activities_staff_read" ON "public"."invoice_activities" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("lower"(TRIM(BOTH FROM COALESCE("profiles"."role", ''::"text"))) = ANY (ARRAY['admin'::"text", 'manager'::"text"]))))));



ALTER TABLE "public"."invoice_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_reminders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoice_reminders_admin_all" ON "public"."invoice_reminders" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("lower"(TRIM(BOTH FROM COALESCE("profiles"."role", ''::"text"))) = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("lower"(TRIM(BOTH FROM COALESCE("profiles"."role", ''::"text"))) = 'admin'::"text")))));



ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_admin_all" ON "public"."payments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("lower"(TRIM(BOTH FROM COALESCE("profiles"."role", ''::"text"))) = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("lower"(TRIM(BOTH FROM COALESCE("profiles"."role", ''::"text"))) = 'admin'::"text")))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_hour_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_resources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recurring_invoice_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recurring_invoice_items_admin_all" ON "public"."recurring_invoice_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("lower"(TRIM(BOTH FROM COALESCE("profiles"."role", ''::"text"))) = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("lower"(TRIM(BOTH FROM COALESCE("profiles"."role", ''::"text"))) = 'admin'::"text")))));



ALTER TABLE "public"."recurring_invoice_occurrence_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recurring_invoice_occurrence_items_admin_all" ON "public"."recurring_invoice_occurrence_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("lower"(TRIM(BOTH FROM COALESCE("profiles"."role", ''::"text"))) = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("lower"(TRIM(BOTH FROM COALESCE("profiles"."role", ''::"text"))) = 'admin'::"text")))));



ALTER TABLE "public"."recurring_invoice_occurrences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recurring_invoice_occurrences_admin_all" ON "public"."recurring_invoice_occurrences" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("lower"(TRIM(BOTH FROM COALESCE("profiles"."role", ''::"text"))) = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("lower"(TRIM(BOTH FROM COALESCE("profiles"."role", ''::"text"))) = 'admin'::"text")))));



ALTER TABLE "public"."recurring_invoice_schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recurring_invoice_schedules_admin_all" ON "public"."recurring_invoice_schedules" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("lower"(TRIM(BOTH FROM COALESCE("profiles"."role", ''::"text"))) = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."user_id" = "auth"."uid"()) AND ("lower"(TRIM(BOTH FROM COALESCE("profiles"."role", ''::"text"))) = 'admin'::"text")))));



ALTER TABLE "public"."recurring_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_webhook_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."time_entries" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_invoice_reminder_status"() FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."enforce_invoice_reminder_status"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_employee_project_update"() FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."enforce_employee_project_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_invoice_dashboard_dimensions"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_invoice_dashboard_dimensions"() TO "authenticated", "service_role";



REVOKE ALL ON FUNCTION "public"."get_invoice_kpi_summary"("p_year" integer) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_invoice_kpi_summary"("p_year" integer) TO "authenticated", "service_role";



REVOKE ALL ON FUNCTION "public"."get_invoice_monthly_summary"("p_year" integer, "p_currency" "text") FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_invoice_monthly_summary"("p_year" integer, "p_currency" "text") TO "authenticated", "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_role"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_my_role"() TO "authenticated", "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_project_wallet"() FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."handle_new_project_wallet"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_time_entry_wallet"() FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."handle_time_entry_wallet"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_wallet_transaction_change"() FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."handle_wallet_transaction_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_invoice_payment"("p_invoice_id" "uuid", "p_amount" numeric, "p_payment_date" "date", "p_payment_method" "text", "p_reference_number" "text", "p_notes" "text", "p_created_by" "uuid") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."record_invoice_payment"("p_invoice_id" "uuid", "p_amount" numeric, "p_payment_date" "date", "p_payment_method" "text", "p_reference_number" "text", "p_notes" "text", "p_created_by" "uuid") FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."record_invoice_payment"("p_invoice_id" "uuid", "p_amount" numeric, "p_payment_date" "date", "p_payment_method" "text", "p_reference_number" "text", "p_notes" "text", "p_created_by" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_stripe_invoice_payment"("p_invoice_id" "uuid", "p_amount" numeric, "p_currency" "text", "p_payment_intent_id" "text", "p_charge_id" "text", "p_customer_id" "text", "p_payment_method_id" "text", "p_source" "text") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."record_stripe_invoice_payment"("p_invoice_id" "uuid", "p_amount" numeric, "p_currency" "text", "p_payment_intent_id" "text", "p_charge_id" "text", "p_customer_id" "text", "p_payment_method_id" "text", "p_source" "text") FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."record_stripe_invoice_payment"("p_invoice_id" "uuid", "p_amount" numeric, "p_currency" "text", "p_payment_intent_id" "text", "p_charge_id" "text", "p_customer_id" "text", "p_payment_method_id" "text", "p_source" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reverse_invoice_payment"("p_invoice_id" "uuid", "p_reason" "text", "p_notes" "text", "p_reversed_by" "uuid") FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."reverse_invoice_payment"("p_invoice_id" "uuid", "p_reason" "text", "p_notes" "text", "p_reversed_by" "uuid") FROM "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."reverse_invoice_payment"("p_invoice_id" "uuid", "p_reason" "text", "p_notes" "text", "p_reversed_by" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."client_contacts" TO "anon";
GRANT ALL ON TABLE "public"."client_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."client_contacts" TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_client_contact"("p_contact_id" "uuid", "p_client_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_job_title" "text", "p_email" "text", "p_phone" "text", "p_contact_type" "text", "p_is_primary" boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."save_client_contact"("p_contact_id" "uuid", "p_client_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_job_title" "text", "p_email" "text", "p_phone" "text", "p_contact_type" "text", "p_is_primary" boolean) FROM "anon";
GRANT EXECUTE ON FUNCTION "public"."save_client_contact"("p_contact_id" "uuid", "p_client_id" "uuid", "p_first_name" "text", "p_last_name" "text", "p_job_title" "text", "p_email" "text", "p_phone" "text", "p_contact_type" "text", "p_is_primary" boolean) TO "authenticated", "service_role";



REVOKE ALL ON FUNCTION "public"."set_client_contact_updated_at"() FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."set_client_contact_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_company_settings_updated_at"() FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."set_company_settings_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_recurring_updated_at"() FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."set_recurring_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_project_wallet"("target_project_id" "uuid") FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."sync_project_wallet"("target_project_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."active_timers" TO "anon";
GRANT ALL ON TABLE "public"."active_timers" TO "authenticated";
GRANT ALL ON TABLE "public"."active_timers" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."company_settings" TO "anon";
GRANT ALL ON TABLE "public"."company_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."company_settings" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_activities" TO "anon";
GRANT ALL ON TABLE "public"."invoice_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_activities" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_items" TO "anon";
GRANT ALL ON TABLE "public"."invoice_items" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."invoice_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."invoice_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."invoice_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_payments" TO "anon";
GRANT ALL ON TABLE "public"."invoice_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_payments" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_reminders" TO "anon";
GRANT ALL ON TABLE "public"."invoice_reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_reminders" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."project_hour_transactions" TO "anon";
GRANT ALL ON TABLE "public"."project_hour_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."project_hour_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



REVOKE ALL ON TABLE "public"."project_hour_wallets" FROM PUBLIC, "anon", "authenticated";
GRANT SELECT ON TABLE "public"."project_hour_wallets" TO "authenticated", "service_role";



GRANT ALL ON TABLE "public"."project_notes" TO "anon";
GRANT ALL ON TABLE "public"."project_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."project_notes" TO "service_role";



GRANT ALL ON TABLE "public"."project_resources" TO "anon";
GRANT ALL ON TABLE "public"."project_resources" TO "authenticated";
GRANT ALL ON TABLE "public"."project_resources" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_invoice_items" TO "anon";
GRANT ALL ON TABLE "public"."recurring_invoice_items" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_invoice_items" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_invoice_occurrence_items" TO "anon";
GRANT ALL ON TABLE "public"."recurring_invoice_occurrence_items" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_invoice_occurrence_items" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_invoice_occurrences" TO "anon";
GRANT ALL ON TABLE "public"."recurring_invoice_occurrences" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_invoice_occurrences" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_invoice_schedules" TO "anon";
GRANT ALL ON TABLE "public"."recurring_invoice_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_invoice_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_invoices" TO "anon";
GRANT ALL ON TABLE "public"."recurring_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_invoices" TO "service_role";



REVOKE ALL ON TABLE "public"."stripe_webhook_events" FROM PUBLIC, "anon", "authenticated";
GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."time_entries" TO "anon";
GRANT ALL ON TABLE "public"."time_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."time_entries" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "anon", "authenticated";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, "anon", "authenticated";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon", "authenticated";


-- No public table access is required by Kairo. Public invoice and Stripe flows
-- use server-side service-role clients and remain unaffected.
REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM "anon";
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "public" FROM "anon";

NOTIFY pgrst, 'reload schema';

COMMIT;
