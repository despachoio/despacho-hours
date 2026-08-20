begin;

create table if not exists public.employee_exits (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  exit_source text not null check (exit_source in ('employee','company')),
  exit_type text not null check (exit_type in ('resignation','termination','performance','policy_violation','client_escalation','absconding','mutual_separation','layoff','end_of_contract','retirement','other')),
  status text not null default 'draft' check (status in ('draft','submitted','notice_period','clearance_in_progress','ready_for_final_settlement','completed','cancelled')),
  initiation_date date not null default current_date,
  resignation_date date,
  reason_code text,
  employee_comments text,
  employee_visible_comments text,
  manager_comments text,
  internal_notes text,
  requested_last_working_date date,
  expected_last_working_date date,
  approved_last_working_date date,
  notice_days integer not null default 0 check (notice_days >= 0),
  notice_day_basis text not null default 'calendar' check (notice_day_basis in ('calendar','working')),
  initial_term_confirmed boolean,
  notice_waived boolean not null default false,
  notice_waiver_reason text,
  immediate_termination boolean not null default false,
  final_settlement_status text not null default 'not_started' check (final_settlement_status in ('not_started','pending','ready','completed','waived')),
  created_by uuid not null references auth.users(id), updated_by uuid references auth.users(id),
  submitted_at timestamptz, completed_at timestamptz, completed_by uuid references auth.users(id),
  cancelled_at timestamptz, cancelled_by uuid references auth.users(id), cancellation_reason text,
  reopened_at timestamptz, reopened_by uuid references auth.users(id), reopen_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists employee_exits_one_open_idx on public.employee_exits(employee_id) where status not in ('completed','cancelled');
create index if not exists employee_exits_status_lwd_idx on public.employee_exits(status,approved_last_working_date);

create table if not exists public.exit_handover_tasks (
  id uuid primary key default gen_random_uuid(), exit_id uuid not null references public.employee_exits(id) on delete cascade,
  title text not null, description text, assigned_to uuid references public.employees(id) on delete set null,
  due_date date, status text not null default 'pending' check (status in ('pending','in_progress','completed','waived')),
  completion_notes text, completed_at timestamptz, completed_by uuid references auth.users(id),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.exit_project_clearances (
  id uuid primary key default gen_random_uuid(), exit_id uuid not null references public.employee_exits(id) on delete cascade,
  project_resource_id uuid not null references public.project_resources(id) on delete restrict,
  handover_to uuid references public.employees(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','in_progress','cleared','waived')),
  notes text, cleared_at timestamptz, cleared_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(exit_id,project_resource_id)
);

create table if not exists public.exit_access_tasks (
  id uuid primary key default gen_random_uuid(), exit_id uuid not null references public.employee_exits(id) on delete cascade,
  system_name text not null, owner_employee_id uuid references public.employees(id) on delete set null,
  due_at timestamptz, status text not null default 'pending' check (status in ('pending','scheduled','revoked','waived')),
  notes text, completed_at timestamptz, completed_by uuid references auth.users(id),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.exit_clearances (
  id uuid primary key default gen_random_uuid(), exit_id uuid not null references public.employee_exits(id) on delete cascade,
  clearance_type text not null check (clearance_type in ('manager','project','asset','it','hr','finance','payroll')),
  required boolean not null default true,
  status text not null default 'pending' check (status in ('pending','in_progress','cleared','blocked','waived')),
  notes text, blocker text, cleared_at timestamptz, cleared_by uuid references auth.users(id),
  override_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(exit_id,clearance_type)
);

create table if not exists public.exit_interviews (
  id uuid primary key default gen_random_uuid(), exit_id uuid not null unique references public.employee_exits(id) on delete cascade,
  scheduled_at timestamptz, conducted_at timestamptz, conducted_by uuid references public.employees(id) on delete set null,
  employee_feedback text, confidential_notes text, rehire_eligible boolean,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.exit_documents (
  id uuid primary key default gen_random_uuid(), exit_id uuid not null references public.employee_exits(id) on delete cascade,
  document_type text not null check (document_type in ('resignation_acknowledgement','relieving_letter','experience_letter','full_and_final_statement','other')),
  status text not null default 'template_required' check (status in ('template_required','draft','generated','issued','not_applicable')),
  template_name text, storage_path text, issued_at timestamptz, issued_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(exit_id,document_type)
);

create table if not exists public.exit_audit_events (
  id bigint generated always as identity primary key, exit_id uuid not null references public.employee_exits(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  action text not null, actor_user_id uuid not null references auth.users(id), actor_role text not null,
  reason text, previous_value jsonb, new_value jsonb, created_at timestamptz not null default now()
);
create index if not exists exit_audit_exit_idx on public.exit_audit_events(exit_id,created_at desc);

create or replace function public.exit_is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select public.get_my_actual_role() in ('finance admin','super admin')
$$;
create or replace function public.exit_is_manager_of(p_employee_id uuid) returns boolean language sql stable security definer set search_path=public as $$
  select public.get_my_actual_role()='manager' and exists(select 1 from public.employees e where e.id=p_employee_id and e.reporting_manager_id=public.get_my_employee_id())
$$;
revoke all on function public.exit_is_admin() from public,anon;
revoke all on function public.exit_is_manager_of(uuid) from public,anon;
grant execute on function public.exit_is_admin(),public.exit_is_manager_of(uuid) to authenticated,service_role;

alter table public.employee_exits enable row level security;
alter table public.exit_handover_tasks enable row level security;
alter table public.exit_project_clearances enable row level security;
alter table public.exit_access_tasks enable row level security;
alter table public.exit_clearances enable row level security;
alter table public.exit_interviews enable row level security;
alter table public.exit_documents enable row level security;
alter table public.exit_audit_events enable row level security;

create policy employee_exits_read on public.employee_exits for select to authenticated using (public.exit_is_admin() or employee_id=public.get_my_employee_id() or public.exit_is_manager_of(employee_id));
create policy employee_exits_employee_insert on public.employee_exits for insert to authenticated with check (employee_id=public.get_my_employee_id() and exit_source='employee' and exit_type='resignation' and status in ('draft','submitted'));
create policy employee_exits_employee_update on public.employee_exits for update to authenticated using (employee_id=public.get_my_employee_id() and status in ('draft','submitted')) with check (employee_id=public.get_my_employee_id() and exit_source='employee' and exit_type='resignation');
create policy employee_exits_admin_all on public.employee_exits for all to authenticated using (public.exit_is_admin()) with check (public.exit_is_admin());

create policy exit_handover_read on public.exit_handover_tasks for select to authenticated using (public.exit_is_admin() or assigned_to=public.get_my_employee_id() or exists(select 1 from public.employee_exits x where x.id=exit_id and (x.employee_id=public.get_my_employee_id() or public.exit_is_manager_of(x.employee_id))));
create policy exit_handover_assignee_update on public.exit_handover_tasks for update to authenticated using (assigned_to=public.get_my_employee_id() or public.exit_is_admin() or exists(select 1 from public.employee_exits x where x.id=exit_id and public.exit_is_manager_of(x.employee_id))) with check (assigned_to=public.get_my_employee_id() or public.exit_is_admin() or exists(select 1 from public.employee_exits x where x.id=exit_id and public.exit_is_manager_of(x.employee_id)));
create policy exit_handover_manage on public.exit_handover_tasks for all to authenticated using (public.exit_is_admin() or exists(select 1 from public.employee_exits x where x.id=exit_id and public.exit_is_manager_of(x.employee_id))) with check (public.exit_is_admin() or exists(select 1 from public.employee_exits x where x.id=exit_id and public.exit_is_manager_of(x.employee_id)));

create policy exit_project_read on public.exit_project_clearances for select to authenticated using (public.exit_is_admin() or exists(select 1 from public.employee_exits x where x.id=exit_id and (x.employee_id=public.get_my_employee_id() or public.exit_is_manager_of(x.employee_id))));
create policy exit_project_manage on public.exit_project_clearances for all to authenticated using (public.exit_is_admin() or exists(select 1 from public.employee_exits x where x.id=exit_id and public.exit_is_manager_of(x.employee_id))) with check (public.exit_is_admin() or exists(select 1 from public.employee_exits x where x.id=exit_id and public.exit_is_manager_of(x.employee_id)));

create policy exit_access_read on public.exit_access_tasks for select to authenticated using (public.exit_is_admin() or owner_employee_id=public.get_my_employee_id() or exists(select 1 from public.employee_exits x where x.id=exit_id and x.employee_id=public.get_my_employee_id()));
create policy exit_access_admin on public.exit_access_tasks for all to authenticated using (public.exit_is_admin()) with check (public.exit_is_admin());
create policy exit_clearance_read on public.exit_clearances for select to authenticated using (public.exit_is_admin() or exists(select 1 from public.employee_exits x where x.id=exit_id and (x.employee_id=public.get_my_employee_id() or public.exit_is_manager_of(x.employee_id))));
create policy exit_clearance_manager on public.exit_clearances for update to authenticated using (clearance_type in ('manager','project') and exists(select 1 from public.employee_exits x where x.id=exit_id and public.exit_is_manager_of(x.employee_id))) with check (clearance_type in ('manager','project') and exists(select 1 from public.employee_exits x where x.id=exit_id and public.exit_is_manager_of(x.employee_id)));
create policy exit_clearance_admin on public.exit_clearances for all to authenticated using (public.exit_is_admin()) with check (public.exit_is_admin());
create policy exit_interview_read on public.exit_interviews for select to authenticated using (public.exit_is_admin() or exists(select 1 from public.employee_exits x where x.id=exit_id and x.employee_id=public.get_my_employee_id()));
create policy exit_interview_admin on public.exit_interviews for all to authenticated using (public.exit_is_admin()) with check (public.exit_is_admin());
create policy exit_documents_read on public.exit_documents for select to authenticated using (public.exit_is_admin() or exists(select 1 from public.employee_exits x where x.id=exit_id and x.employee_id=public.get_my_employee_id()));
create policy exit_documents_admin on public.exit_documents for all to authenticated using (public.exit_is_admin()) with check (public.exit_is_admin());
create policy exit_audit_admin_read on public.exit_audit_events for select to authenticated using (public.exit_is_admin());

-- Mutations are intentionally performed through the authorized server API.
-- Authenticated clients receive read privileges only; RLS then scopes those reads.
revoke all on public.employee_exits,public.exit_handover_tasks,public.exit_project_clearances,public.exit_access_tasks,public.exit_clearances,public.exit_interviews,public.exit_documents,public.exit_audit_events from anon,authenticated;
grant select(id,employee_id,exit_source,exit_type,status,initiation_date,resignation_date,reason_code,employee_comments,employee_visible_comments,requested_last_working_date,expected_last_working_date,approved_last_working_date,notice_days,notice_day_basis,initial_term_confirmed,notice_waived,notice_waiver_reason,immediate_termination,final_settlement_status,created_by,updated_by,submitted_at,completed_at,completed_by,cancelled_at,cancelled_by,cancellation_reason,reopened_at,reopened_by,reopen_reason,created_at,updated_at) on public.employee_exits to authenticated;
grant select on public.exit_handover_tasks,public.exit_project_clearances,public.exit_access_tasks,public.exit_documents to authenticated;
grant select(id,exit_id,clearance_type,required,status,notes,blocker,cleared_at,cleared_by,created_at,updated_at) on public.exit_clearances to authenticated;
grant select(id,exit_id,scheduled_at,conducted_at,conducted_by,employee_feedback,created_at,updated_at) on public.exit_interviews to authenticated;
grant select on public.exit_audit_events to authenticated;
grant usage,select on sequence public.exit_audit_events_id_seq to authenticated;

commit;
