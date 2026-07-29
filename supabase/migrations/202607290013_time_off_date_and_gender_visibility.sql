begin;

create or replace function public.remove_ineligible_gender_leave_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gender text;
  v_eligibility text;
begin
  select lower(trim(coalesce(employee.gender, '')))
  into v_gender
  from public.employees employee
  where employee.id = new.employee_id;

  select lower(trim(coalesce(leave_type.gender_eligibility, 'all')))
  into v_eligibility
  from public.leave_types leave_type
  where leave_type.id = new.leave_type_id;

  if v_eligibility <> 'all' and v_gender <> v_eligibility then
    delete from public.employee_leave_balances balance where balance.id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists remove_ineligible_gender_leave_balance
on public.employee_leave_balances;
create trigger remove_ineligible_gender_leave_balance
after insert or update on public.employee_leave_balances
for each row execute function public.remove_ineligible_gender_leave_balance();

delete from public.employee_leave_balances balance
using public.employees employee, public.leave_types leave_type
where balance.employee_id = employee.id
  and balance.leave_type_id = leave_type.id
  and lower(trim(coalesce(leave_type.gender_eligibility, 'all'))) <> 'all'
  and lower(trim(coalesce(employee.gender, '')))
    <> lower(trim(coalesce(leave_type.gender_eligibility, 'all')));

create or replace function public.get_time_off_managed_balances(
  p_leave_year integer
)
returns table (
  id uuid,
  employee_id uuid,
  leave_year integer,
  entitled_days numeric,
  used_days numeric,
  pending_days numeric,
  available_days numeric,
  employee_name text,
  employee_title text,
  employee_code text,
  leave_type_name text,
  leave_type_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_employee_id uuid := public.get_my_employee_id();
  v_role text;
  v_employee record;
begin
  if p_leave_year < 2000 or p_leave_year > 2200 then
    raise exception 'Select a valid leave year.';
  end if;

  select lower(trim(profile.role)) into v_role
  from public.profiles profile
  where profile.user_id = auth.uid();

  if v_current_employee_id is null
    or v_role not in ('manager', 'admin', 'super admin', 'finance admin') then
    raise exception 'You do not have access to managed leave balances.';
  end if;

  for v_employee in
    select employee.id
    from public.employees employee
    where employee.status = 'active'
      and employee.id <> v_current_employee_id
      and (
        v_role in ('admin', 'super admin', 'finance admin')
        or employee.reporting_manager_id = v_current_employee_id
      )
  loop
    perform public.time_off_refresh_balances(v_employee.id, p_leave_year);
  end loop;

  return query
  select
    balance.id,
    balance.employee_id,
    balance.leave_year,
    balance.entitled_days,
    balance.used_days,
    balance.pending_days,
    balance.available_days,
    employee.name,
    employee.title,
    employee.employee_code,
    leave_type.name,
    leave_type.code
  from public.employee_leave_balances balance
  join public.employees employee on employee.id = balance.employee_id
  join public.leave_types leave_type on leave_type.id = balance.leave_type_id
  where balance.leave_year = p_leave_year
    and employee.status = 'active'
    and employee.id <> v_current_employee_id
    and (
      v_role in ('admin', 'super admin', 'finance admin')
      or employee.reporting_manager_id = v_current_employee_id
    )
    and (
      lower(trim(coalesce(leave_type.gender_eligibility, 'all'))) = 'all'
      or lower(trim(coalesce(employee.gender, '')))
        = lower(trim(leave_type.gender_eligibility))
    )
  order by employee.employee_code nulls last,
    employee.name, leave_type.display_order, leave_type.name;
end;
$$;

revoke all on function public.remove_ineligible_gender_leave_balance()
from public, anon, authenticated;
grant execute on function public.remove_ineligible_gender_leave_balance()
to service_role;
revoke all on function public.get_time_off_managed_balances(integer)
from public, anon;
grant execute on function public.get_time_off_managed_balances(integer)
to authenticated;

notify pgrst, 'reload schema';

commit;
