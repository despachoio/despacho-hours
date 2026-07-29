export type DayPart = "full_day" | "first_half" | "second_half";

export type LeaveStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "cancellation_requested"
  | "cancellation_rejected"
  | "cancelled_by_admin";

export type PolicyTier = "first_year" | "post_first_year";

export type LeaveDurationDay = {
  leaveDate: string;
  dayPart: "first_half" | "second_half";
  duration: 0.5;
  isWorkingDay: boolean;
  isHoliday: boolean;
  isWeeklyOff: boolean;
};

export type LeaveDuration = {
  requestedDays: number;
  workingDays: number;
  calendarSpanDays: number;
  holidaysExcluded: number;
  weeklyOffsExcluded: number;
  days: LeaveDurationDay[];
};

export type PolicyEvaluation = {
  valid: boolean;
  blocking_errors: string[];
  warnings: string[];
  informational_messages: string[];
  calculated_duration: {
    requested_days: number;
    working_days: number;
    calendar_span_days: number;
    holidays_excluded: number;
    weekly_offs_excluded: number;
    days: Array<{
      leave_date: string;
      day_part: "first_half" | "second_half";
      duration: number;
      is_working_day: boolean;
      is_holiday: boolean;
      is_weekly_off: boolean;
    }>;
  };
  projected_balance: number;
  balance_before_request: number;
  entitlement_days: number;
  used_paid_days: number;
  pending_paid_days: number;
  policy_tier: PolicyTier;
  service_completed_months: number;
  first_anniversary: string;
  annual_unplanned_used: number;
  annual_unplanned_limit: number;
  annual_unplanned_remaining: number;
  annual_lop_used: number;
  selected_month_application_count: number;
  selected_month_paid_days: number;
  lop_salary_deduction_days: number;
  extended_exception_status: string;
  extended_exception_reason: string | null;
  extended_exception_consumed: boolean;
  override_required: boolean;
  policy_id: string;
  policy_name: string;
  policy_version: number;
};
