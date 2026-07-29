import { supabase } from "@/lib/supabase";
import type { DayPart, PolicyEvaluation } from "./types";

export type TimeOffProfile = {
  role: string;
  employee_id: string;
  full_name: string | null;
};

export type TimeOffDashboard = {
  employee_id: string;
  leave_year: number;
  entitlement_days: number;
  used_paid_days: number;
  pending_paid_days: number;
  available_paid_days: number;
  projected_paid_days: number;
  unplanned_used_days: number;
  unplanned_remaining_days: number;
  lop_used_days: number;
  lop_salary_deduction_days: number;
  encashable_estimate_days: number;
  pending_requests: number;
  approved_upcoming_requests: number;
  policy_tier: "first_year" | "post_first_year";
  service_completed_months: number;
  first_anniversary: string;
  parental_leave_label: string;
  parental_leave_eligible: boolean;
  monthly_application_allowance: number;
  monthly_day_allowance: number;
  extended_exception_status: string;
  extended_exception_reason: string | null;
  next_holiday: { date: string; name: string; day_part: string } | null;
};

export type LeaveType = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_paid: boolean;
  is_active: boolean;
  colour: string;
  gender_eligibility: string;
  minimum_service_months: number;
  maximum_days_per_request: number | null;
  annual_limit: number | null;
  monthly_limit: number | null;
  half_day_allowed: boolean;
  exclude_holidays: boolean;
  exclude_weekends: boolean;
  documents_required: boolean;
  negative_balance_allowed: boolean;
  manager_approval_required: boolean;
  display_order: number;
};

export type LeaveRequest = {
  id: string;
  employee_id: string;
  leave_type_id: string;
  leave_year: number;
  start_date: string;
  end_date: string;
  start_day_part: DayPart;
  end_day_part: DayPart;
  requested_days: number;
  working_days: number;
  calendar_span_days: number;
  holidays_excluded: number;
  weekly_offs_excluded: number;
  reason: string;
  handover_notes: string | null;
  emergency: boolean;
  status: string;
  submitted_at: string | null;
  manager_comment: string | null;
  administrative_override_required: boolean;
  lop_salary_deduction_days: number;
  extended_exception_consumed: boolean;
  policy_snapshot: PolicyEvaluation;
  leave_types: Pick<LeaveType, "name" | "code" | "colour" | "is_paid"> | null;
  employees?: {
    id: string;
    employee_code: string | null;
    name: string;
    title: string | null;
    department: string | null;
    reporting_manager_id: string | null;
  } | null;
  leave_request_days?: Array<{
    id: string;
    leave_date: string;
    day_part: "first_half" | "second_half";
    duration: number;
    is_working_day: boolean;
    is_holiday: boolean;
    is_weekly_off: boolean;
    status: string;
  }>;
  leave_request_actions?: Array<{
    id: string;
    action: string;
    actor_role: string | null;
    previous_status: string | null;
    new_status: string | null;
    comment: string | null;
    created_at: string;
  }>;
  leave_attachments?: Array<{
    id: string;
    storage_path: string;
    file_name: string;
    mime_type: string | null;
    file_size_bytes: number | null;
  }>;
  leave_request_comments?: Array<{
    id: string;
    author_role: string;
    comment: string;
    created_at: string;
  }>;
};

export type Holiday = {
  id: string;
  holiday_date: string;
  name: string;
  day_part: DayPart;
  is_recurring_annual: boolean;
  is_active: boolean;
  notes: string | null;
  holiday_calendars?: {
    id: string;
    name: string;
    calendar_year: number;
    audience: string;
  } | null;
};

export type CalendarLeave = {
  id: string;
  employee_id: string;
  employee_name: string;
  department: string | null;
  leave_type_name: string;
  leave_type_code: string;
  colour: string;
  start_date: string;
  end_date: string;
  working_days: number;
  status: string;
  reason: string | null;
  is_own: boolean;
  can_view_details: boolean;
  reporting_manager_id: string | null;
  manager_name: string | null;
};

export type TimeOffData = {
  profile: TimeOffProfile;
  dashboard: TimeOffDashboard;
  leaveTypes: LeaveType[];
  requests: LeaveRequest[];
  holidays: Holiday[];
  calendar: CalendarLeave[];
  approvalQueue: LeaveRequest[];
  notifications: TimeOffNotification[];
  managerBalances: Array<{
    id: string;
    employee_id: string;
    leave_year: number;
    entitled_days: number;
    used_days: number;
    pending_days: number;
    available_days: number;
    employee_name: string;
    employee_title: string | null;
    employee_code: string | null;
    leave_type_name: string;
    leave_type_code: string;
  }>;
  recentTeamRequests: LeaveRequest[];
};

