begin;

alter table public.employees
  drop constraint if exists employees_department_check;

alter table public.employees
  add constraint employees_department_check
  check (
    department is null
    or department in ('Operations', 'HR', 'Finance', 'Management')
  ) not valid;

create table if not exists public.employee_profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null
    references public.employees(id)
    on delete cascade,
  requested_by uuid not null
    references auth.users(id)
    on delete cascade,
  current_values jsonb not null,
  proposed_changes jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  review_notes text,
  reviewed_by uuid
    references auth.users(id)
    on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index if not exists employee_profile_one_pending_request
  on public.employee_profile_change_requests(employee_id)
  where status = 'pending';

create index if not exists employee_profile_change_requests_status_created_idx
  on public.employee_profile_change_requests(status, created_at);

alter table public.employee_profile_change_requests enable row level security;

revoke all on table public.employee_profile_change_requests from public, anon;
grant select on table public.employee_profile_change_requests to authenticated;
grant select, insert, update, delete
  on table public.employee_profile_change_requests to service_role;

drop policy if exists employee_profile_requests_self_read
  on public.employee_profile_change_requests;
drop policy if exists employee_profile_requests_admin_read
  on public.employee_profile_change_requests;

create policy employee_profile_requests_self_read
on public.employee_profile_change_requests for select to authenticated
using (employee_id = public.get_my_employee_id());

create policy employee_profile_requests_admin_read
on public.employee_profile_change_requests for select to authenticated
using (
  lower(trim(coalesce(public.get_my_role(), ''))) = 'super admin'
  or (
    lower(trim(coalesce(public.get_my_role(), ''))) = 'admin'
    and not public.is_super_admin_employee(employee_id)
  )
);

drop policy if exists employee_statutory_details_self_read
  on public.employee_statutory_details;

create policy employee_statutory_details_self_read
on public.employee_statutory_details for select to authenticated
using (employee_id = public.get_my_employee_id());

-- Managers retain aggregate/direct-report metrics, but no longer receive
-- unrestricted employee rows containing HR and statutory profile details.
drop policy if exists employees_manager_direct_reports_read
  on public.employees;

