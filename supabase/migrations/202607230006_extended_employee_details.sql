begin;

create table if not exists public.employee_extended_details (
  employee_id uuid primary key
    references public.employees(id)
    on delete cascade,
  phone_country_code text not null default '+91',
  phone_number text,
  marital_status text,
  blood_group text,
  bank_account_number text,
  bank_name text,
  ifsc_code text,
  branch_name text,
  address_line_1 text,
  address_line_2 text,
  address_line_3 text,
  city text,
  state text,
  country text default 'India',
  pincode text,
  father_name text,
  mother_name text,
  spouse_name text,
  children jsonb not null default '[]'::jsonb,
  emergency_contact_person text,
  emergency_contact_number text,
  nominee_name text,
  nominee_relationship text,
  nominee_date_of_birth date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_extended_phone_country_code_check
    check (phone_country_code ~ '^\+[0-9]{1,4}$'),
  constraint employee_extended_phone_number_check
    check (phone_number is null or phone_number ~ '^[0-9]{6,15}$'),
  constraint employee_extended_marital_status_check
    check (
      marital_status is null
      or marital_status in ('Single', 'Married', 'Divorced', 'Widow', 'Widower')
    ),
  constraint employee_extended_blood_group_check
    check (
      blood_group is null
      or blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')
    ),
  constraint employee_extended_children_check
    check (jsonb_typeof(children) = 'array')
);

alter table public.employee_extended_details enable row level security;

revoke all on table public.employee_extended_details from public, anon;
grant select, insert, update, delete
  on table public.employee_extended_details
  to authenticated, service_role;

drop policy if exists employee_extended_details_super_admin_all
  on public.employee_extended_details;
drop policy if exists employee_extended_details_admin_ordinary_all
  on public.employee_extended_details;
drop policy if exists employee_extended_details_self_read
  on public.employee_extended_details;

create policy employee_extended_details_super_admin_all
on public.employee_extended_details to authenticated
using (
  lower(trim(coalesce(public.get_my_role(), ''))) = 'super admin'
)
with check (
  lower(trim(coalesce(public.get_my_role(), ''))) = 'super admin'
);

create policy employee_extended_details_admin_ordinary_all
on public.employee_extended_details to authenticated
using (
  lower(trim(coalesce(public.get_my_role(), ''))) = 'admin'
  and not public.is_super_admin_employee(employee_id)
)
with check (
  lower(trim(coalesce(public.get_my_role(), ''))) = 'admin'
  and not public.is_super_admin_employee(employee_id)
);

create policy employee_extended_details_self_read
on public.employee_extended_details for select to authenticated
using (employee_id = public.get_my_employee_id());

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

    insert into public.employee_extended_details (
      employee_id,
      phone_country_code,
      phone_number,
      marital_status,
      blood_group,
      bank_account_number,
      bank_name,
      ifsc_code,
      branch_name,
      address_line_1,
      address_line_2,
      address_line_3,
      city,
      state,
      country,
      pincode,
      father_name,
      mother_name,
      spouse_name,
      children,
      emergency_contact_person,
      emergency_contact_number,
      nominee_name,
      nominee_relationship,
      nominee_date_of_birth,
      updated_at
    )
    values (
      v_request.employee_id,
      coalesce(nullif(trim(v_changes ->> 'phone_country_code'), ''), '+91'),
      nullif(trim(coalesce(v_changes ->> 'phone_number', '')), ''),
      nullif(trim(coalesce(v_changes ->> 'marital_status', '')), ''),
      nullif(trim(coalesce(v_changes ->> 'blood_group', '')), ''),
      nullif(trim(coalesce(v_changes ->> 'bank_account_number', '')), ''),
      nullif(trim(coalesce(v_changes ->> 'bank_name', '')), ''),
      nullif(upper(trim(coalesce(v_changes ->> 'ifsc_code', ''))), ''),
      nullif(trim(coalesce(v_changes ->> 'branch_name', '')), ''),
      nullif(trim(coalesce(v_changes ->> 'address_line_1', '')), ''),
      nullif(trim(coalesce(v_changes ->> 'address_line_2', '')), ''),
      nullif(trim(coalesce(v_changes ->> 'address_line_3', '')), ''),
      nullif(trim(coalesce(v_changes ->> 'city', '')), ''),
      nullif(trim(coalesce(v_changes ->> 'state', '')), ''),
      nullif(trim(coalesce(v_changes ->> 'country', '')), ''),
      nullif(trim(coalesce(v_changes ->> 'pincode', '')), ''),
      nullif(trim(coalesce(v_changes ->> 'father_name', '')), ''),
      nullif(trim(coalesce(v_changes ->> 'mother_name', '')), ''),
      nullif(trim(coalesce(v_changes ->> 'spouse_name', '')), ''),
      case
        when jsonb_typeof(v_changes -> 'children') = 'array'
          then v_changes -> 'children'
        else '[]'::jsonb
      end,
      nullif(trim(coalesce(v_changes ->> 'emergency_contact_person', '')), ''),
      nullif(trim(coalesce(v_changes ->> 'emergency_contact_number', '')), ''),
      nullif(trim(coalesce(v_changes ->> 'nominee_name', '')), ''),
      nullif(trim(coalesce(v_changes ->> 'nominee_relationship', '')), ''),
      nullif(v_changes ->> 'nominee_date_of_birth', '')::date,
      now()
    )
    on conflict (employee_id) do update
    set phone_country_code = excluded.phone_country_code,
        phone_number = excluded.phone_number,
        marital_status = excluded.marital_status,
        blood_group = excluded.blood_group,
        bank_account_number = excluded.bank_account_number,
        bank_name = excluded.bank_name,
        ifsc_code = excluded.ifsc_code,
        branch_name = excluded.branch_name,
        address_line_1 = excluded.address_line_1,
        address_line_2 = excluded.address_line_2,
        address_line_3 = excluded.address_line_3,
        city = excluded.city,
        state = excluded.state,
        country = excluded.country,
        pincode = excluded.pincode,
        father_name = excluded.father_name,
        mother_name = excluded.mother_name,
        spouse_name = excluded.spouse_name,
        children = excluded.children,
        emergency_contact_person = excluded.emergency_contact_person,
        emergency_contact_number = excluded.emergency_contact_number,
        nominee_name = excluded.nominee_name,
        nominee_relationship = excluded.nominee_relationship,
        nominee_date_of_birth = excluded.nominee_date_of_birth,
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

comment on table public.employee_extended_details is
  'Protected employee banking, address, family, contact, and nominee information.';

commit;
