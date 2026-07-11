create table if not exists public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  first_name text,
  last_name text,
  name text,
  email text not null,
  phone text,
  contact_type text not null default 'general',
  job_title text,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.client_contacts
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists contact_type text default 'general',
  add column if not exists job_title text,
  add column if not exists is_primary boolean default false,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.client_contacts
set
  contact_type = case
    when lower(trim(coalesce(contact_type, ''))) in (
      'primary', 'billing', 'manager', 'general'
    ) then lower(trim(contact_type))
    else 'general'
  end,
  is_primary = coalesce(is_primary, false),
  is_active = coalesce(is_active, true),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, created_at, now());

do $$
begin
  if exists (
    select 1
    from public.client_contacts
    where email is null or trim(email) = ''
  ) then
    raise exception 'Existing client contacts must have an email before this migration can be applied.';
  end if;
end;
$$;

alter table public.client_contacts
  alter column email set not null,
  alter column contact_type set default 'general',
  alter column contact_type set not null,
  alter column is_primary set default false,
  alter column is_primary set not null,
  alter column is_active set default true,
  alter column is_active set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.client_contacts
  drop constraint if exists client_contacts_contact_type_check;

alter table public.client_contacts
  add constraint client_contacts_contact_type_check
  check (contact_type in ('primary', 'billing', 'manager', 'general'));

create unique index if not exists client_contacts_client_email_unique
  on public.client_contacts(client_id, lower(email));

-- If legacy data marks more than one active primary, retain the oldest one.
with ranked_primaries as (
  select
    id,
    row_number() over (
      partition by client_id
      order by created_at, id
    ) as primary_rank
  from public.client_contacts
  where is_primary = true and is_active = true
)
update public.client_contacts as contacts
set is_primary = false
from ranked_primaries
where contacts.id = ranked_primaries.id
  and ranked_primaries.primary_rank > 1;

create unique index if not exists client_contacts_one_active_primary
  on public.client_contacts(client_id)
  where is_primary = true and is_active = true;

create or replace function public.set_client_contact_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_client_contact_updated_at
  on public.client_contacts;

create trigger set_client_contact_updated_at
before update on public.client_contacts
for each row execute function public.set_client_contact_updated_at();

alter table public.client_contacts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'client_contacts'
      and policyname = 'client_contacts_admin_all'
  ) then
    create policy client_contacts_admin_all
      on public.client_contacts
      for all
      to authenticated
      using (
        exists (
          select 1 from public.profiles
          where profiles.user_id = auth.uid()
            and lower(trim(coalesce(profiles.role, ''))) = 'admin'
        )
      )
      with check (
        exists (
          select 1 from public.profiles
          where profiles.user_id = auth.uid()
            and lower(trim(coalesce(profiles.role, ''))) = 'admin'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'client_contacts'
      and policyname = 'client_contacts_manager_read'
  ) then
    create policy client_contacts_manager_read
      on public.client_contacts
      for select
      to authenticated
      using (
        exists (
          select 1 from public.profiles
          where profiles.user_id = auth.uid()
            and lower(trim(coalesce(profiles.role, ''))) = 'manager'
        )
      );
  end if;
end;
$$;

create or replace function public.save_client_contact(
  p_contact_id uuid,
  p_client_id uuid,
  p_first_name text,
  p_last_name text,
  p_job_title text,
  p_email text,
  p_phone text,
  p_contact_type text,
  p_is_primary boolean
)
returns public.client_contacts
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_contact public.client_contacts;
  v_name text;
begin
  if trim(coalesce(p_email, '')) = '' then
    raise exception 'Email is required.';
  end if;

  if lower(trim(coalesce(p_contact_type, ''))) not in (
    'primary', 'billing', 'manager', 'general'
  ) then
    raise exception 'Select a valid contact type.';
  end if;

  v_name := nullif(
    trim(concat_ws(' ', nullif(trim(p_first_name), ''), nullif(trim(p_last_name), ''))),
    ''
  );

  if coalesce(p_is_primary, false) then
    update public.client_contacts
    set is_primary = false
    where client_id = p_client_id
      and is_primary = true
      and is_active = true
      and (p_contact_id is null or id <> p_contact_id);
  end if;

  if p_contact_id is null then
    insert into public.client_contacts (
      client_id,
      first_name,
      last_name,
      name,
      email,
      phone,
      contact_type,
      job_title,
      is_primary,
      is_active
    ) values (
      p_client_id,
      nullif(trim(p_first_name), ''),
      nullif(trim(p_last_name), ''),
      v_name,
      lower(trim(p_email)),
      nullif(trim(p_phone), ''),
      lower(trim(p_contact_type)),
      nullif(trim(p_job_title), ''),
      coalesce(p_is_primary, false),
      true
    )
    returning * into v_contact;
  else
    update public.client_contacts
    set
      first_name = nullif(trim(p_first_name), ''),
      last_name = nullif(trim(p_last_name), ''),
      name = v_name,
      email = lower(trim(p_email)),
      phone = nullif(trim(p_phone), ''),
      contact_type = lower(trim(p_contact_type)),
      job_title = nullif(trim(p_job_title), ''),
      is_primary = coalesce(p_is_primary, false)
    where id = p_contact_id
      and client_id = p_client_id
      and is_active = true
    returning * into v_contact;

    if not found then
      raise exception 'Contact not found.';
    end if;
  end if;

  return v_contact;
exception
  when unique_violation then
    raise exception 'A contact with this email already exists for this client.';
end;
$$;

revoke all on function public.save_client_contact(
  uuid, uuid, text, text, text, text, text, text, boolean
) from public;

grant execute on function public.save_client_contact(
  uuid, uuid, text, text, text, text, text, text, boolean
) to authenticated;

notify pgrst, 'reload schema';
