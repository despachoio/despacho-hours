export const PAYROLL_LABELS = {
  lop: "LOP",
  tds: "TDS",
} as const;

export const MANUAL_PAYROLL_FIELDS = [
  { key: "bonus", label: "Bonus" },
  { key: "leaveEncashment", label: "Leave Encashment" },
  { key: "lopDeduction", label: PAYROLL_LABELS.lop },
  { key: "previousMonthAdjustment", label: "Previous Month Adjustment" },
  { key: "tds", label: PAYROLL_LABELS.tds },
] as const;

export type ManualPayrollField = (typeof MANUAL_PAYROLL_FIELDS)[number]["key"];

