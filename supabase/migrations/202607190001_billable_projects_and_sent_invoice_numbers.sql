alter table public.projects
  add column if not exists is_billable boolean not null default true;

comment on column public.projects.is_billable is
  'Whether time tracked against the project is billable to the client.';

alter table public.invoices
  alter column invoice_number drop default,
  alter column invoice_number drop not null;

-- Drafts created before this migration received a number too early.
update public.invoices
set draft_email_subject = case
      when draft_email_subject is null then null
      else replace(draft_email_subject, invoice_number::text, '{{invoice_number}}')
    end,
    draft_email_body = case
      when draft_email_body is null then null
      else replace(draft_email_body, invoice_number::text, '{{invoice_number}}')
    end,
    invoice_number = null
where lower(coalesce(status, 'draft')) = 'draft';

create or replace function public.reserve_invoice_number_for_send()
returns bigint
language sql
security definer
set search_path = public
as $$
  select nextval('public.invoice_number_seq');
$$;

revoke all on function public.reserve_invoice_number_for_send() from public;
revoke all on function public.reserve_invoice_number_for_send() from anon;
revoke all on function public.reserve_invoice_number_for_send() from authenticated;
grant execute on function public.reserve_invoice_number_for_send() to service_role;

comment on function public.reserve_invoice_number_for_send() is
  'Reserves a concurrency-safe invoice number for the server-side send flow. The number is persisted only after delivery succeeds.';
