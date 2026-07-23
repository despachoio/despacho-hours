begin;

-- Preserve the stored role for top-level role-governance decisions.
create or replace function public.get_my_actual_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(coalesce(role, '')))
  from public.profiles
  where user_id = auth.uid()
  limit 1
$$;

revoke all on function public.get_my_actual_role() from public, anon;
grant execute on function public.get_my_actual_role()
  to authenticated, service_role;

-- Bootstrap the first Finance Admin before the access policies are replaced.
do $$
declare
  v_match_count integer;
  v_user_id uuid;
begin
  select count(distinct profile.user_id)
  into v_match_count
  from public.profiles profile
  left join public.employees employee
    on employee.id = profile.employee_id
  where lower(trim(coalesce(employee.name, ''))) = 'rajeeth dhasthagir'
    or lower(trim(coalesce(profile.full_name, ''))) = 'rajeeth dhasthagir';

  if v_match_count <> 1 then
    raise exception
      'Expected exactly one Kairo profile for Rajeeth Dhasthagir, found %',
      v_match_count;
  end if;

  select profile.user_id
  into v_user_id
  from public.profiles profile
  left join public.employees employee
    on employee.id = profile.employee_id
  where lower(trim(coalesce(employee.name, ''))) = 'rajeeth dhasthagir'
    or lower(trim(coalesce(profile.full_name, ''))) = 'rajeeth dhasthagir'
  limit 1;

  update public.profiles
  set role = 'Super Admin'
  where lower(trim(coalesce(role, ''))) = 'finance admin'
    and user_id <> v_user_id;

  update public.profiles
  set role = 'Finance Admin'
  where user_id = v_user_id;
end
$$;

-- Existing operational RLS policies recognize Super Admin through this
-- helper. Mapping Finance Admin to that effective role provides identical
-- operational access without weakening role-governance rules.
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.get_my_actual_role() = 'finance admin' then 'super admin'
    else public.get_my_actual_role()
  end
$$;

revoke all on function public.get_my_role() from public, anon;
grant execute on function public.get_my_role()
  to authenticated, service_role;

-- Finance Admin is the only role that can grant or remove Finance Admin.
drop policy if exists "Finance Admins can update profiles" on public.profiles;
drop policy if exists "Super Admins can update profiles" on public.profiles;
drop policy if exists "Admins can update non-super-admin profiles"
  on public.profiles;
drop policy if exists "Finance Admins can insert profiles" on public.profiles;
drop policy if exists "Super Admins can insert profiles" on public.profiles;
drop policy if exists "Admins can insert non-super-admin profiles"
  on public.profiles;
drop policy if exists "Finance Admins can delete profiles" on public.profiles;
drop policy if exists "Super Admins can delete profiles" on public.profiles;
drop policy if exists "Admins can delete profiles" on public.profiles;

create policy "Finance Admins can update profiles"
on public.profiles for update to authenticated
using (public.get_my_actual_role() = 'finance admin')
with check (
  public.get_my_actual_role() = 'finance admin'
  and lower(trim(coalesce(role, ''))) in (
    'finance admin', 'super admin', 'admin', 'manager', 'employee'
  )
);

create policy "Super Admins can update profiles"
on public.profiles for update to authenticated
using (
  public.get_my_actual_role() = 'super admin'
  and lower(trim(coalesce(role, ''))) <> 'finance admin'
)
with check (
  public.get_my_actual_role() = 'super admin'
  and lower(trim(coalesce(role, ''))) in (
    'super admin', 'admin', 'manager', 'employee'
  )
);

create policy "Admins can update non-super-admin profiles"
on public.profiles for update to authenticated
using (
  public.get_my_actual_role() = 'admin'
  and lower(trim(coalesce(role, ''))) not in (
    'finance admin', 'super admin'
  )
)
with check (
  public.get_my_actual_role() = 'admin'
  and lower(trim(coalesce(role, ''))) in ('admin', 'manager', 'employee')
);

create policy "Finance Admins can insert profiles"
on public.profiles for insert to authenticated
with check (
  public.get_my_actual_role() = 'finance admin'
  and lower(trim(coalesce(role, ''))) in (
    'finance admin', 'super admin', 'admin', 'manager', 'employee'
  )
);

create policy "Super Admins can insert profiles"
on public.profiles for insert to authenticated
with check (
  public.get_my_actual_role() = 'super admin'
  and lower(trim(coalesce(role, ''))) in (
    'super admin', 'admin', 'manager', 'employee'
  )
);

create policy "Admins can insert non-super-admin profiles"
on public.profiles for insert to authenticated
with check (
  public.get_my_actual_role() = 'admin'
  and lower(trim(coalesce(role, ''))) in ('admin', 'manager', 'employee')
);

create policy "Finance Admins can delete profiles"
on public.profiles for delete to authenticated
using (public.get_my_actual_role() = 'finance admin');

create policy "Super Admins can delete profiles"
on public.profiles for delete to authenticated
using (
  public.get_my_actual_role() = 'super admin'
  and lower(trim(coalesce(role, ''))) <> 'finance admin'
);

