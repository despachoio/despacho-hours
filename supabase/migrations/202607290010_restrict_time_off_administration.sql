begin;

create or replace function public.time_off_can_administer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_my_actual_role() in ('super admin', 'finance admin')
$$;

create or replace function public.enforce_time_off_administration_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Database migrations and trusted service operations have no end-user UID.
  if auth.uid() is not null and not public.time_off_can_administer() then
    raise exception 'Only a Super Admin or Finance Admin can perform Time Off administration.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop policy if exists leave_types_admin_write on public.leave_types;
create policy leave_types_admin_write on public.leave_types
for all to authenticated using (public.time_off_can_administer())
with check (public.time_off_can_administer());

drop policy if exists leave_policies_admin_write on public.leave_policies;
create policy leave_policies_admin_write on public.leave_policies
for all to authenticated using (public.time_off_can_administer())
with check (public.time_off_can_administer());

drop policy if exists leave_policy_rules_admin_write on public.leave_policy_rules;
create policy leave_policy_rules_admin_write on public.leave_policy_rules
for all to authenticated using (public.time_off_can_administer())
with check (public.time_off_can_administer());

drop policy if exists leave_policy_assignments_admin_all on public.leave_policy_assignments;
create policy leave_policy_assignments_admin_all on public.leave_policy_assignments
for all to authenticated using (public.time_off_can_administer())
with check (public.time_off_can_administer());

drop policy if exists holiday_calendars_admin_write on public.holiday_calendars;
create policy holiday_calendars_admin_write on public.holiday_calendars
for all to authenticated using (public.time_off_can_administer())
with check (public.time_off_can_administer());

drop policy if exists holidays_admin_write on public.holidays;
create policy holidays_admin_write on public.holidays
for all to authenticated using (public.time_off_can_administer())
with check (public.time_off_can_administer());

drop policy if exists leave_closures_scoped_read on public.leave_year_closures;
create policy leave_closures_scoped_read on public.leave_year_closures
for select to authenticated using (
  employee_id = public.get_my_employee_id()
  or public.time_off_can_administer()
);

drop policy if exists leave_encashments_scoped_read on public.leave_encashments;
create policy leave_encashments_scoped_read on public.leave_encashments
for select to authenticated using (
  employee_id = public.get_my_employee_id()
  or public.time_off_can_administer()
);

drop policy if exists time_off_audit_admin_read on public.time_off_audit_log;
create policy time_off_audit_admin_read on public.time_off_audit_log
for select to authenticated using (public.time_off_can_administer());

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'leave_types', 'leave_policies', 'leave_policy_rules',
    'leave_policy_assignments', 'holiday_calendars', 'holidays',
    'leave_balance_adjustments', 'leave_year_closures', 'leave_encashments'
  ]
  loop
    execute format(
      'drop trigger if exists %I on public.%I',
      v_table || '_administration_guard', v_table
    );
    execute format(
      'create trigger %I before insert or update or delete on public.%I for each row execute function public.enforce_time_off_administration_access()',
      v_table || '_administration_guard', v_table
    );
  end loop;
end
$$;

revoke all on function public.time_off_can_administer() from public, anon;
revoke all on function public.enforce_time_off_administration_access()
from public, anon, authenticated;
grant execute on function public.time_off_can_administer()
to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
