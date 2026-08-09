begin;

-- Extend the existing version table so every version contains the complete
-- salary composition used by payroll. Existing payroll_entries remain intact.
alter table public.salary_structures
  add column if not exists basic_pay numeric(14,2),
  add column if not exists hra numeric(14,2),
  add column if not exists conveyance_allowance numeric(14,2),
  add column if not exists other_allowance numeric(14,2),
  add column if not exists epf_salary numeric(14,2),
  add column if not exists employee_pf numeric(14,2),
  add column if not exists employer_pf numeric(14,2),
  add column if not exists employer_eps numeric(14,2);

with calculated as (
  select
    structure.id,
    case when structure.gross_salary <= 16800 then 15000 else round(structure.gross_salary * 0.50, 2) end as basic_pay,
    coalesce((select conveyance_allowance from public.payroll_settings where singleton_key = true), 1600) as conveyance_allowance
  from public.salary_structures structure
), completed as (
  select
    structure.id,
    calculated.basic_pay,
    case when structure.gross_salary <= 16800 then 0 else round(calculated.basic_pay * 0.40, 2) end as hra,
    calculated.conveyance_allowance,
    least(calculated.basic_pay, 15000) as epf_salary,
    structure.gross_salary
  from public.salary_structures structure
  join calculated on calculated.id = structure.id
), contributions as (
  select
    completed.*,
    round(completed.epf_salary * 0.12) as employee_pf,
    least(round(completed.epf_salary * 0.0833), 1250) as employer_eps
  from completed
)
update public.salary_structures structure
set
  basic_pay = contributions.basic_pay,
  hra = contributions.hra,
  conveyance_allowance = contributions.conveyance_allowance,
  other_allowance = contributions.gross_salary - contributions.basic_pay - contributions.hra - contributions.conveyance_allowance,
  epf_salary = contributions.epf_salary,
  employee_pf = contributions.employee_pf,
  employer_eps = contributions.employer_eps,
  employer_pf = contributions.employee_pf - contributions.employer_eps
from contributions
where structure.id = contributions.id
  and structure.basic_pay is null;

alter table public.salary_structures
  alter column basic_pay set not null,
  alter column hra set not null,
  alter column conveyance_allowance set not null,
  alter column other_allowance set not null,
  alter column epf_salary set not null,
  alter column employee_pf set not null,
  alter column employer_pf set not null,
  alter column employer_eps set not null,
  alter column is_active set default false;

create unique index if not exists salary_structures_employee_effective_unique_idx
  on public.salary_structures(employee_id, effective_from);

create index if not exists salary_structures_employee_effective_lookup_idx
  on public.salary_structures(employee_id, effective_from desc, version desc);

create or replace function public.refresh_salary_structure_timeline(p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.salary_structures structure
  set effective_to = timeline.next_effective_from - 1
  from (
    select
      id,
      lead(effective_from) over (order by effective_from, version) as next_effective_from
    from public.salary_structures
    where employee_id = p_employee_id
  ) timeline
  where structure.id = timeline.id
    and structure.effective_to is distinct from timeline.next_effective_from - 1;

  update public.salary_structures
  set is_active = false
  where employee_id = p_employee_id
    and is_active = true;

  update public.salary_structures
  set is_active = true
  where id = (
    select id
    from public.salary_structures
    where employee_id = p_employee_id
      and effective_from <= current_date
    order by effective_from desc, version desc
    limit 1
  );
end;
$$;

create or replace function public.salary_structure_timeline_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  if tg_op = 'DELETE' then
    perform public.refresh_salary_structure_timeline(old.employee_id);
  else
    if tg_op = 'UPDATE' and old.employee_id is distinct from new.employee_id then
      perform public.refresh_salary_structure_timeline(old.employee_id);
    end if;
    perform public.refresh_salary_structure_timeline(new.employee_id);
  end if;
  return null;
end;
$$;

-- These maintenance functions are trigger-only. Prevent authenticated clients
-- from invoking the security-definer functions directly.
revoke all on function public.refresh_salary_structure_timeline(uuid) from public, anon, authenticated;
revoke all on function public.salary_structure_timeline_trigger() from public, anon, authenticated;

drop trigger if exists salary_structure_refresh_timeline on public.salary_structures;
create trigger salary_structure_refresh_timeline
after insert or update or delete on public.salary_structures
for each row execute function public.salary_structure_timeline_trigger();

do $$
declare employee record;
begin
  for employee in select distinct employee_id from public.salary_structures loop
    perform public.refresh_salary_structure_timeline(employee.employee_id);
  end loop;
end;
$$;

-- Salary structures contain protected compensation history. Restore the
-- original Finance-Admin-only policy even though the rest of Payroll
-- Administration is available to other administrator levels.
drop policy if exists salary_structures_admin_all on public.salary_structures;
drop policy if exists salary_structures_finance_all on public.salary_structures;
create policy salary_structures_finance_all on public.salary_structures
for all to authenticated
using (public.get_my_actual_role() = 'finance admin')
with check (public.get_my_actual_role() = 'finance admin');

comment on table public.salary_structures is
  'Effective-dated salary versions. Payroll selects the newest effective_from not later than the payroll applicability date.';

commit;
