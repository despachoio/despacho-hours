begin;

create table if not exists public.employee_finance_details (
  employee_id uuid primary key
    references public.employees(id)
    on delete cascade,
  epf_number text,
  uan_number text,
  bank_account_number text,
  bank_name text,
  ifsc_code text,
  branch_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.employee_finance_details (
  employee_id,
  epf_number,
  uan_number,
  bank_account_number,
  bank_name,
  ifsc_code,
  branch_name
)
select
  employee.id,
  nullif(trim(coalesce(employee.epf_number, '')), ''),
  nullif(trim(coalesce(employee.uan_number, '')), ''),
  nullif(trim(coalesce(extended.bank_account_number, '')), ''),
  nullif(trim(coalesce(extended.bank_name, '')), ''),
  nullif(upper(trim(coalesce(extended.ifsc_code, ''))), ''),
  nullif(trim(coalesce(extended.branch_name, '')), '')
from public.employees employee
left join public.employee_extended_details extended
  on extended.employee_id = employee.id
on conflict (employee_id) do update
set epf_number = coalesce(
      excluded.epf_number,
      employee_finance_details.epf_number
    ),
    uan_number = coalesce(
      excluded.uan_number,
      employee_finance_details.uan_number
    ),
    bank_account_number = coalesce(
      excluded.bank_account_number,
      employee_finance_details.bank_account_number
    ),
    bank_name = coalesce(
      excluded.bank_name,
      employee_finance_details.bank_name
    ),
    ifsc_code = coalesce(
      excluded.ifsc_code,
      employee_finance_details.ifsc_code
    ),
    branch_name = coalesce(
      excluded.branch_name,
      employee_finance_details.branch_name
    ),
    updated_at = now();

-- Remove the duplicated values from tables readable by non-finance roles.
update public.employees
set epf_number = null,
    uan_number = null
where epf_number is not null
   or uan_number is not null;

update public.employee_extended_details
set bank_account_number = null,
    bank_name = null,
    ifsc_code = null,
    branch_name = null,
    updated_at = now()
where bank_account_number is not null
   or bank_name is not null
   or ifsc_code is not null
   or branch_name is not null;

alter table public.employee_finance_details enable row level security;

revoke all on table public.employee_finance_details from public, anon;
grant select, insert, update, delete
  on table public.employee_finance_details
  to authenticated, service_role;

drop policy if exists employee_finance_details_finance_admin_all
  on public.employee_finance_details;
drop policy if exists employee_finance_details_self_read
  on public.employee_finance_details;

create policy employee_finance_details_finance_admin_all
on public.employee_finance_details to authenticated
using (public.get_my_actual_role() = 'finance admin')
with check (public.get_my_actual_role() = 'finance admin');

create policy employee_finance_details_self_read
on public.employee_finance_details for select to authenticated
using (employee_id = public.get_my_employee_id());

create or replace function public.employee_profile_request_has_finance_changes(
  p_current_values jsonb,
  p_proposed_changes jsonb
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select exists (
    select 1
    from unnest(array[
      'epf_number',
      'uan_number',
      'bank_account_number',
      'bank_name',
      'ifsc_code',
      'branch_name'
    ]) as finance_key
    where p_current_values ->> finance_key
      is distinct from p_proposed_changes ->> finance_key
  )
$$;

revoke all on function public.employee_profile_request_has_finance_changes(
  jsonb,
  jsonb
) from public, anon;
grant execute on function public.employee_profile_request_has_finance_changes(
  jsonb,
  jsonb
) to authenticated, service_role;

-- Admin and Super Admin can review non-finance changes. Finance-related
-- requests are visible to Finance Admin only (plus the requesting employee).
drop policy if exists employee_profile_requests_admin_read
  on public.employee_profile_change_requests;
create policy employee_profile_requests_admin_read
on public.employee_profile_change_requests for select to authenticated
using (
  public.get_my_actual_role() = 'finance admin'
  or (
    public.get_my_actual_role() = 'super admin'
    and not public.employee_profile_request_has_finance_changes(
      current_values,
      proposed_changes
    )
  )
  or (
    public.get_my_actual_role() = 'admin'
    and not public.is_super_admin_employee(employee_id)
    and not public.employee_profile_request_has_finance_changes(
      current_values,
      proposed_changes
    )
  )
);

create or replace function public.enforce_finance_profile_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'pending'
    and new.status in ('approved', 'rejected')
    and public.employee_profile_request_has_finance_changes(
      new.current_values,
      new.proposed_changes
    )
    and public.get_my_actual_role() <> 'finance admin'
  then
    raise exception
      'Only a Finance Admin can review a request containing finance changes';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_finance_profile_review
  on public.employee_profile_change_requests;
create trigger enforce_finance_profile_review
before update of status on public.employee_profile_change_requests
for each row execute function public.enforce_finance_profile_review();

revoke all on function public.enforce_finance_profile_review()
  from public, anon, authenticated;

-- The existing approval function writes the proposed values to legacy columns.
-- Move those values into the protected table and immediately clear the copies.
create or replace function public.secure_approved_employee_finance_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved'
    and old.status is distinct from new.status
  then
    insert into public.employee_finance_details (
      employee_id,
      epf_number,
      uan_number,
      bank_account_number,
      bank_name,
      ifsc_code,
      branch_name,
      updated_at
    )
    values (
      new.employee_id,
      nullif(trim(coalesce(new.proposed_changes ->> 'epf_number', '')), ''),
      nullif(trim(coalesce(new.proposed_changes ->> 'uan_number', '')), ''),
      nullif(trim(coalesce(
        new.proposed_changes ->> 'bank_account_number',
        ''
      )), ''),
      nullif(trim(coalesce(new.proposed_changes ->> 'bank_name', '')), ''),
      nullif(upper(trim(coalesce(
        new.proposed_changes ->> 'ifsc_code',
        ''
      ))), ''),
      nullif(trim(coalesce(new.proposed_changes ->> 'branch_name', '')), ''),
      now()
    )
    on conflict (employee_id) do update
    set epf_number = case
          when new.proposed_changes ? 'epf_number'
            then excluded.epf_number
          else employee_finance_details.epf_number
        end,
        uan_number = case
          when new.proposed_changes ? 'uan_number'
            then excluded.uan_number
          else employee_finance_details.uan_number
        end,
        bank_account_number = case
          when new.proposed_changes ? 'bank_account_number'
            then excluded.bank_account_number
          else employee_finance_details.bank_account_number
        end,
        bank_name = case
          when new.proposed_changes ? 'bank_name'
            then excluded.bank_name
          else employee_finance_details.bank_name
        end,
        ifsc_code = case
          when new.proposed_changes ? 'ifsc_code'
            then excluded.ifsc_code
          else employee_finance_details.ifsc_code
        end,
        branch_name = case
          when new.proposed_changes ? 'branch_name'
            then excluded.branch_name
          else employee_finance_details.branch_name
        end,
        updated_at = now();

    update public.employees
    set epf_number = null,
        uan_number = null
    where id = new.employee_id;

    update public.employee_extended_details
    set bank_account_number = null,
        bank_name = null,
        ifsc_code = null,
        branch_name = null,
        updated_at = now()
    where employee_id = new.employee_id;
  end if;

  return new;
end;
$$;

drop trigger if exists secure_approved_employee_finance_changes
  on public.employee_profile_change_requests;
create trigger secure_approved_employee_finance_changes
after update of status on public.employee_profile_change_requests
for each row execute function public.secure_approved_employee_finance_changes();

revoke all on function public.secure_approved_employee_finance_changes()
  from public, anon, authenticated;

comment on table public.employee_finance_details is
  'Finance-admin protected payroll and banking details; employees retain self-read access.';

commit;
