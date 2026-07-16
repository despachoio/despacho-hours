begin;

do $$
begin
  if exists (
    select employee_id
    from public.active_timers
    where status in ('running', 'paused')
    group by employee_id
    having count(*) > 1
  ) then
    raise exception 'Cannot enable single-timer protection while an employee has multiple active timers.';
  end if;
end
$$;

create unique index if not exists active_timers_one_per_employee
on public.active_timers (employee_id)
where status in ('running', 'paused');

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

  if lower(trim(coalesce(v_profile.role, ''))) = 'employee'
    and not exists (
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

create or replace function public.update_own_timer_state(
  p_timer_id uuid,
  p_action text
)
returns public.active_timers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_timer public.active_timers;
  v_now timestamptz := now();
begin
  select employee_id into v_employee_id
  from public.profiles
  where user_id = auth.uid();

  if v_employee_id is null then
    raise exception 'Your employee profile is not configured.';
  end if;

  select * into v_timer
  from public.active_timers
  where id = p_timer_id
    and employee_id = v_employee_id
  for update;

  if not found then
    raise exception 'Active timer not found.';
  end if;

  if lower(trim(coalesce(p_action, ''))) = 'pause' then
    if v_timer.status <> 'running' then
      raise exception 'Only a running timer can be paused.';
    end if;

    update public.active_timers
    set status = 'paused', paused_at = v_now
    where id = v_timer.id
    returning * into v_timer;
  elsif lower(trim(coalesce(p_action, ''))) = 'resume' then
    if v_timer.status <> 'paused' or v_timer.paused_at is null then
      raise exception 'Only a paused timer can be resumed.';
    end if;

    update public.active_timers
    set status = 'running',
        total_paused_seconds = total_paused_seconds
          + greatest(floor(extract(epoch from (v_now - paused_at)))::integer, 0),
        paused_at = null
    where id = v_timer.id
    returning * into v_timer;
  else
    raise exception 'Timer action must be pause or resume.';
  end if;

  return v_timer;
end;
$$;

create or replace function public.stop_own_timer(p_timer_id uuid)
returns public.time_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_timer public.active_timers;
  v_entry public.time_entries;
  v_stopped_at timestamptz := now();
  v_work_end timestamptz;
  v_worked_seconds integer;
  v_hours numeric;
begin
  select employee_id into v_employee_id
  from public.profiles
  where user_id = auth.uid();

  if v_employee_id is null then
    raise exception 'Your employee profile is not configured.';
  end if;

  select * into v_timer
  from public.active_timers
  where id = p_timer_id
    and employee_id = v_employee_id
  for update;

  if not found then
    raise exception 'Active timer not found.';
  end if;

  v_work_end := case
    when v_timer.status = 'paused' and v_timer.paused_at is not null
      then v_timer.paused_at
    else v_stopped_at
  end;
  v_worked_seconds := greatest(
    floor(extract(epoch from (v_work_end - v_timer.started_at)))::integer
      - coalesce(v_timer.total_paused_seconds, 0),
    0
  );
  v_hours := round((v_worked_seconds::numeric / 3600), 2);

  if v_hours <= 0 then
    raise exception 'Timer is too short to save.';
  end if;

  insert into public.time_entries (
    employee_id,
    project_id,
    entry_date,
    started_at,
    stopped_at,
    hours,
    description
  ) values (
    v_timer.employee_id,
    v_timer.project_id,
    (v_stopped_at at time zone 'Asia/Kolkata')::date,
    v_timer.started_at,
    v_stopped_at,
    v_hours,
    v_timer.description
  )
  returning * into v_entry;

  delete from public.active_timers where id = v_timer.id;
  return v_entry;
end;
$$;

revoke all on function public.start_own_timer(uuid, text)
from public, anon;
revoke all on function public.update_own_timer_state(uuid, text)
from public, anon;
revoke all on function public.stop_own_timer(uuid)
from public, anon;

grant execute on function public.start_own_timer(uuid, text) to authenticated;
grant execute on function public.update_own_timer_state(uuid, text) to authenticated;
grant execute on function public.stop_own_timer(uuid) to authenticated;

commit;
