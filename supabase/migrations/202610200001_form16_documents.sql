begin;

create table if not exists public.payroll_form16_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  financial_year text not null check (financial_year ~ '^[0-9]{4}-[0-9]{2}$'),
  storage_path text not null unique,
  file_name text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  issued_on date not null,
  uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id, financial_year)
);

create index if not exists payroll_form16_documents_employee_year_idx
  on public.payroll_form16_documents(employee_id, financial_year desc);

alter table public.payroll_form16_documents enable row level security;

create policy payroll_form16_documents_finance_all
  on public.payroll_form16_documents for all to authenticated
  using (public.get_my_actual_role() = 'finance admin')
  with check (public.get_my_actual_role() = 'finance admin');

create policy payroll_form16_documents_employee_read
  on public.payroll_form16_documents for select to authenticated
  using (employee_id = public.get_my_employee_id());

revoke all on public.payroll_form16_documents from anon;
grant select, insert, update, delete on public.payroll_form16_documents to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payroll-form16', 'payroll-form16', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

comment on table public.payroll_form16_documents is
  'Finance-issued Form 16 PDFs obtained from TRACES. Kairo stores and distributes the original PDF without regenerating or altering it.';

commit;
