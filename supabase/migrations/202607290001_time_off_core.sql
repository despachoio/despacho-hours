begin;

create extension if not exists pgcrypto;

create or replace function public.time_off_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_my_actual_role() in (
    'admin', 'super admin', 'finance admin'
  )
$$;

create or replace function public.time_off_can_manage_employee(
  p_employee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.time_off_is_admin()
    or (
      public.get_my_actual_role() = 'manager'
      and exists (
      select 1
      from public.employees employee
      where employee.id = p_employee_id
        and employee.reporting_manager_id = public.get_my_employee_id()
      )
    )
$$;

create table if not exists public.leave_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  description text,
  is_paid boolean not null default true,
  is_active boolean not null default true,
  colour text not null default '#153E90',
  gender_eligibility text not null default 'All'
    check (gender_eligibility in ('All', 'Male', 'Female', 'Others')),
  minimum_service_months integer not null default 0
    check (minimum_service_months >= 0),
  maximum_days_per_request numeric(6,2),
  annual_limit numeric(6,2),
  monthly_limit numeric(6,2),
  half_day_allowed boolean not null default true,
  exclude_holidays boolean not null default true,
  exclude_weekends boolean not null default true,
  documents_required boolean not null default false,
  negative_balance_allowed boolean not null default false,
  manager_approval_required boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint leave_types_code_unique unique (code),
  constraint leave_types_name_unique unique (name),
  constraint leave_types_colour_check check (colour ~ '^#[0-9A-Fa-f]{6}$'),
  constraint leave_types_half_day_required check (half_day_allowed)
);

create table if not exists public.leave_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version integer not null default 1 check (version > 0),
  effective_start_date date not null,
  effective_end_date date,
  is_active boolean not null default true,
  policy_year_start_month integer not null default 1
    check (policy_year_start_month between 1 and 12),
  weekly_off_days smallint[] not null default array[0, 6]::smallint[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint leave_policies_dates_check check (
    effective_end_date is null or effective_end_date >= effective_start_date
  ),
  constraint leave_policies_name_version_unique unique (name, version)
);

create table if not exists public.leave_policy_rules (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.leave_policies(id) on delete restrict,
  rule_key text not null,
  rule_value jsonb not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint leave_policy_rules_unique unique (policy_id, rule_key)
);

create table if not exists public.leave_policy_assignments (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.leave_policies(id) on delete restrict,
  employee_id uuid references public.employees(id) on delete cascade,
  department text,
  effective_start_date date not null,
  effective_end_date date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  constraint leave_policy_assignments_target_check check (
    employee_id is not null or department is not null
  ),
  constraint leave_policy_assignments_dates_check check (
    effective_end_date is null or effective_end_date >= effective_start_date
  )
);

create table if not exists public.holiday_calendars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  calendar_year integer not null check (calendar_year between 2000 and 2200),
  audience text not null default 'ALL',
  country text,
  location text,
  department text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint holiday_calendars_name_year_unique unique (name, calendar_year)
);

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_calendar_id uuid not null
    references public.holiday_calendars(id) on delete cascade,
  holiday_date date not null,
  name text not null,
  day_part text not null default 'full_day'
    check (day_part in ('full_day', 'first_half', 'second_half')),
  is_recurring_annual boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint holidays_calendar_date_unique unique (
    holiday_calendar_id, holiday_date
  )
);

create table if not exists public.employee_leave_entitlements (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  policy_id uuid not null references public.leave_policies(id) on delete restrict,
  leave_year integer not null check (leave_year between 2000 and 2200),
  policy_tier text not null
    check (policy_tier in ('first_year', 'post_first_year')),
  entitled_days numeric(7,2) not null default 0,
  accrued_through date,
  first_anniversary date,
  calculation_details jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  constraint employee_leave_entitlements_unique unique (
    employee_id, policy_id, leave_year
  )
);

