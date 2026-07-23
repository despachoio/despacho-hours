alter table public.invoices
  add column if not exists receipt_sent_at timestamptz,
  add column if not exists receipt_sent_to text,
  add column if not exists receipt_gmail_message_id text,
  add column if not exists payment_intimation_sent_at timestamptz,
  add column if not exists payment_intimation_sent_to text,
  add column if not exists payment_intimation_gmail_message_id text,
  add column if not exists payment_notification_status text not null default 'pending',
  add column if not exists payment_notification_claimed_at timestamptz,
  add column if not exists payment_notification_error text;

alter table public.invoices
  drop constraint if exists invoices_payment_notification_status_check;

alter table public.invoices
  add constraint invoices_payment_notification_status_check
  check (
    payment_notification_status in ('pending', 'processing', 'sent', 'failed')
  );

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

  if not found or lower(coalesce(v_invoice.status, '')) <> 'paid' then
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

comment on function public.claim_invoice_payment_notification(uuid) is
  'Claims idempotent client receipt and internal payment-intimation delivery after an invoice is paid.';
