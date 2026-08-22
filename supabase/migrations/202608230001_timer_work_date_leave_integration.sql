begin;

-- A timer's work date is assigned once, when the shift starts. It deliberately
-- survives midnight and is reused by every stop/recovery path.
alter table public.active_timers
  add column if not exists work_date date;

update public.active_timers
set work_date = (started_at at time zone 'Asia/Kolkata')::date
where work_date is null;

alter table public.active_timers
  alter column work_date set not null;

comment on column public.active_timers.work_date is
  'Immutable business work date assigned from started_at in Asia/Kolkata.';

-- Approved full-day leave is checked only when a timer starts. Continuing,
-- pausing, resuming, or stopping an existing timer never performs another
-- leave check and never changes its work date.
create or replace function public.prevent_timer_during_full_day_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_approved_duration numeric;
begin
  new.started_at := coalesce(new.started_at, now());
  new.work_date := (new.started_at at time zone 'Asia/Kolkata')::date;

  select coalesce(sum(day.duration), 0)
  into v_approved_duration
  from public.leave_request_days day
  join public.leave_requests request on request.id = day.leave_request_id
  where day.employee_id = new.employee_id
    and day.leave_date = new.work_date
    and day.is_working_day
    and day.status in ('approved', 'cancellation_requested')
    and request.status in (
      'approved', 'cancellation_requested', 'cancellation_rejected'
    );

  if v_approved_duration >= 1 then
    raise exception
      'You have approved leave for this work date and cannot start a timer.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_timer_during_full_day_leave
  on public.active_timers;
create trigger prevent_timer_during_full_day_leave
before insert on public.active_timers
for each row execute function public.prevent_timer_during_full_day_leave();

create or replace function public.preserve_active_timer_work_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.work_date := old.work_date;
  return new;
end;
$$;

drop trigger if exists preserve_active_timer_work_date
  on public.active_timers;
create trigger preserve_active_timer_work_date
before update on public.active_timers
for each row execute function public.preserve_active_timer_work_date();

-- Browser stops insert the time entry before deleting the active timer. Make
-- the database authoritative even if a stale client submits another date.
create or replace function public.use_active_timer_work_date_for_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_work_date date;
begin
  if new.source_timer_id is null then
    return new;
  end if;

  select timer.work_date
  into v_work_date
  from public.active_timers timer
  where timer.id = new.source_timer_id
    and timer.employee_id = new.employee_id;

  if v_work_date is not null then
    new.entry_date := v_work_date;
  end if;

  return new;
end;
$$;

drop trigger if exists use_active_timer_work_date_for_entry
  on public.time_entries;
create trigger use_active_timer_work_date_for_entry
before insert on public.time_entries
for each row execute function public.use_active_timer_work_date_for_entry();

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
    employee_id, project_id, entry_date, started_at, stopped_at, hours,
    description, source_timer_id
  ) values (
    v_timer.employee_id, v_timer.project_id, v_timer.work_date,
    v_timer.started_at, v_stopped_at, v_hours, v_timer.description, v_timer.id
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

  if v_hours <= 0 then
    raise exception 'Timer is too short to save.';
  end if;

  insert into public.time_entries (
    employee_id, project_id, entry_date, started_at, stopped_at, hours,
    description, source_timer_id
  ) values (
    v_timer.employee_id, v_timer.project_id, v_timer.work_date,
    v_timer.started_at, v_stopped_at, v_hours, v_timer.description, v_timer.id
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
      employee_id, project_id, entry_date, started_at, stopped_at, hours,
      description, source_timer_id
    ) values (
      v_timer.employee_id, v_timer.project_id, v_timer.work_date,
      v_timer.started_at, v_stopped_at, v_hours, v_timer.description, v_timer.id
    );

    delete from public.active_timers where id = v_timer.id;
    v_saved_count := v_saved_count + 1;
  end loop;

  return v_saved_count;
end;
$$;

revoke all on function public.prevent_timer_during_full_day_leave()
  from public, anon;
revoke all on function public.preserve_active_timer_work_date()
  from public, anon;
revoke all on function public.use_active_timer_work_date_for_entry()
  from public, anon;
revoke all on function public.stop_own_timer(uuid)
  from public, anon;
revoke all on function public.recover_own_desktop_timer(uuid)
  from public, anon;
revoke all on function public.stop_stale_desktop_timers()
  from public, anon, authenticated;

grant execute on function public.stop_own_timer(uuid) to authenticated;
grant execute on function public.recover_own_desktop_timer(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
