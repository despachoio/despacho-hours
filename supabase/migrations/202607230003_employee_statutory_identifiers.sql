begin;

create table if not exists public.employee_statutory_details (
  employee_id uuid primary key
    references public.employees(id)
    on delete cascade,
  pan_number text,
  aadhaar_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_statutory_details_pan_check
    check (
      pan_number is null
      or pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'
    ),
  constraint employee_statutory_details_aadhaar_check
    check (
      aadhaar_number is null
      or aadhaar_number ~ '^[0-9]{12}$'
    )
);

create unique index if not exists employee_statutory_details_pan_unique
  on public.employee_statutory_details(pan_number)
  where pan_number is not null;

create unique index if not exists employee_statutory_details_aadhaar_unique
  on public.employee_statutory_details(aadhaar_number)
  where aadhaar_number is not null;

alter table public.employee_statutory_details enable row level security;

revoke all on table public.employee_statutory_details from public, anon;
grant select, insert, update, delete
  on table public.employee_statutory_details
  to authenticated, service_role;

drop policy if exists employee_statutory_details_super_admin_all
  on public.employee_statutory_details;
drop policy if exists employee_statutory_details_admin_ordinary_all
  on public.employee_statutory_details;

create policy employee_statutory_details_super_admin_all
on public.employee_statutory_details to authenticated
using (
  lower(trim(coalesce(public.get_my_role(), ''))) = 'super admin'
)
with check (
  lower(trim(coalesce(public.get_my_role(), ''))) = 'super admin'
);

create policy employee_statutory_details_admin_ordinary_all
on public.employee_statutory_details to authenticated
using (
  lower(trim(coalesce(public.get_my_role(), ''))) = 'admin'
  and not public.is_super_admin_employee(employee_id)
)
with check (
  lower(trim(coalesce(public.get_my_role(), ''))) = 'admin'
  and not public.is_super_admin_employee(employee_id)
);

comment on table public.employee_statutory_details is
  'Restricted statutory identifiers for payroll and compliance workflows.';
comment on column public.employee_statutory_details.pan_number is
  'Indian Permanent Account Number. Visible only to Admin and Super Admin roles.';
comment on column public.employee_statutory_details.aadhaar_number is
  'Indian Aadhaar number. Visible only to Admin and Super Admin roles.';

commit;
