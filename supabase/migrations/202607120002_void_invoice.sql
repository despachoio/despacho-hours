alter table public.invoices
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id),
  add column if not exists void_reason text,
  add column if not exists void_notes text;

notify pgrst, 'reload schema';
