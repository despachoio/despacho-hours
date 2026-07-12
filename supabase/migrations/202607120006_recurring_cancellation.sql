alter table public.recurring_invoice_schedules
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id);

notify pgrst, 'reload schema';