create table if not exists public.employee_leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type_id uuid not null references public.leave_types(id) on delete restrict,
  leave_year integer not null check (leave_year between 2000 and 2200),
  entitled_days numeric(7,2) not null default 0,
  used_days numeric(7,2) not null default 0,
  pending_days numeric(7,2) not null default 0,
  adjustment_days numeric(7,2) not null default 0,
  available_days numeric(7,2) generated always as (
    entitled_days + adjustment_days - used_days - pending_days
  ) stored,
  updated_at timestamptz not null default now(),
  constraint employee_leave_balances_unique unique (
    employee_id, leave_type_id, leave_year
  )
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  leave_type_id uuid not null references public.leave_types(id) on delete restrict,
  policy_id uuid not null references public.leave_policies(id) on delete restrict,
  leave_year integer not null check (leave_year between 2000 and 2200),
  start_date date not null,
  end_date date not null,
  start_day_part text not null default 'full_day'
    check (start_day_part in ('full_day', 'first_half', 'second_half')),
  end_day_part text not null default 'full_day'
    check (end_day_part in ('full_day', 'first_half', 'second_half')),
  requested_days numeric(7,2) not null,
  working_days numeric(7,2) not null,
  calendar_span_days integer not null,
  holidays_excluded numeric(7,2) not null default 0,
  weekly_offs_excluded numeric(7,2) not null default 0,
  reason text not null,
  handover_notes text,
  emergency boolean not null default false,
  status text not null default 'pending'
    check (status in (
      'draft', 'pending', 'approved', 'rejected', 'cancelled',
      'cancellation_requested', 'cancellation_rejected',
      'cancelled_by_admin'
    )),
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  rejected_at timestamptz,
  rejected_by uuid references auth.users(id),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id),
  manager_comment text,
  administrative_override_required boolean not null default false,
  administrative_override_by uuid references auth.users(id),
  administrative_override_reason text,
  lop_reason_category text
    check (lop_reason_category is null or lop_reason_category in (
      'general', 'monthly_paid_leave_limit_exceeded'
    )),
  lop_salary_deduction_days numeric(7,2) not null default 0,
  extended_exception_consumed boolean not null default false,
  maternity_expected_end_date date,
  maternity_actual_return_date date,
  policy_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id),
  constraint leave_requests_dates_check check (end_date >= start_date),
  constraint leave_requests_days_check check (
    requested_days >= 0 and working_days >= 0 and calendar_span_days > 0
  ),
  constraint leave_requests_override_reason_check check (
    administrative_override_by is null
    or nullif(trim(administrative_override_reason), '') is not null
  )
);

