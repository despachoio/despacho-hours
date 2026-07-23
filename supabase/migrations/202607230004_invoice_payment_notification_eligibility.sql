begin;

alter table public.invoices
  add column if not exists payment_notification_eligible boolean not null default false;

alter table public.invoices
  drop constraint if exists invoices_payment_notification_status_check;

alter table public.invoices
  add constraint invoices_payment_notification_status_check
  check (
    payment_notification_status in (
      'pending',
      'processing',
      'sent',
      'failed',
      'skipped'
    )
  );

create or replace function public.set_invoice_payment_notification_eligibility()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if lower(coalesce(new.status, '')) = 'paid'
    and lower(coalesce(old.status, '')) <> 'paid'
  then
    new.payment_notification_eligible := true;
    new.payment_notification_status := 'pending';
    new.payment_notification_claimed_at := null;
    new.payment_notification_error := null;
  elsif lower(coalesce(old.status, '')) = 'paid'
    and lower(coalesce(new.status, '')) <> 'paid'
  then
    new.payment_notification_eligible := false;
    new.payment_notification_status := 'skipped';
    new.payment_notification_claimed_at := null;
    new.payment_notification_error := 'Payment is no longer active';
  end if;

  return new;
end;
$$;

drop trigger if exists set_invoice_payment_notification_eligibility
  on public.invoices;

create trigger set_invoice_payment_notification_eligibility
before update of status on public.invoices
for each row
execute function public.set_invoice_payment_notification_eligibility();

-- Every invoice that is already paid when this migration runs is legacy.
-- New payment flows explicitly opt an invoice in after recording the payment.
update public.invoices
set payment_notification_eligible = false,
    payment_notification_status = case
      when receipt_sent_at is not null
        and payment_intimation_sent_at is not null
      then 'sent'
      else 'skipped'
    end,
    payment_notification_claimed_at = null,
    payment_notification_error = 'Legacy payment receipt suppressed on 2026-07-23'
where lower(coalesce(status, '')) = 'paid';

create or replace function public.claim_invoice_payment_notification(
  p_invoice_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
begin
  select invoice_row.* into v_invoice
  from public.invoices as invoice_row
  where invoice_row.id = p_invoice_id
  for update;

  if not found
    or lower(coalesce(v_invoice.status, '')) <> 'paid'
    or not coalesce(v_invoice.payment_notification_eligible, false)
  then
    return false;
  end if;

  if v_invoice.receipt_sent_at is not null
    and v_invoice.payment_intimation_sent_at is not null then
    update public.invoices
    set payment_notification_status = 'sent',
        payment_notification_error = null
    where id = p_invoice_id;
    return false;
  end if;

  if v_invoice.payment_notification_status = 'processing'
    and v_invoice.payment_notification_claimed_at > now() - interval '10 minutes'
  then
    return false;
  end if;

  update public.invoices
  set payment_notification_status = 'processing',
      payment_notification_claimed_at = now(),
      payment_notification_error = null
  where id = p_invoice_id;

  return true;
end;
$$;

revoke all on function public.claim_invoice_payment_notification(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_invoice_payment_notification(uuid)
  to service_role;

comment on column public.invoices.payment_notification_eligible is
  'True only when a payment recorded after notification activation may send a receipt.';

comment on function public.set_invoice_payment_notification_eligibility() is
  'Opts in only invoices that transition from unpaid to paid after activation.';

comment on function public.claim_invoice_payment_notification(uuid) is
  'Claims notifications only for explicitly eligible, newly paid invoices.';

commit;
