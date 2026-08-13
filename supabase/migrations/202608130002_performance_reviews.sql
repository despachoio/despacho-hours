begin;

create table if not exists public.utilization_policies (
  id uuid primary key default gen_random_uuid(),
  level_group text not null unique check (level_group in ('level_1','level_2','level_3_plus')),
  expected_percent numeric(6,2) not null, monthly_expected_hours numeric(10,2) not null,
  quarterly_expected_hours numeric(10,2) not null, annual_expected_hours numeric(10,2) not null,
  minimum_percent numeric(6,2) not null, monthly_minimum_hours numeric(10,2) not null,
  quarterly_minimum_hours numeric(10,2) not null, annual_minimum_hours numeric(10,2) not null,
  updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);

create table if not exists public.performance_metric_definitions (
  id uuid primary key default gen_random_uuid(), name text not null, code text not null unique,
  category text not null check (category in ('booster','penalty')),
  default_score_delta numeric(7,2) not null default 0, requires_client boolean not null default false,
  active boolean not null default true, display_order integer not null default 0,
  core_metric boolean not null default false, qualification_rules jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id), updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.performance_reviews (
  id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees(id) on delete restrict,
  performance_year integer not null check (performance_year between 2000 and 2200), review_type text not null default 'annual',
  status text not null default 'draft' check (status in ('draft','under_review','finalized','reopened')),
  snapshot jsonb, finalized_at timestamptz, finalized_by uuid references auth.users(id),
  reopened_at timestamptz, reopened_by uuid references auth.users(id), reopen_reason text,
  created_by uuid references auth.users(id), updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(employee_id, performance_year, review_type)
);