create policy "Admins can delete profiles"
on public.profiles for delete to authenticated
using (
  public.get_my_actual_role() = 'admin'
  and lower(trim(coalesce(role, ''))) not in (
    'finance admin', 'super admin'
  )
);

-- Existing Admin restrictions must protect both top-level roles.
create or replace function public.is_super_admin_employee(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where employee_id = p_employee_id
      and lower(trim(coalesce(role, ''))) in (
        'finance admin', 'super admin'
      )
  )
$$;

revoke all on function public.is_super_admin_employee(uuid) from public, anon;
grant execute on function public.is_super_admin_employee(uuid)
  to authenticated, service_role;

create or replace function public.validate_employee_reporting_manager()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reporting_manager_id is null then
    return new;
  end if;

  if new.reporting_manager_id = new.id then
    raise exception 'An employee cannot report to themselves';
  end if;

  if not exists (
    select 1
    from public.employees manager_employee
    join public.profiles manager_profile
      on manager_profile.employee_id = manager_employee.id
    where manager_employee.id = new.reporting_manager_id
      and lower(trim(coalesce(manager_profile.role, ''))) in (
        'manager', 'admin', 'super admin', 'finance admin'
      )
      and lower(trim(coalesce(manager_employee.status, 'active'))) = 'active'
  ) then
    raise exception
      'Reporting manager must be an active Manager, Admin, Super Admin, or Finance Admin';
  end if;

  return new;
end;
$$;

create or replace function public.get_reporting_manager_options()
returns table (
  id uuid,
  name text,
  access_role text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    employee.id,
    concat_ws(' ', nullif(employee.title, ''), employee.name)::text,
    profile.role
  from public.profiles profile
  join public.employees employee on employee.id = profile.employee_id
  where public.get_my_actual_role() in (
      'admin', 'super admin', 'finance admin'
    )
    and lower(trim(coalesce(profile.role, ''))) in (
      'manager', 'admin', 'super admin', 'finance admin'
    )
    and lower(trim(coalesce(employee.status, 'active'))) = 'active'
  order by
    case lower(trim(coalesce(profile.role, '')))
      when 'finance admin' then 1
      when 'super admin' then 2
      when 'admin' then 3
      else 4
    end,
    employee.name;
$$;

revoke all on function public.get_reporting_manager_options()
  from public, anon;
grant execute on function public.get_reporting_manager_options()
  to authenticated, service_role;

-- Finance Admins retain personal timer access.
create or replace function public.start_own_timer(
  p_project_id uuid,
  p_description text default null
)
returns public.active_timers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_timer public.active_timers;
begin
  select * into v_profile
  from public.profiles
  where user_id = auth.uid();

  if not found or v_profile.employee_id is null then
    raise exception 'Your employee profile is not configured.';
  end if;

  if lower(trim(coalesce(v_profile.role, ''))) not in (
    'finance admin', 'super admin', 'admin', 'manager', 'employee'
  ) then
    raise exception 'Timer access is not available for this account.';
  end if;

  if not exists (
    select 1 from public.employees
    where id = v_profile.employee_id
      and lower(trim(coalesce(status, ''))) = 'active'
  ) then
    raise exception 'Your employee account is not active.';
  end if;

  if not exists (
    select 1 from public.projects
    where id = p_project_id
      and lower(trim(coalesce(status, ''))) = 'active'
  ) then
    raise exception 'Select an active project.';
  end if;

  if not exists (
    select 1 from public.project_resources
    where employee_id = v_profile.employee_id
      and project_id = p_project_id
  ) then
    raise exception 'This project is not assigned to you.';
  end if;

  insert into public.active_timers (
    employee_id,
    project_id,
    description,
    status,
    started_at,
    total_paused_seconds
  ) values (
    v_profile.employee_id,
    p_project_id,
    nullif(trim(coalesce(p_description, '')), ''),
    'running',
    now(),
    0
  )
  returning * into v_timer;

  return v_timer;
exception
  when unique_violation then
    raise exception 'You already have an active timer.';
end;
$$;

revoke all on function public.start_own_timer(uuid, text)
  from public, anon;
grant execute on function public.start_own_timer(uuid, text)
  to authenticated;

-- Payment reversal has an internal actor-role check in addition to RLS.
create or replace function public.reverse_invoice_payment(
  p_invoice_id uuid,
  p_reason text,
  p_notes text,
  p_reversed_by uuid
)
returns table (
  invoice_id uuid,
  invoice_status text,
  payment_id uuid,
  total_reversed_hours numeric,
  projects_affected integer
)
language plpgsql
security definer
set search_path = public
as $$
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
      and lower(trim(coalesce(role, ''))) in (
        'finance admin', 'super admin'
      )
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
  when unique_violation then
    raise exception 'Payment has already been reversed.';
  when others then raise;
end;
$$;

revoke all on function public.reverse_invoice_payment(
  uuid, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.reverse_invoice_payment(
  uuid, text, text, uuid
) to service_role;

comment on function public.get_my_actual_role() is
  'Returns the stored Kairo role without Finance Admin inheritance mapping.';

commit;
