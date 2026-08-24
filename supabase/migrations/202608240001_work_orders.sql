begin;

alter table public.clients add column if not exists business_client_id integer;
create unique index if not exists clients_business_client_id_uidx on public.clients(business_client_id) where business_client_id is not null;

create table if not exists public.terms_templates (
  id uuid primary key default gen_random_uuid(), name text not null, version text not null unique,
  effective_from date not null, effective_to date, structured_sections jsonb not null default '[]'::jsonb,
  active boolean not null default false, source_reference text, created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.work_order_number_state (
  singleton_key boolean primary key default true check(singleton_key), last_sequence integer not null default 95,
  updated_at timestamptz not null default now()
);
insert into public.work_order_number_state(singleton_key,last_sequence) values(true,95) on conflict(singleton_key) do nothing;

create table if not exists public.work_order_number_reservations (
  id uuid primary key default gen_random_uuid(), sequence_number integer not null unique,
  work_order_number text not null unique, business_client_id integer,
  new_client boolean not null, work_order_id uuid, reserved_by uuid not null references auth.users(id),
  reserved_at timestamptz not null default now()
);
create unique index if not exists work_order_new_client_reservation_uidx on public.work_order_number_reservations(business_client_id) where business_client_id is not null;

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(), reservation_id uuid not null unique references public.work_order_number_reservations(id),
  parent_work_order_id uuid references public.work_orders(id), work_order_number text not null unique, sequence_number integer not null unique,
  client_business_id integer, client_id uuid references public.clients(id), project_id uuid references public.projects(id),
  customer_type text not null check(customer_type in ('existing_client','new_client')),
  status text not null default 'draft' check(status in ('draft','generated','sent','signed','onboarded','cancelled')),
  terms_template_id uuid references public.terms_templates(id), terms_version text,
  effective_date date not null, project_start_date date not null, first_invoice_date date, end_date date,
  ending_type text not null default 'ongoing' check(ending_type in ('ongoing','specific_date','custom')),
  company_name text not null, contact_name text, address text, city text, state text, postal_code text, country text, phone text, email text,
  template_type text not null, commercial_model text not null, billing_basis text not null,
  resource_count integer check(resource_count is null or resource_count >= 0), hours_per_resource_month numeric(10,2), hours_per_day numeric(10,2), days_per_week numeric(10,2), working_commitment_custom text,
  currency text not null check(currency in ('USD','CAD')), monthly_fee numeric(14,2) check(monthly_fee is null or monthly_fee >= 0), pricing_notes text,
  location text, rate_increase_terms text, service_type text not null, engagement_model text not null, engagement_overview text not null,
  payment_terms_days integer, payment_terms_custom text, late_payment_terms text,
  long_term_clause_enabled boolean not null default false, future_hires_clause_enabled boolean not null default false,
  additional_headcount_clause_enabled boolean not null default false, premium_work_clause_enabled boolean not null default false, custom_terms text,
  current_version integer not null default 0, docusign_envelope_id text, docusign_status text,
  sent_at timestamptz, signed_at timestamptz, completed_at timestamptz, signer_name text, signer_email text,
  signed_document_path text, onboarded_at timestamptz, cancelled_at timestamptz,
  created_by uuid not null references auth.users(id), updated_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.work_order_number_reservations drop constraint if exists work_order_number_reservations_work_order_id_fkey;
alter table public.work_order_number_reservations add constraint work_order_number_reservations_work_order_id_fkey foreign key(work_order_id) references public.work_orders(id) on delete set null;

create table if not exists public.work_order_pricing_phases (
  id uuid primary key default gen_random_uuid(), work_order_id uuid not null references public.work_orders(id) on delete cascade,
  sort_order integer not null, label text not null, description text, start_month integer, end_month integer,
  amount numeric(14,2) not null check(amount >= 0), currency text not null check(currency in ('USD','CAD')), billing_basis text not null,
  unique(work_order_id,sort_order)
);
create table if not exists public.work_order_versions (
  id uuid primary key default gen_random_uuid(), work_order_id uuid not null references public.work_orders(id) on delete restrict,
  version_number integer not null, terms_template_id uuid not null references public.terms_templates(id), terms_version text not null,
  snapshot_json jsonb not null, pdf_storage_path text, generated_by uuid not null references auth.users(id), generated_at timestamptz not null default now(),
  unique(work_order_id,version_number)
);
create table if not exists public.work_order_audit_log (
  id bigint generated always as identity primary key, work_order_id uuid not null references public.work_orders(id) on delete cascade,
  version_id uuid references public.work_order_versions(id) on delete set null, action text not null,
  actor_user_id uuid not null references auth.users(id), actor_role text not null, previous_value jsonb, new_value jsonb,
  created_at timestamptz not null default now()
);
create index if not exists work_orders_search_idx on public.work_orders(status,effective_date,updated_at desc);
create index if not exists work_orders_company_idx on public.work_orders(lower(company_name));
create index if not exists work_order_audit_idx on public.work_order_audit_log(work_order_id,created_at desc);

create or replace function public.work_order_is_authorized() returns boolean language sql stable security definer set search_path=public as $$
  select public.get_my_actual_role() in ('finance admin','super admin')
$$;
revoke all on function public.work_order_is_authorized() from public,anon;
grant execute on function public.work_order_is_authorized() to authenticated,service_role;

create or replace function public.reserve_work_order_identity(p_new_client boolean)
returns table(id uuid,sequence_number integer,work_order_number text,business_client_id integer)
language plpgsql security definer set search_path=public as $$
declare v_sequence integer; v_id uuid; v_client_id integer;
begin
  if not public.work_order_is_authorized() then raise exception 'Forbidden' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext('kairo-work-order-number'));
  select greatest(
    coalesce((select last_sequence from public.work_order_number_state where singleton_key=true),95),
    coalesce((select max(sequence_number) from public.work_order_number_reservations),0),
    coalesce((select max(sequence_number) from public.work_orders),0),
    coalesce((select max(business_client_id)-1000 from public.clients where business_client_id between 1001 and 9999),0),
    coalesce((select max((regexp_match(project_code,'([0-9]{4})'))[1]::integer)-1000 from public.projects where project_code ~ '[0-9]{4}'),0)
  ) + 1 into v_sequence;
  v_client_id:=case when p_new_client then 1000+v_sequence else null end;
  insert into public.work_order_number_reservations(sequence_number,work_order_number,business_client_id,new_client,reserved_by)
  values(v_sequence,lpad(v_sequence::text,4,'0'),v_client_id,p_new_client,auth.uid()) returning work_order_number_reservations.id into v_id;
  update public.work_order_number_state set last_sequence=v_sequence,updated_at=now() where singleton_key=true;
  return query select v_id,v_sequence,lpad(v_sequence::text,4,'0'),v_client_id;