export type TimeOffNotification = {
  id: string;
  subject: string;
  body: string;
  notification_type: string;
  status: string;
  read_at: string | null;
  created_at: string;
};

export type TimeOffEmployee = {
  id: string;
  employee_code: string | null;
  title: string | null;
  name: string;
  department: string | null;
  status: string | null;
};

export type LeavePolicy = {
  id: string;
  name: string;
  version: number;
  effective_start_date: string;
  effective_end_date: string | null;
  is_active: boolean;
};

export type PolicyRule = {
  id: string;
  policy_id: string;
  rule_key: string;
  rule_value: number | string | boolean | Record<string, unknown>;
  description: string | null;
};

export type AuditItem = {
  id: string;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  employee_id: string | null;
  previous_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
};

export type TimeOffAdminData = {
  employees: TimeOffEmployee[];
  policies: LeavePolicy[];
  policyRules: PolicyRule[];
  calendars: Array<{
    id: string;
    name: string;
    calendar_year: number;
    audience: string;
    country: string | null;
    location: string | null;
    department: string | null;
    is_active: boolean;
    notes: string | null;
  }>;
  audit: AuditItem[];
  balances: Array<{
    id: string;
    employee_id: string;
    leave_year: number;
    entitled_days: number;
    used_days: number;
    pending_days: number;
    adjustment_days: number;
    available_days: number;
    employees: { name: string; employee_code: string | null; department: string | null } | null;
    leave_types: { name: string; code: string } | null;
  }>;
  adjustments: Array<{
    id: string;
    employee_id: string;
    leave_year: number;
    adjustment_days: number;
    effective_date: string;
    reason: string;
    reference: string | null;
    previous_balance: number;
    new_balance: number;
    created_at: string;
    employees: { name: string; employee_code: string | null } | null;
    leave_types: { name: string; code: string } | null;
  }>;
  closures: Array<Record<string, unknown>>;
  encashments: Array<Record<string, unknown>>;
  exceptions: Array<Record<string, unknown>>;
};

const requestSelect = `id,employee_id,leave_type_id,leave_year,start_date,end_date,start_day_part,end_day_part,requested_days,working_days,calendar_span_days,holidays_excluded,weekly_offs_excluded,reason,handover_notes,emergency,status,submitted_at,manager_comment,administrative_override_required,lop_salary_deduction_days,extended_exception_consumed,policy_snapshot,leave_types(name,code,colour,is_paid),employees(id,employee_code,name,title,department,reporting_manager_id),leave_request_days(id,leave_date,day_part,duration,is_working_day,is_holiday,is_weekly_off,status),leave_request_actions(id,action,actor_role,previous_status,new_status,comment,created_at),leave_request_comments(id,author_role,comment,created_at),leave_attachments(id,storage_path,file_name,mime_type,file_size_bytes)`;