create table if not exists public.performance_events (
  id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees(id) on delete restrict,
  performance_year integer not null check (performance_year between 2000 and 2200),
  metric_id uuid not null references public.performance_metric_definitions(id) on delete restrict,
  client_id uuid references public.clients(id) on delete set null, event_date date not null,
  description text not null, qualification_status text not null default 'qualified' check (qualification_status in ('qualified','not_qualified','pending')),
  score_delta numeric(7,2) not null, evidence_url text, notes text,
  created_by uuid references auth.users(id), updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.performance_comments (
  id uuid primary key default gen_random_uuid(), review_id uuid not null references public.performance_reviews(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict, performance_year integer not null,
  author_employee_id uuid not null references public.employees(id) on delete restrict, author_role text not null,
  comment_type text not null check (comment_type in ('manager','admin','employee')), comment text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.performance_audit_log (
  id bigint generated always as identity primary key, review_id uuid references public.performance_reviews(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null, performance_year integer,
  metric_id uuid references public.performance_metric_definitions(id) on delete set null,
  event_id uuid references public.performance_events(id) on delete set null,
  action text not null, actor_user_id uuid not null references auth.users(id), actor_role text not null,
  reason text, previous_value jsonb, new_value jsonb, created_at timestamptz not null default now()
);

insert into public.utilization_policies(level_group,expected_percent,monthly_expected_hours,quarterly_expected_hours,annual_expected_hours,minimum_percent,monthly_minimum_hours,quarterly_minimum_hours,annual_minimum_hours) values
('level_1',60,90,270,1080,40,60,180,720),('level_2',80,120,360,1440,60,90,270,1080),('level_3_plus',90,135,405,1620,70,105,315,1260)
on conflict(level_group) do nothing;

insert into public.performance_metric_definitions(name,code,category,default_score_delta,requires_client,display_order,core_metric,qualification_rules) values
('Client Feedback','client_feedback','booster',5,true,10,true,'{"one_per_client_per_year":true}'),
('Client Scale-up','client_scale_up','booster',10,true,20,true,'{}'),
('Client Testimonial','client_testimonial','booster',10,true,30,true,'{"non_qualified_as_feedback":true}'),
('Client Referral','client_referral','booster',20,true,40,true,'{"successful_only":true}'),
('Rockstar Award','rockstar_award','booster',0,false,50,true,'{"score_configurable":true}'),
('Non-disciplinary Action','non_disciplinary_action','penalty',5,false,60,true,'{}'),
('Client Escalation','client_escalation','penalty',10,true,70,true,'{"employee_fault_only":true}'),
('Refund','refund','penalty',10,true,80,true,'{"employee_fault_only":true}')
on conflict(code) do nothing;

create index if not exists performance_events_employee_year_idx on public.performance_events(employee_id,performance_year,event_date);
create index if not exists performance_reviews_employee_year_idx on public.performance_reviews(employee_id,performance_year);
create index if not exists performance_audit_employee_year_idx on public.performance_audit_log(employee_id,performance_year,created_at desc);

alter table public.utilization_policies enable row level security;
alter table public.performance_metric_definitions enable row level security;
alter table public.performance_reviews enable row level security;
alter table public.performance_events enable row level security;
alter table public.performance_comments enable row level security;
alter table public.performance_audit_log enable row level security;

create or replace function public.performance_is_admin() returns boolean language sql stable security definer set search_path=public as $$ select public.get_my_actual_role() in ('finance admin','super admin') $$;
revoke all on function public.performance_is_admin() from public,anon;
grant execute on function public.performance_is_admin() to authenticated,service_role;

create policy performance_policy_read on public.utilization_policies for select to authenticated using (true);
create policy performance_policy_admin on public.utilization_policies for all to authenticated using (public.performance_is_admin()) with check (public.performance_is_admin());
create policy performance_metric_read on public.performance_metric_definitions for select to authenticated using (true);
create policy performance_metric_admin on public.performance_metric_definitions for all to authenticated using (public.performance_is_admin()) with check (public.performance_is_admin());
create policy performance_review_read on public.performance_reviews for select to authenticated using (public.performance_is_admin() or (employee_id=public.get_my_employee_id() and status='finalized') or exists(select 1 from public.employees e where e.id=performance_reviews.employee_id and e.reporting_manager_id=public.get_my_employee_id()));
create policy performance_review_admin_write on public.performance_reviews for all to authenticated using (public.performance_is_admin()) with check (public.performance_is_admin());
create policy performance_event_read on public.performance_events for select to authenticated using (public.performance_is_admin() or (employee_id=public.get_my_employee_id() and exists(select 1 from public.performance_reviews r where r.employee_id=performance_events.employee_id and r.performance_year=performance_events.performance_year and r.status='finalized')) or exists(select 1 from public.employees e where e.id=performance_events.employee_id and e.reporting_manager_id=public.get_my_employee_id()));
create policy performance_event_admin_write on public.performance_events for all to authenticated using (public.performance_is_admin()) with check (public.performance_is_admin());
create policy performance_comment_read on public.performance_comments for select to authenticated using (public.performance_is_admin() or (employee_id=public.get_my_employee_id() and exists(select 1 from public.performance_reviews r where r.id=performance_comments.review_id and r.status='finalized')) or author_employee_id=public.get_my_employee_id() or exists(select 1 from public.employees e where e.id=performance_comments.employee_id and e.reporting_manager_id=public.get_my_employee_id()));
create policy performance_comment_insert on public.performance_comments for insert to authenticated with check (author_employee_id=public.get_my_employee_id() and (public.performance_is_admin() or employee_id=public.get_my_employee_id() or exists(select 1 from public.employees e where e.id=performance_comments.employee_id and e.reporting_manager_id=public.get_my_employee_id())));
create policy performance_audit_admin_read on public.performance_audit_log for select to authenticated using (public.performance_is_admin());

revoke all on public.utilization_policies,public.performance_metric_definitions,public.performance_reviews,public.performance_events,public.performance_comments,public.performance_audit_log from anon;
grant select on public.utilization_policies,public.performance_metric_definitions,public.performance_reviews,public.performance_events,public.performance_comments to authenticated;
grant insert,update,delete on public.utilization_policies,public.performance_metric_definitions,public.performance_reviews,public.performance_events to authenticated;
grant insert on public.performance_comments to authenticated;
grant select on public.performance_audit_log to authenticated;
grant usage,select on sequence public.performance_audit_log_id_seq to authenticated;

commit;
