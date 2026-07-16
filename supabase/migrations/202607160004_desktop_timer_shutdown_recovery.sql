begin;

alter table public.active_timers
  add column if not exists timer_source text not null default 'web',
  add column if not exists desktop_session_id uuid,
  add column if not exists last_heartbeat_at timestamptz;

create index if not exists active_timers_desktop_heartbeat_idx
on public.active_timers (last_heartbeat_at)
where timer_source = 'desktop' and status in ('running', 'paused');

create or replace function public.start_own_desktop_timer(
  p_project_id uuid,
  p_description text,
  p_session_id uuid
)
returns public.active_timers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_timer public.active_timers;
begin
  v_timer := public.start_own_timer(p_project_id, p_description);

  update public.active_timers
  set timer_source = 'desktop',
      desktop_session_id = p_session_id,
      last_heartbeat_at = now()
  where id = v_timer.id
  returning * into v_timer;

  return v_timer;
end;
$$;

create or replace function public.heartbeat_own_timer(
  p_timer_id uuid,
  p_session_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_heartbeat timestamptz := now();
begin
  select employee_id into v_employee_id
  from public.profiles
  where user_id = auth.uid();

  if v_employee_id is null then
    raise exception 'Your employee profile is not configured.';
  end if;

  update public.active_timers
  set timer_source = 'desktop',
      desktop_session_id = p_session_id,
      last_heartbeat_at = v_heartbeat
  where id = p_timer_id
    and employee_id = v_employee_id
    and status in ('running', 'paused');

  if not found then
    raise exception 'Active timer not found.';
  end if;

  return v_heartbeat;
end;
$$;

create or replace function public.recover_own_desktop_timer(p_session_id uuid)
returns public.time_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_timer public.active_timers;
  v_entry public.time_entries;
  v_stopped_at timestamptz;
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
  where employee_id = v_employee_id
    and timer_source = 'desktop'
    and status in ('running', 'paused')
    and desktop_session_id is distinct from p_session_id
  order by started_at desc
  limit 1
  for update;

  if not found then
    return null;
  end if;

  v_stopped_at := greatest(
    v_timer.started_at,
    coalesce(v_timer.last_heartbeat_at, v_timer.started_at)
  );
  v_work_end := case
    when v_timer.status = 'paused' and v_timer.paused_at is not null
      then least(v_timer.paused_at, v_stopped_at)
    else v_stopped_at
  end;
  v_worked_seconds := greatest(
    floor(extract(epoch from (v_work_end - v_timer.started_at)))::integer
      - coalesce(v_timer.total_paused_seconds, 0),
    0
  );
  v_hours := round((v_worked_seconds::numeric / 3600), 2);

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

create or replace function public.stop_stale_desktop_timers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_timer public.active_timers;
  v_stopped_at timestamptz;
  v_work_end timestamptz;
  v_worked_seconds integer;
  v_hours numeric;
  v_saved_count integer := 0;
begin
  for v_timer in
    select *
    from public.active_timers
    where timer_source = 'desktop'
      and status in ('running', 'paused')
      and last_heartbeat_at < now() - interval '2 minutes'
    for update skip locked
  loop
    v_stopped_at := greatest(v_timer.started_at, v_timer.last_heartbeat_at);
    v_work_end := case
      when v_timer.status = 'paused' and v_timer.paused_at is not null
        then least(v_timer.paused_at, v_stopped_at)
      else v_stopped_at
    end;
    v_worked_seconds := greatest(
      floor(extract(epoch from (v_work_end - v_timer.started_at)))::integer
        - coalesce(v_timer.total_paused_seconds, 0),
      0
    );
    v_hours := round((v_worked_seconds::numeric / 3600), 2);

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
    );

    delete from public.active_timers where id = v_timer.id;
    v_saved_count := v_saved_count + 1;
  end loop;

  return v_saved_count;
end;
$$;

revoke all on function public.start_own_desktop_timer(uuid, text, uuid)
from public, anon;
revoke all on function public.heartbeat_own_timer(uuid, uuid)
from public, anon;
revoke all on function public.recover_own_desktop_timer(uuid)
from public, anon;
revoke all on function public.stop_stale_desktop_timers()
from public, anon, authenticated;

grant execute on function public.start_own_desktop_timer(uuid, text, uuid)
to authenticated;
grant execute on function public.heartbeat_own_timer(uuid, uuid)
to authenticated;
grant execute on function public.recover_own_desktop_timer(uuid)
to authenticated;

create extension if not exists pg_cron;

select cron.schedule(
  'kairo-stop-stale-desktop-timers',
  '* * * * *',
  $cron$select public.stop_stale_desktop_timers();$cron$
);

commit;
