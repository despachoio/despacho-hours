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
  v_target_contact_id uuid := p_contact_id;
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
    trim(
      concat_ws(
        ' ',
        nullif(trim(p_first_name), ''),
        nullif(trim(p_last_name), '')
      )
    ),
    ''
  );

  -- Reuse an inactive contact with the same client/email instead of
  -- violating the historical per-client email uniqueness constraint.
  if v_target_contact_id is null then
    select id
    into v_target_contact_id
    from public.client_contacts
    where client_id = p_client_id
      and lower(email) = lower(trim(p_email))
      and is_active = false
    order by updated_at desc, created_at desc
    limit 1
    for update;
  end if;

  if coalesce(p_is_primary, false) then
    update public.client_contacts
    set is_primary = false
    where client_id = p_client_id
      and is_primary = true
      and is_active = true
      and (v_target_contact_id is null or id <> v_target_contact_id);
  end if;

  if v_target_contact_id is null then
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
      is_primary = coalesce(p_is_primary, false),
      is_active = true
    where id = v_target_contact_id
      and client_id = p_client_id
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
