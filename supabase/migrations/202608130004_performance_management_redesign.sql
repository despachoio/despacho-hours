begin;

alter table public.performance_events
  add column if not exists reason text,
  add column if not exists policy_category text,
  add column if not exists lost_client boolean not null default false,
  add column if not exists refund_amount numeric(14,2),
  add column if not exists source_type text not null default 'manual',
  add column if not exists source_id text;

alter table public.performance_events drop constraint if exists performance_events_source_type_check;
alter table public.performance_events add constraint performance_events_source_type_check
  check (source_type in ('manual','payroll'));
create unique index if not exists performance_events_source_unique_idx
  on public.performance_events(source_type, source_id);

alter table public.performance_reviews
  add column if not exists manager_decision text,
  add column if not exists hr_decision text;

create table if not exists public.performance_settings (
  id uuid primary key default gen_random_uuid(),
  singleton_key boolean not null default true unique check (singleton_key),
  policy_version integer not null default 1,
  eligibility_rules jsonb not null default '{"minimumOverallScore":80,"maximumEscalations":2}'::jsonb,
  performance_categories jsonb not null default '[{"name":"Substantially Exceeded Expectations","minimumScore":150},{"name":"Exceeded Expectations","minimumScore":125},{"name":"Met Expectations","minimumScore":100},{"name":"Partially Met Expectations","minimumScore":80},{"name":"Not Eligible for Evaluation","minimumScore":0}]'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

insert into public.performance_settings(singleton_key) values (true)
on conflict(singleton_key) do nothing;

insert into public.performance_metric_definitions(name,code,category,default_score_delta,requires_client,display_order,core_metric,qualification_rules) values
  ('Policy Violation','policy_violation','penalty',5,false,55,true,'{}'),
  ('Loss of Pay','lop','penalty',0,false,90,true,'{"source":"finalized_payroll","manual_override_roles":["finance admin","super admin"]}')
on conflict(code) do update set name=excluded.name, active=true, qualification_rules=excluded.qualification_rules;

update public.performance_metric_definitions
set name='Client Escalation / Loss of Client', qualification_rules=qualification_rules || '{"supports_lost_client":true}'::jsonb
where code='client_escalation';

update public.performance_metric_definitions set active=false where code='non_disciplinary_action';

create or replace function public.sync_payroll_lop_performance_event()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_metric_id uuid;
begin
  if new.status not in ('approved','locked','published') or coalesce(new.lop_days,0)<=0 then
    delete from public.performance_events where source_type='payroll' and source_id=new.id::text;
    return new;
  end if;
  select id into v_metric_id from public.performance_metric_definitions where code='lop' and active=true limit 1;
  if v_metric_id is null then return new; end if;
  insert into public.performance_events(employee_id,performance_year,metric_id,event_date,description,
    qualification_status,score_delta,reason,source_type,source_id,updated_at)
  values(new.employee_id,extract(year from new.payroll_month)::integer,v_metric_id,new.payroll_month,
    trim(to_char(new.lop_days,'FM999999990.##'))||' LOP day(s) recorded in finalized payroll',
    'qualified',0,'Automatically synchronized from finalized payroll','payroll',new.id::text,now())
  on conflict(source_type,source_id) do update set
    employee_id=excluded.employee_id, performance_year=excluded.performance_year,
    metric_id=excluded.metric_id, event_date=excluded.event_date, description=excluded.description,
    qualification_status=excluded.qualification_status, reason=excluded.reason, updated_at=now();
  return new;
end $$;
revoke all on function public.sync_payroll_lop_performance_event() from public,anon;

drop trigger if exists payroll_lop_performance_event on public.payroll_entries;
create trigger payroll_lop_performance_event after insert or update of status,lop_days,payroll_month
on public.payroll_entries for each row execute function public.sync_payroll_lop_performance_event();

alter table public.performance_settings enable row level security;
drop policy if exists performance_settings_read on public.performance_settings;
drop policy if exists performance_settings_admin on public.performance_settings;
create policy performance_settings_read on public.performance_settings for select to authenticated using (true);
create policy performance_settings_admin on public.performance_settings for all to authenticated
  using (public.performance_is_admin()) with check (public.performance_is_admin());
revoke all on public.performance_settings from anon;
grant select,insert,update,delete on public.performance_settings to authenticated;

commit;
