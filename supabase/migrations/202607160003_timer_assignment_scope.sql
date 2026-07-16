begin;

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
    'super admin', 'admin', 'manager', 'employee'
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
grant execute on function public.start_own_timer(uuid, text) to authenticated;

commit;
