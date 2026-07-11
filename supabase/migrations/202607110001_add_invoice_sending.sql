alter table public.invoices
  add column if not exists sent_at timestamp with time zone,
  add column if not exists sent_to text,
  add column if not exists email_subject text,
  add column if not exists email_body text,
  add column if not exists gmail_message_id text;
