begin;

alter table public.performance_reviews
  add column if not exists started_at timestamptz,
  add column if not exists started_by uuid references auth.users(id);

create or replace function public.reset_annual_review(
  p_review_id uuid,
  p_expected_status text,
  p_actor_user_id uuid,
  p_reason text default null
)
returns public.performance_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_previous public.performance_reviews%rowtype;
  v_updated public.performance_reviews%rowtype;
begin
  select lower(trim(coalesce(profile.role, '')))
  into v_actor_role
  from public.profiles profile
  where profile.user_id = p_actor_user_id
  limit 1;

  if v_actor_role not in ('super admin', 'finance admin') then
    raise exception 'Super Admin or Finance Admin access required';
  end if;

  select *
  into v_previous
  from public.performance_reviews
  where id = p_review_id
  for update;

  if not found then
    raise exception 'Annual review not found';
  end if;

  if v_previous.status <> p_expected_status then
    raise exception 'This review changed after the page was loaded. Refresh and try again.';
  end if;

  if v_previous.status not in ('under_review', 'reopened') then
    raise exception 'Only a started or deliberately reopened review can be reset';
  end if;

  delete from public.performance_comments
  where review_id = v_previous.id;

  update public.performance_reviews
  set status = 'draft',
      snapshot = null,
      started_at = null,
      started_by = null,
      finalized_at = null,
      finalized_by = null,
      reopened_at = null,
      reopened_by = null,
      reopen_reason = null,
      manager_decision = null,
      hr_decision = null,
      updated_by = p_actor_user_id,
      updated_at = now()
  where id = v_previous.id
  returning * into v_updated;

  insert into public.performance_audit_log(
    review_id,
    employee_id,
    performance_year,
    action,
    actor_user_id,
    actor_role,
    reason,
    previous_value,
    new_value
  ) values (
    v_previous.id,
    v_previous.employee_id,
    v_previous.performance_year,
    'ANNUAL_REVIEW_RESET',
    p_actor_user_id,
    v_actor_role,
    nullif(trim(coalesce(p_reason, '')), ''),
    jsonb_build_object('status', v_previous.status),
    jsonb_build_object('status', v_updated.status)
  );

  return v_updated;
end;
$$;

revoke all on function public.reset_annual_review(uuid, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.reset_annual_review(uuid, text, uuid, text)
  to service_role;

commit;
