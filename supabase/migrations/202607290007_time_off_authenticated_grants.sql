begin;

-- RLS policies decide which rows each signed-in user may see or change.
-- These table-level privileges only allow PostgREST to reach those policies.
grant usage on schema public to authenticated;

grant select on table
  public.leave_types,
  public.leave_policies,
  public.leave_policy_rules,
  public.leave_policy_assignments,
  public.holiday_calendars,
  public.holidays,
  public.employee_leave_entitlements,
  public.employee_leave_balances,
  public.leave_requests,
  public.leave_request_days,
  public.leave_request_actions,
  public.leave_request_comments,
  public.leave_balance_adjustments,
  public.leave_extended_exceptions,
  public.leave_year_closures,
  public.leave_encashments,
  public.leave_attachments,
  public.leave_notifications,
  public.time_off_audit_log
to authenticated;

-- Employee/manager writes allowed by the existing scoped RLS policies.
grant insert on table
  public.leave_request_comments,
  public.leave_attachments
to authenticated;

-- Configuration writes remain restricted by time_off_is_admin() RLS checks.
grant insert, update, delete on table
  public.leave_types,
  public.leave_policies,
  public.leave_policy_rules,
  public.leave_policy_assignments,
  public.holiday_calendars,
  public.holidays
to authenticated;

notify pgrst, 'reload schema';

commit;
