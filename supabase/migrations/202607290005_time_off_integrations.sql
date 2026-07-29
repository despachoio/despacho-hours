begin;

alter table public.leave_notifications
  add column if not exists claimed_at timestamptz,
  add column if not exists gmail_message_id text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists read_at timestamptz;

create or replace function public.mark_time_off_notification_read(p_notification_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.leave_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id and recipient_user_id = auth.uid()
$$;

-- Approved full-day leave is authoritative across browser and desktop timers.
-- The business date is derived from the new timer's own timestamp in Asia/Kolkata.
create or replace function public.prevent_timer_during_full_day_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_date date := (coalesce(new.started_at, now()) at time zone 'Asia/Kolkata')::date;
  v_approved_duration numeric;
begin
  select coalesce(sum(day.duration), 0)
  into v_approved_duration
  from public.leave_request_days day
  join public.leave_requests request on request.id = day.leave_request_id
  where day.employee_id = new.employee_id
    and day.leave_date = v_business_date
    and day.is_working_day
    and day.status in ('approved', 'cancellation_requested')
    and request.status in ('approved', 'cancellation_requested', 'cancellation_rejected');

  if v_approved_duration >= 1 then
    raise exception 'You cannot start a timer during an approved full-day leave.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_timer_during_full_day_leave on public.active_timers;
create trigger prevent_timer_during_full_day_leave
before insert on public.active_timers
for each row execute function public.prevent_timer_during_full_day_leave();

-- Published/past holidays remain immutable so historical leave calculations do
-- not silently change. Administrators may maintain future dates only.
create or replace function public.enforce_future_holiday_changes()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if tg_op = 'DELETE' and old.holiday_date <= v_today then
    raise exception 'Past or current holidays cannot be deleted.';
  end if;
  if tg_op = 'UPDATE' and old.holiday_date <= v_today and new is distinct from old then
    raise exception 'Past or current holidays cannot be changed.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists enforce_future_holiday_changes on public.holidays;
create trigger enforce_future_holiday_changes
before update or delete on public.holidays
for each row execute function public.enforce_future_holiday_changes();

-- Comments are immutable and audited at the database boundary.
create or replace function public.audit_leave_request_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.time_off_audit_log (
    actor_user_id, actor_employee_id, actor_role, action, entity_type,
    entity_id, employee_id, new_values
  ) values (
    auth.uid(), public.get_my_employee_id(), public.get_my_actual_role(),
    'comment_added', 'leave_request_comment', new.id, new.employee_id,
    jsonb_build_object('leave_request_id', new.leave_request_id, 'comment', new.comment)
  );
  return new;
end;
$$;

drop trigger if exists audit_leave_request_comment on public.leave_request_comments;
create trigger audit_leave_request_comment
after insert on public.leave_request_comments
for each row execute function public.audit_leave_request_comment();

revoke all on function public.prevent_timer_during_full_day_leave() from public, anon;
revoke all on function public.enforce_future_holiday_changes() from public, anon;
revoke all on function public.audit_leave_request_comment() from public, anon;
revoke all on function public.mark_time_off_notification_read(uuid) from public, anon;
grant execute on function public.mark_time_off_notification_read(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