export async function loadTimeOffData(year: number): Promise<TimeOffData> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Your session has expired.");
  const profileResult = await supabase
    .from("profiles")
    .select("role,employee_id,full_name")
    .eq("user_id", userData.user.id)
    .single();
  if (profileResult.error || !profileResult.data?.employee_id) {
    throw new Error(profileResult.error?.message || "Employee profile is not configured.");
  }
  const profile = profileResult.data as TimeOffProfile;
  const employeeResult = await supabase
    .from("employees")
    .select("gender")
    .eq("id", profile.employee_id)
    .single();
  if (employeeResult.error) throw new Error(employeeResult.error.message);
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const [dashboardResult, typeResult, requestResult, holidayResult, calendarResult, notificationResult] =
    await Promise.all([
      supabase.rpc("get_time_off_dashboard", {
        p_employee_id: profile.employee_id,
        p_leave_year: year,
      }),
      supabase
        .from("leave_types")
        .select("*")
        .order("display_order"),
      supabase
        .from("leave_requests")
        .select(requestSelect)
        .eq("employee_id", profile.employee_id)
        .lte("start_date", to)
        .gte("end_date", from)
        .order("created_at", { ascending: false }),
      supabase
        .from("holidays")
        .select(
          "id,holiday_date,name,day_part,is_recurring_annual,is_active,notes,holiday_calendars(id,name,calendar_year,audience)",
        )
        .gte("holiday_date", from)
        .lte("holiday_date", to)
        .eq("is_active", true)
        .order("holiday_date"),
      supabase.rpc("get_time_off_calendar", { p_from: from, p_to: to }),
      supabase
        .from("leave_notifications")
        .select("id,subject,body,notification_type,status,read_at,created_at")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
  const error =
    dashboardResult.error ||
    typeResult.error ||
    requestResult.error ||
    holidayResult.error ||
    calendarResult.error ||
    notificationResult.error;
  if (error) throw new Error(error.message);

  const normalizedRole = String(profile.role || "").trim().toLowerCase();
  const canApprove = ["manager", "admin", "super admin", "finance admin"].includes(
    normalizedRole,
  );
  let approvalQueue: LeaveRequest[] = [];
  let managerBalances: TimeOffData["managerBalances"] = [];
  let recentTeamRequests: LeaveRequest[] = [];
  if (canApprove) {
    const [queueResult, balancesResult, recentResult] = await Promise.all([
      supabase.from("leave_requests").select(requestSelect).in("status", ["pending", "cancellation_requested"]).neq("employee_id", profile.employee_id).order("submitted_at"),
      supabase.rpc("get_time_off_managed_balances", { p_leave_year: year }),
      supabase.from("leave_requests").select(requestSelect).in("status", ["approved", "rejected", "cancelled", "cancellation_rejected", "cancelled_by_admin"]).neq("employee_id", profile.employee_id).order("updated_at", { ascending: false }).limit(20),
    ]);
    const managerError = queueResult.error || balancesResult.error || recentResult.error;
    if (managerError) throw new Error(managerError.message);
    approvalQueue = (queueResult.data || []) as unknown as LeaveRequest[];
    managerBalances = (balancesResult.data || []) as unknown as TimeOffData["managerBalances"];
    recentTeamRequests = (recentResult.data || []) as unknown as LeaveRequest[];
  }

  const dashboard = dashboardResult.data as TimeOffDashboard;
  const gender = String(employeeResult.data?.gender || "").trim().toLowerCase();
  dashboard.parental_leave_label = gender === "female"
    ? "Maternity eligibility"
    : gender === "male"
      ? "Paternity eligibility"
      : "Maternity / Paternity eligibility";
  dashboard.parental_leave_eligible = ["female", "male"].includes(gender)
    && Number(dashboard.service_completed_months || 0) >= 24;

  return {
    profile,
    dashboard,
    leaveTypes: (typeResult.data || []) as LeaveType[],
    requests: (requestResult.data || []) as unknown as LeaveRequest[],
    holidays: (holidayResult.data || []) as unknown as Holiday[],
    calendar: (calendarResult.data || []) as CalendarLeave[],
    approvalQueue,
    notifications: (notificationResult.data || []) as TimeOffNotification[],
    managerBalances,
    recentTeamRequests,
  };
}

export async function markNotificationRead(notificationId: string) {
  const result = await supabase.rpc("mark_time_off_notification_read", {
    p_notification_id: notificationId,
  });
  if (result.error) throw new Error(result.error.message);
}

export async function evaluateLeave(input: {
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  startDayPart: DayPart;
  endDayPart: DayPart;
}) {
  const result = await supabase.rpc("time_off_evaluate_leave_request", {
    p_employee_id: input.employeeId,
    p_leave_type_id: input.leaveTypeId,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_start_day_part: input.startDayPart,
    p_end_day_part: input.endDayPart,
    p_existing_request_id: null,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data as PolicyEvaluation;
}

export async function submitLeave(input: {
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  startDayPart: DayPart;
  endDayPart: DayPart;
  reason: string;
  handoverNotes: string;
  emergency: boolean;
  lopReasonCategory: string | null;
  overrideReason: string | null;
}) {
  const result = await supabase.rpc("submit_leave_request", {
    p_employee_id: input.employeeId,
    p_leave_type_id: input.leaveTypeId,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_start_day_part: input.startDayPart,
    p_end_day_part: input.endDayPart,
    p_reason: input.reason,
    p_handover_notes: input.handoverNotes || null,
    p_emergency: input.emergency,
    p_lop_reason_category: input.lopReasonCategory,
    p_override_reason: input.overrideReason,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data as LeaveRequest;
}

export async function cancelLeave(requestId: string, comment = "") {
  const result = await supabase.rpc("cancel_own_leave_request", {
    p_request_id: requestId,
    p_comment: comment || null,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data as LeaveRequest;
}

export async function processLeave(
  requestId: string,
  action: string,
  comment: string,
  overrideReason = "",
) {
  const result = await supabase.rpc("process_leave_request", {
    p_request_id: requestId,
    p_action: action,
    p_comment: comment || null,
    p_override_reason: overrideReason || null,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data as LeaveRequest;
}

export async function addLeaveComment(requestId: string, employeeId: string, comment: string) {
  const user = await supabase.auth.getUser();
  if (!user.data.user) throw new Error("Your session has expired.");
  const result = await supabase.from("leave_request_comments").insert({
    leave_request_id: requestId,
    employee_id: employeeId,
    author_user_id: user.data.user.id,
    author_role: "employee",
    comment,
  });
  if (result.error) throw new Error(result.error.message);
}

export async function uploadLeaveAttachment(
  employeeId: string,
  requestId: string,
  file: File,
) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Your session has expired.");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const storagePath = `${employeeId}/${requestId}/${crypto.randomUUID()}-${safeName}`;
  const upload = await supabase.storage
    .from("leave-attachments")
    .upload(storagePath, file, { upsert: false });
  if (upload.error) throw new Error(upload.error.message);
  const metadata = await supabase.from("leave_attachments").insert({
    leave_request_id: requestId,
    employee_id: employeeId,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type || null,
    file_size_bytes: file.size,
    uploaded_by: userData.user.id,
  });
  if (metadata.error) {
    await supabase.storage.from("leave-attachments").remove([storagePath]);
    throw new Error(metadata.error.message);
  }
}

export async function openLeaveAttachment(storagePath: string) {
  const result = await supabase.storage
    .from("leave-attachments")
    .createSignedUrl(storagePath, 60);
  if (result.error) throw new Error(result.error.message);
  window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
}

export async function loadTimeOffAdminData(): Promise<TimeOffAdminData> {
  const [employees, policies, policyRules, calendars, audit, balances, adjustments, closures, encashments, exceptions] = await Promise.all([
    supabase
      .from("employees")
      .select("id,employee_code,title,name,department,status")
      .order("name"),
    supabase.from("leave_policies").select("*").order("effective_start_date", { ascending: false }),
    supabase.from("leave_policy_rules").select("*").order("rule_key"),
    supabase.from("holiday_calendars").select("id,name,calendar_year,audience,country,location,department,is_active,notes").order("calendar_year", { ascending: false }),
    supabase.from("time_off_audit_log").select("*").order("created_at", { ascending: false }).limit(250),
    supabase.from("employee_leave_balances").select("*,employees(name,employee_code,department),leave_types(name,code)").order("leave_year", { ascending: false }).limit(1000),
    supabase.from("leave_balance_adjustments").select("*,employees(name,employee_code),leave_types(name,code)").order("created_at", { ascending: false }).limit(500),
    supabase.from("leave_year_closures").select("*,employees(name,employee_code)").order("processed_at", { ascending: false }).limit(500),
    supabase.from("leave_encashments").select("*,employees(name,employee_code)").order("created_at", { ascending: false }).limit(500),
    supabase.from("leave_extended_exceptions").select("*,employees(name,employee_code)").order("leave_year", { ascending: false }).limit(500),
  ]);
  const error = employees.error || policies.error || policyRules.error || calendars.error || audit.error || balances.error || adjustments.error || closures.error || encashments.error || exceptions.error;
  if (error) throw new Error(error.message);
  return {
    employees: (employees.data || []) as TimeOffEmployee[],
    policies: (policies.data || []) as LeavePolicy[],
    policyRules: (policyRules.data || []) as PolicyRule[],
    calendars: calendars.data || [],
    audit: (audit.data || []) as AuditItem[],
    balances: (balances.data || []) as unknown as TimeOffAdminData["balances"],
    adjustments: (adjustments.data || []) as unknown as TimeOffAdminData["adjustments"],
    closures: (closures.data || []) as Array<Record<string, unknown>>,
    encashments: (encashments.data || []) as Array<Record<string, unknown>>,
    exceptions: (exceptions.data || []) as Array<Record<string, unknown>>,
  };
}

export async function saveLeaveType(value: Partial<LeaveType> & { name: string; code: string }) {
  const payload = { ...value, code: value.code.trim().toUpperCase(), name: value.name.trim() };
  const result = value.id
    ? await supabase.from("leave_types").update(payload).eq("id", value.id).select().single()
    : await supabase.from("leave_types").insert(payload).select().single();
  if (result.error) throw new Error(result.error.message);
  return result.data as LeaveType;
}

export async function saveHoliday(value: {
  id?: string;
  holiday_calendar_id: string;
  holiday_date: string;
  name: string;
  day_part: DayPart;
  is_recurring_annual: boolean;
  notes?: string;
  is_active?: boolean;
}) {
  const result = value.id
    ? await supabase.from("holidays").update(value).eq("id", value.id).select().single()
    : await supabase.from("holidays").insert(value).select().single();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function saveHolidayCalendar(value: {
  id?: string;
  name: string;
  calendar_year: number;
  audience: string;
  country?: string | null;
  location?: string | null;
  department?: string | null;
  is_active: boolean;
  notes?: string | null;
}) {
  const result = value.id
    ? await supabase.from("holiday_calendars").update(value).eq("id", value.id).select().single()
    : await supabase.from("holiday_calendars").insert(value).select().single();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function deleteFutureHoliday(id: string) {
  const result = await supabase.from("holidays").delete().eq("id", id);
  if (result.error) throw new Error(result.error.message);
}

export async function duplicateHolidayCalendar(sourceId: string, targetYear: number, targetName: string) {
  const result = await supabase.rpc("duplicate_holiday_calendar", {
    p_source_calendar_id: sourceId,
    p_target_year: targetYear,
    p_target_name: targetName,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function saveLeavePolicy(value: Partial<LeavePolicy> & { name: string; version: number; effective_start_date: string }) {
  const result = value.id
    ? await supabase.from("leave_policies").update(value).eq("id", value.id).select().single()
    : await supabase.from("leave_policies").insert(value).select().single();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function savePolicyRule(id: string, ruleValue: PolicyRule["rule_value"], description: string | null) {
  const result = await supabase.from("leave_policy_rules").update({
    rule_value: ruleValue,
    description,
  }).eq("id", id).select().single();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function loadYearEndPreview(employeeId: string, leaveYear: number) {
  const result = await supabase.rpc("get_time_off_year_end_preview", {
    p_employee_id: employeeId,
    p_leave_year: leaveYear,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data as Record<string, unknown>;
}

export async function processLeaveEncashment(id: string, payrollReference: string) {
  const result = await supabase.rpc("process_leave_encashment", {
    p_encashment_id: id,
    p_payroll_reference: payrollReference,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function reverseLeaveYearClosure(id: string, reason: string) {
  const result = await supabase.rpc("reverse_leave_year_closure", {
    p_closure_id: id,
    p_reason: reason,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export type TimeOffUsageRow = {
  leave_date: string;
  duration: number;
  status: string;
  leave_requests: {
    id: string;
    status: string;
    employee_id: string;
    lop_salary_deduction_days: number;
    employees: { name: string; department: string | null; reporting_manager_id: string | null } | null;
    leave_types: { name: string; code: string } | null;
  } | null;
};

export async function loadTimeOffUsageRows(from: string, to: string) {
  const result = await supabase
    .from("leave_request_days")
    .select("leave_date,duration,status,leave_requests!inner(id,status,employee_id,lop_salary_deduction_days,employees(name,department,reporting_manager_id),leave_types(name,code))")
    .eq("is_working_day", true)
    .gte("leave_date", from)
    .lte("leave_date", to)
    .order("leave_date");
  if (result.error) throw new Error(result.error.message);
  return (result.data || []) as unknown as TimeOffUsageRow[];
}

export async function adjustLeaveBalance(value: {
  employeeId: string;
  leaveTypeId: string;
  leaveYear: number;
  adjustmentDays: number;
  effectiveDate: string;
  reason: string;
  reference: string;
}) {
  const result = await supabase.rpc("adjust_employee_leave_balance", {
    p_employee_id: value.employeeId,
    p_leave_type_id: value.leaveTypeId,
    p_leave_year: value.leaveYear,
    p_adjustment_days: value.adjustmentDays,
    p_effective_date: value.effectiveDate,
    p_reason: value.reason,
    p_reference: value.reference || null,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function closeEmployeeLeaveYear(employeeId: string, leaveYear: number) {
  const result = await supabase.rpc("close_employee_leave_year", {
    p_employee_id: employeeId,
    p_leave_year: leaveYear,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