end $$;
revoke all on function public.reserve_work_order_identity(boolean) from public,anon;
grant execute on function public.reserve_work_order_identity(boolean) to authenticated;

create or replace function public.populate_work_order_identity() returns trigger language plpgsql set search_path=public as $$
declare r public.work_order_number_reservations%rowtype;
begin
 select * into r from public.work_order_number_reservations where id=new.reservation_id for update;
 if r.id is null or r.work_order_id is not null then raise exception 'Invalid or consumed Work Order reservation'; end if;
 new.sequence_number:=r.sequence_number; new.work_order_number:=r.work_order_number;
 if new.customer_type='new_client' then new.client_business_id:=r.business_client_id; end if;
 return new;
end $$;
drop trigger if exists populate_work_order_identity on public.work_orders;
create trigger populate_work_order_identity before insert on public.work_orders for each row execute function public.populate_work_order_identity();

create or replace function public.prevent_work_order_version_mutation() returns trigger language plpgsql as $$ begin raise exception 'Generated Work Order versions are immutable'; end $$;
drop trigger if exists prevent_work_order_version_mutation on public.work_order_versions;
create trigger prevent_work_order_version_mutation before update or delete on public.work_order_versions for each row execute function public.prevent_work_order_version_mutation();

create or replace function public.validate_work_order_update() returns trigger language plpgsql set search_path=public as $$
begin
  if old.status <> new.status and not (
    (old.status='draft' and new.status in ('generated','cancelled')) or
    (old.status='generated' and new.status in ('sent','cancelled')) or
    (old.status='sent' and new.status in ('signed','cancelled')) or
    (old.status='signed' and new.status='onboarded')
  ) then
    raise exception 'Invalid Work Order status transition from % to %', old.status, new.status;
  end if;

  if old.status in ('signed','onboarded') and (
    to_jsonb(new) - array[
      'status','client_id','project_id','onboarded_at','completed_at','updated_at','updated_by',
      'docusign_status','docusign_envelope_id','signed_document_path'
    ]
  ) is distinct from (
    to_jsonb(old) - array[
      'status','client_id','project_id','onboarded_at','completed_at','updated_at','updated_by',
      'docusign_status','docusign_envelope_id','signed_document_path'
    ]
  ) then
    raise exception 'Signed Work Order commercial and customer terms are immutable; create a revision instead';
  end if;

  return new;
end $$;
drop trigger if exists validate_work_order_update on public.work_orders;
create trigger validate_work_order_update before update on public.work_orders for each row execute function public.validate_work_order_update();

alter table public.terms_templates enable row level security; alter table public.work_order_number_state enable row level security;
alter table public.work_order_number_reservations enable row level security; alter table public.work_orders enable row level security;
alter table public.work_order_pricing_phases enable row level security; alter table public.work_order_versions enable row level security; alter table public.work_order_audit_log enable row level security;
do $$ declare t text; begin foreach t in array array['terms_templates','work_order_number_state','work_order_number_reservations','work_orders','work_order_pricing_phases','work_order_versions','work_order_audit_log'] loop
 execute format('drop policy if exists %I on public.%I','work_orders_authorized_all_'||t,t);
 execute format('create policy %I on public.%I for all to authenticated using (public.work_order_is_authorized()) with check (public.work_order_is_authorized())','work_orders_authorized_all_'||t,t);
 execute format('revoke all on public.%I from anon',t); execute format('grant select,insert,update,delete on public.%I to authenticated',t);
end loop; end $$;
grant usage,select on sequence public.work_order_audit_log_id_seq to authenticated;

commit;