create table if not exists public.leave_request_days (
  id uuid primary key default gen_random_uuid(),
  leave_request_id uuid not null references public.leave_requests(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  leave_date date not null,
  day_part text not null check (day_part in ('first_half', 'second_half')),
  duration numeric(2,1) not null default 0.5 check (duration = 0.5),
  is_working_day boolean not null,
  is_holiday boolean not null default false,
  is_weekly_off boolean not null default false,
  status text not null check (status in (
    'draft', 'pending', 'approved', 'rejected', 'cancelled',
    'cancellation_requested', 'cancellation_rejected',
    'cancelled_by_admin'
  )),
  created_at timestamptz not null default now(),
  constraint leave_request_days_unique unique (
    leave_request_id, leave_date, day_part
  )
);

create unique index if not exists leave_request_days_active_slot_unique
on public.leave_request_days(employee_id, leave_date, day_part)
where is_working_day
  and status in ('pending', 'approved', 'cancellation_requested');

create table if not exists public.leave_request_actions (
  id uuid primary key default gen_random_uuid(),
  leave_request_id uuid not null references public.leave_requests(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  actor_user_id uuid references auth.users(id),
  actor_employee_id uuid references public.employees(id),
  actor_role text,
  action text not null,
  previous_status text,
  new_status text,
  comment text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.leave_request_comments (
  id uuid primary key default gen_random_uuid(),
  leave_request_id uuid not null references public.leave_requests(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  author_user_id uuid not null references auth.users(id),
  author_role text not null,
  comment text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.leave_balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  leave_type_id uuid not null references public.leave_types(id) on delete restrict,
  leave_year integer not null check (leave_year between 2000 and 2200),
  adjustment_days numeric(7,2) not null check (adjustment_days <> 0),
  effective_date date not null,
  reason text not null,
  reference text,
  previous_balance numeric(7,2) not null,
  new_balance numeric(7,2) not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);

create table if not exists public.leave_extended_exceptions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  leave_year integer not null check (leave_year between 2000 and 2200),
  leave_request_id uuid references public.leave_requests(id) on delete restrict,
  status text not null check (status in ('available', 'reserved', 'used', 'ineligible')),
  unavailable_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_extended_exceptions_unique unique (employee_id, leave_year)
);

create table if not exists public.leave_year_closures (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  leave_year integer not null check (leave_year between 2000 and 2200),
  entitlement_days numeric(7,2) not null,
  used_paid_leave_days numeric(7,2) not null,
  pending_paid_leave_days numeric(7,2) not null,
  remaining_paid_leave_days numeric(7,2) not null,
  lop_leave_days numeric(7,2) not null,
  lop_salary_deduction_days numeric(7,2) not null,
  encashable_leave_days numeric(7,2) not null,
  carry_forward_days numeric(7,2) not null default 0,
  expired_days numeric(7,2) not null default 0,
  status text not null default 'closed' check (status in ('closed', 'reversed')),
  calculation_details jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  processed_by uuid not null references auth.users(id),
  reversal_reason text,
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id),
  constraint leave_year_closures_unique unique (employee_id, leave_year)
);

create table if not exists public.leave_encashments (
  id uuid primary key default gen_random_uuid(),
  leave_year_closure_id uuid not null unique
    references public.leave_year_closures(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  leave_year integer not null,
  encashable_leave_days numeric(7,2) not null,
  status text not null default 'pending'
    check (status in ('pending', 'processed', 'reversed')),
  payroll_reference text,
  processed_at timestamptz,
  processed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.leave_attachments (
  id uuid primary key default gen_random_uuid(),
  leave_request_id uuid not null references public.leave_requests(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid not null references auth.users(id)
);

create table if not exists public.leave_notifications (
  id uuid primary key default gen_random_uuid(),
  leave_request_id uuid references public.leave_requests(id) on delete restrict,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  subject text not null,
  body text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  deduplication_key text not null unique,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.time_off_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  actor_employee_id uuid references public.employees(id),
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  employee_id uuid references public.employees(id),
  previous_values jsonb,
  new_values jsonb,
  reason text,
  request_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists leave_requests_employee_dates_idx
  on public.leave_requests(employee_id, start_date, end_date);
create index if not exists leave_requests_status_submitted_idx
  on public.leave_requests(status, submitted_at desc);
create index if not exists leave_requests_employee_year_idx
  on public.leave_requests(employee_id, leave_year, status);
create index if not exists leave_request_days_date_idx
  on public.leave_request_days(leave_date, status);
create index if not exists leave_request_actions_request_idx
  on public.leave_request_actions(leave_request_id, created_at);
create index if not exists leave_balance_adjustments_employee_idx
  on public.leave_balance_adjustments(employee_id, leave_year, created_at);
create index if not exists holidays_active_date_idx
  on public.holidays(holiday_date) where is_active;
create index if not exists time_off_audit_created_idx
  on public.time_off_audit_log(created_at desc);
create index if not exists time_off_audit_employee_idx
  on public.time_off_audit_log(employee_id, created_at desc);

create or replace function public.time_off_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if to_jsonb(new) ? 'updated_by' then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.time_off_audit_config_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  v_id := coalesce((to_jsonb(new) ->> 'id')::uuid, (to_jsonb(old) ->> 'id')::uuid);
  insert into public.time_off_audit_log (
    actor_user_id, actor_employee_id, actor_role, action,
    entity_type, entity_id, previous_values, new_values
  ) values (
    auth.uid(), public.get_my_employee_id(), public.get_my_actual_role(),
    lower(tg_op), tg_table_name, v_id,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'leave_types', 'leave_policies', 'leave_policy_rules',
    'holiday_calendars', 'holidays'
  ] loop
    execute format('drop trigger if exists %I_touch on public.%I', v_table, v_table);
    execute format(
      'create trigger %I_touch before update on public.%I for each row execute function public.time_off_touch_updated_at()',
      v_table, v_table
    );
    execute format('drop trigger if exists %I_audit on public.%I', v_table, v_table);
    execute format(
      'create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.time_off_audit_config_change()',
      v_table, v_table
    );
  end loop;
end
$$;

insert into public.leave_types (
  name, code, description, is_paid, colour, gender_eligibility,
  minimum_service_months, maximum_days_per_request, annual_limit,
  half_day_allowed, exclude_holidays, exclude_weekends, display_order
) values
  ('Planned Leave', 'PL', 'Planned paid time away from work.', true,
   '#153E90', 'All', 0, 5, null, true, true, true, 10),
  ('Unplanned Leave', 'UL', 'Unexpected paid time away from work.', true,
   '#D97706', 'All', 0, 2, 6, true, true, true, 20),
  ('Loss of Pay', 'LOP', 'Unpaid leave with payroll deduction.', false,
   '#DC2626', 'All', 0, 2, 3, true, true, true, 30),
  ('Maternity Leave', 'ML', 'Six calendar months of maternity leave.', true,
   '#DB2777', 'Female', 24, null, null, true, false, false, 40),
  ('Paternity Leave', 'PTL', 'Five working days of paternity leave.', true,
   '#7C3AED', 'Male', 24, 5, 5, true, true, true, 50)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_paid = excluded.is_paid,
  colour = excluded.colour,
  gender_eligibility = excluded.gender_eligibility,
  minimum_service_months = excluded.minimum_service_months,
  maximum_days_per_request = excluded.maximum_days_per_request,
  annual_limit = excluded.annual_limit,
  half_day_allowed = true,
  exclude_holidays = excluded.exclude_holidays,
  exclude_weekends = excluded.exclude_weekends,
  display_order = excluded.display_order;

insert into public.leave_policies (
  name, version, effective_start_date, is_active
) values (
  'Despacho Leave Policy', 1, date '2026-01-01', true
)
on conflict (name, version) do update set
  effective_start_date = excluded.effective_start_date,
  is_active = true;

insert into public.leave_policy_rules (policy_id, rule_key, rule_value, description)
select policy.id, rule.rule_key, rule.rule_value, rule.description
from public.leave_policies policy
cross join (values
  ('first_year_monthly_accrual', '1'::jsonb, 'One paid day per completed service month'),
  ('annual_paid_entitlement', '12'::jsonb, 'Annual paid entitlement after one year'),
  ('normal_monthly_paid_days', '2'::jsonb, 'Combined Planned and Unplanned monthly days'),
  ('first_year_monthly_applications', '1'::jsonb, 'First-year monthly application limit'),
  ('post_first_year_monthly_applications', '2'::jsonb, 'Post-first-year monthly application limit'),
  ('annual_unplanned_limit', '6'::jsonb, 'Annual Unplanned Leave limit'),
  ('annual_lop_reference', '3'::jsonb, 'LOP reference requiring override when exceeded'),
  ('lop_salary_multiplier', '1.5'::jsonb, 'Salary deduction days per LOP day'),
  ('extended_planned_working_days', '5'::jsonb, 'Annual extended Planned Leave maximum'),
  ('extended_planned_calendar_span', '9'::jsonb, 'Extended absence maximum calendar span'),
  ('maternity_calendar_months', '6'::jsonb, 'Maternity Leave calendar-month entitlement'),
  ('carry_forward_days', '0'::jsonb, 'No annual carry-forward')
) as rule(rule_key, rule_value, description)
where policy.name = 'Despacho Leave Policy' and policy.version = 1
on conflict (policy_id, rule_key) do update set
  rule_value = excluded.rule_value,
  description = excluded.description;

insert into public.holiday_calendars (
  name, calendar_year, audience, is_active, notes
) values (
  'Despacho Holiday Calendar 2026', 2026, 'ALL', true,
  'Seeded from the approved Despacho Holiday List - 2026.'
)
on conflict (name, calendar_year) do update set
  audience = 'ALL', is_active = true;

insert into public.holidays (
  holiday_calendar_id, holiday_date, name, day_part, is_active
)
select calendar.id, holiday.holiday_date, holiday.name, 'full_day', true
from public.holiday_calendars calendar
cross join (values
  (date '2026-01-01', 'New Year''s Day'),
  (date '2026-01-26', 'Republic Day'),
  (date '2026-02-16', 'President''s Day / Family Day'),
  (date '2026-04-03', 'Good Friday'),
  (date '2026-05-18', 'Victoria Day'),
  (date '2026-07-01', 'Canada Day'),
  (date '2026-09-07', 'Labor Day'),
  (date '2026-10-12', 'Columbus Day'),
  (date '2026-11-11', 'Veterans Day'),
  (date '2026-12-25', 'Christmas')
) as holiday(holiday_date, name)
where calendar.name = 'Despacho Holiday Calendar 2026'
  and calendar.calendar_year = 2026
on conflict (holiday_calendar_id, holiday_date) do update set
  name = excluded.name, day_part = 'full_day', is_active = true;

alter table public.leave_types enable row level security;
alter table public.leave_policies enable row level security;
alter table public.leave_policy_rules enable row level security;
alter table public.leave_policy_assignments enable row level security;
alter table public.holiday_calendars enable row level security;
alter table public.holidays enable row level security;
alter table public.employee_leave_entitlements enable row level security;
alter table public.employee_leave_balances enable row level security;
alter table public.leave_requests enable row level security;
alter table public.leave_request_days enable row level security;
alter table public.leave_request_actions enable row level security;
alter table public.leave_request_comments enable row level security;
alter table public.leave_balance_adjustments enable row level security;
alter table public.leave_extended_exceptions enable row level security;
alter table public.leave_year_closures enable row level security;
alter table public.leave_encashments enable row level security;
alter table public.leave_attachments enable row level security;
alter table public.leave_notifications enable row level security;
alter table public.time_off_audit_log enable row level security;

create policy leave_types_authenticated_read on public.leave_types
for select to authenticated using (true);
create policy leave_types_admin_write on public.leave_types
for all to authenticated using (public.time_off_is_admin())
with check (public.time_off_is_admin());
create policy leave_policies_authenticated_read on public.leave_policies
for select to authenticated using (true);
create policy leave_policies_admin_write on public.leave_policies
for all to authenticated using (public.time_off_is_admin())
with check (public.time_off_is_admin());
create policy leave_policy_rules_authenticated_read on public.leave_policy_rules
for select to authenticated using (true);
create policy leave_policy_rules_admin_write on public.leave_policy_rules
for all to authenticated using (public.time_off_is_admin())
with check (public.time_off_is_admin());
create policy leave_policy_assignments_admin_all on public.leave_policy_assignments
for all to authenticated using (public.time_off_is_admin())
with check (public.time_off_is_admin());
create policy holiday_calendars_authenticated_read on public.holiday_calendars
for select to authenticated using (is_active or public.time_off_is_admin());
create policy holiday_calendars_admin_write on public.holiday_calendars
for all to authenticated using (public.time_off_is_admin())
with check (public.time_off_is_admin());
create policy holidays_authenticated_read on public.holidays
for select to authenticated using (is_active or public.time_off_is_admin());
create policy holidays_admin_write on public.holidays
for all to authenticated using (public.time_off_is_admin())
with check (public.time_off_is_admin());

create policy leave_entitlements_scoped_read on public.employee_leave_entitlements
for select to authenticated using (
  employee_id = public.get_my_employee_id()
  or public.time_off_can_manage_employee(employee_id)
);
create policy leave_balances_scoped_read on public.employee_leave_balances
for select to authenticated using (
  employee_id = public.get_my_employee_id()
  or public.time_off_can_manage_employee(employee_id)
);
create policy leave_requests_scoped_read on public.leave_requests
for select to authenticated using (
  employee_id = public.get_my_employee_id()
  or public.time_off_can_manage_employee(employee_id)
);
create policy leave_request_days_scoped_read on public.leave_request_days
for select to authenticated using (
  employee_id = public.get_my_employee_id()
  or public.time_off_can_manage_employee(employee_id)
);
create policy leave_request_actions_scoped_read on public.leave_request_actions
for select to authenticated using (
  employee_id = public.get_my_employee_id()
  or public.time_off_can_manage_employee(employee_id)
);
create policy leave_comments_scoped_read on public.leave_request_comments
for select to authenticated using (
  employee_id = public.get_my_employee_id()
  or public.time_off_can_manage_employee(employee_id)
);
create policy leave_comments_scoped_insert on public.leave_request_comments
for insert to authenticated with check (
  author_user_id = auth.uid()
  and (
    employee_id = public.get_my_employee_id()
    or public.time_off_can_manage_employee(employee_id)
  )
);
create policy leave_adjustments_scoped_read on public.leave_balance_adjustments
for select to authenticated using (
  employee_id = public.get_my_employee_id()
  or public.time_off_can_manage_employee(employee_id)
);
create policy leave_exceptions_scoped_read on public.leave_extended_exceptions
for select to authenticated using (
  employee_id = public.get_my_employee_id()
  or public.time_off_can_manage_employee(employee_id)
);
create policy leave_closures_scoped_read on public.leave_year_closures
for select to authenticated using (
  employee_id = public.get_my_employee_id() or public.time_off_is_admin()
);
create policy leave_encashments_scoped_read on public.leave_encashments
for select to authenticated using (
  employee_id = public.get_my_employee_id() or public.time_off_is_admin()
);
create policy leave_attachments_scoped_read on public.leave_attachments
for select to authenticated using (
  employee_id = public.get_my_employee_id()
  or public.time_off_can_manage_employee(employee_id)
);
create policy leave_attachments_own_insert on public.leave_attachments
for insert to authenticated with check (
  employee_id = public.get_my_employee_id()
  and uploaded_by = auth.uid()
);
create policy leave_notifications_own_read on public.leave_notifications
for select to authenticated using (recipient_user_id = auth.uid());
create policy time_off_audit_admin_read on public.time_off_audit_log
for select to authenticated using (public.time_off_is_admin());

insert into storage.buckets (id, name, public, file_size_limit)
values ('leave-attachments', 'leave-attachments', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

create policy leave_attachments_storage_read on storage.objects
for select to authenticated using (
  bucket_id = 'leave-attachments'
  and (
    (storage.foldername(name))[1] = public.get_my_employee_id()::text
    or exists (
      select 1 from public.employees employee
      where employee.id::text = (storage.foldername(name))[1]
        and public.time_off_can_manage_employee(employee.id)
    )
  )
);
create policy leave_attachments_storage_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'leave-attachments'
  and (storage.foldername(name))[1] = public.get_my_employee_id()::text
);
create policy leave_attachments_storage_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'leave-attachments'
  and (
    owner_id = auth.uid()::text
    or public.time_off_is_admin()
  )
);

revoke all on function public.time_off_is_admin() from public, anon;
revoke all on function public.time_off_can_manage_employee(uuid) from public, anon;
grant execute on function public.time_off_is_admin() to authenticated, service_role;
grant execute on function public.time_off_can_manage_employee(uuid)
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
