import type { RecurringAdjustmentComponent, RecurringPayrollAdjustment } from "./types";

export type RecurringAdjustmentStatus = "scheduled" | "active" | "expired" | "disabled";

export function payrollMonthDate(value: string) {
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(String(value || "").trim());
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) throw new Error("Select a valid payroll month");
  return `${match[1]}-${match[2]}-01`;
}

export function recurringAdjustmentStatus(adjustment: Pick<RecurringPayrollAdjustment, "enabled" | "from_month" | "to_month">, currentMonth: string): RecurringAdjustmentStatus {
  if (!adjustment.enabled) return "disabled";
  const month = payrollMonthDate(currentMonth);
  if (month < payrollMonthDate(adjustment.from_month)) return "scheduled";
  if (adjustment.to_month && month > payrollMonthDate(adjustment.to_month)) return "expired";
  return "active";
}

export function applicableRecurringAdjustments<T extends Pick<RecurringPayrollAdjustment, "employee_id" | "enabled" | "from_month" | "to_month">>(adjustments: T[], employeeId: string, payrollMonth: string) {
  const month = payrollMonthDate(payrollMonth);
  return adjustments.filter((adjustment) => adjustment.employee_id === employeeId && adjustment.enabled && payrollMonthDate(adjustment.from_month) <= month && (!adjustment.to_month || payrollMonthDate(adjustment.to_month) >= month));
}

export function recurringComponentTotal(adjustments: Array<Pick<RecurringPayrollAdjustment, "component" | "amount">>, component: RecurringAdjustmentComponent) {
  return adjustments.filter((adjustment) => adjustment.component === component).reduce((sum, adjustment) => sum + Number(adjustment.amount || 0), 0);
}