create or replace function public.get_team_metric_employees()
returns table (
  id uuid,
  employee_code text,
  title text,
  name text,
  gender text,
  email text,
  role text,
  department text,
  date_of_joining date,
  date_of_birth date,
  epf_number text,
  uan_number text,
  reporting_manager_id uuid,
  status text,
  hourly_cost numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    employee.id,
    case
      when lower(trim(coalesce(public.get_my_role(), ''))) = 'manager'
        then null
      else employee.employee_code
    end,
    employee.title,
    employee.name,
    case
      when lower(trim(coalesce(public.get_my_role(), ''))) = 'manager'
        then null
      else employee.gender
    end,
    case
      when lower(trim(coalesce(public.get_my_role(), ''))) = 'manager'
        then ''
      else employee.email
    end,
    employee.role,
    employee.department,
    case
      when lower(trim(coalesce(public.get_my_role(), ''))) = 'manager'
        then null
      else employee.date_of_joining
    end,
    case
      when lower(trim(coalesce(public.get_my_role(), ''))) = 'manager'
        then null
      else employee.date_of_birth
    end,
    case
      when lower(trim(coalesce(public.get_my_role(), ''))) = 'manager'
        then null
      else employee.epf_number
    end,
    case
      when lower(trim(coalesce(public.get_my_role(), ''))) = 'manager'
        then null
      else employee.uan_number
    end,
    employee.reporting_manager_id,
    employee.status,
    case
      when lower(trim(coalesce(public.get_my_role(), ''))) = 'manager'
        then null
      else employee.hourly_cost
    end
  from public.employees employee
  where
    lower(trim(coalesce(public.get_my_role(), ''))) in ('admin', 'super admin')
    or (
      lower(trim(coalesce(public.get_my_role(), ''))) = 'employee'
      and employee.id = public.get_my_employee_id()
    )
    or (
      lower(trim(coalesce(public.get_my_role(), ''))) = 'manager'
      and employee.reporting_manager_id = public.get_my_employee_id()
      and lower(trim(coalesce(employee.status, 'active'))) = 'active'
    )
  order by employee.created_at;
$$;

revoke all on function public.get_team_metric_employees()
  from public, anon;
grant execute on function public.get_team_metric_employees()
  to authenticated, service_role;

create or replace function public.review_employee_profile_change_request(
  p_request_id uuid,
  p_decision text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(trim(coalesce(public.get_my_role(), '')));
  v_request public.employee_profile_change_requests%rowtype;
  v_changes jsonb;
begin
  if v_role not in ('admin', 'super admin') then
    raise exception 'You are not authorised to review employee profile changes';
  end if;

  if lower(trim(coalesce(p_decision, ''))) not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  select request_row.* into v_request
  from public.employee_profile_change_requests request_row
  where request_row.id = p_request_id
  for update;

  if not found then
    raise exception 'Profile change request not found';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This profile change request has already been reviewed';
  end if;
  if v_role = 'admin'
    and public.is_super_admin_employee(v_request.employee_id)
  then
    raise exception 'Only a Super Admin can review a Super Admin profile';
  end if;

  if lower(trim(p_decision)) = 'approved' then
    v_changes := v_request.proposed_changes;

    update public.employees
    set employee_code = trim(v_changes ->> 'employee_code'),
        title = nullif(trim(coalesce(v_changes ->> 'title', '')), ''),
        name = trim(v_changes ->> 'name'),
        gender = nullif(trim(coalesce(v_changes ->> 'gender', '')), ''),
        email = lower(trim(v_changes ->> 'email')),
        role = nullif(trim(coalesce(v_changes ->> 'role', '')), ''),
        department =
          nullif(trim(coalesce(v_changes ->> 'department', '')), ''),
        date_of_joining =
          nullif(v_changes ->> 'date_of_joining', '')::date,
        date_of_birth =
          nullif(v_changes ->> 'date_of_birth', '')::date,
        epf_number =
          nullif(trim(coalesce(v_changes ->> 'epf_number', '')), ''),
        uan_number =
          nullif(trim(coalesce(v_changes ->> 'uan_number', '')), '')
    where id = v_request.employee_id;

    insert into public.employee_statutory_details (
      employee_id,
      pan_number,
      aadhaar_number,
      updated_at
    )
    values (
      v_request.employee_id,
      nullif(trim(coalesce(v_changes ->> 'pan_number', '')), ''),
      nullif(regexp_replace(
        coalesce(v_changes ->> 'aadhaar_number', ''),
        '[^0-9]',
        '',
        'g'
      ), ''),
      now()
    )
    on conflict (employee_id) do update
    set pan_number = excluded.pan_number,
        aadhaar_number = excluded.aadhaar_number,
        updated_at = now();

    update public.profiles
    set full_name = trim(v_changes ->> 'name')
    where employee_id = v_request.employee_id;
  end if;

  update public.employee_profile_change_requests
  set status = lower(trim(p_decision)),
      review_notes = nullif(trim(coalesce(p_notes, '')), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_request_id
  returning * into v_request;

  return jsonb_build_object(
    'id', v_request.id,
    'employee_id', v_request.employee_id,
    'status', v_request.status,
    'reviewed_at', v_request.reviewed_at
  );
end;
$$;

revoke all on function public.review_employee_profile_change_request(
  uuid,
  text,
  text
) from public, anon;
grant execute on function public.review_employee_profile_change_request(
  uuid,
  text,
  text
) to authenticated, service_role;

comment on table public.employee_profile_change_requests is
  'Employee-submitted profile corrections requiring Admin or Super Admin approval.';
comment on function public.get_team_metric_employees() is
  'Returns safe employee metric identities without exposing HR details to managers.';
comment on function public.review_employee_profile_change_request(
  uuid,
  text,
  text
) is
  'Atomically approves or rejects an employee profile correction.';

commit;
