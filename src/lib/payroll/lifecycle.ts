import type { PayrollStatus } from "./types";

export type PayrollLifecycleStatus = "generated" | "approved" | "submitted";

export function payrollLifecycleStatus(status: PayrollStatus): PayrollLifecycleStatus {
  if (status === "published") return "submitted";
  if (status === "approved" || status === "locked") return "approved";
  return "generated";
}

export function canEditPayroll(status: PayrollStatus) {
  return payrollLifecycleStatus(status) === "generated";
}

export function canApprovePayroll(status: PayrollStatus) {
  return payrollLifecycleStatus(status) === "generated";
}

export function canSubmitPayroll(status: PayrollStatus) {
  return payrollLifecycleStatus(status) === "approved";
}

export function canExportPayroll(status: PayrollStatus) {
  return payrollLifecycleStatus(status) !== "generated";
}
