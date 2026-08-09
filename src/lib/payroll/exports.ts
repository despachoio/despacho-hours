import type { PayrollEntry, PayrollRun } from "./types";
import { PAYROLL_LABELS } from "./labels";

export const salaryRegisterHeaders = [
  "Employee Code", "Employee Name", "Department", "Bonus", "Leave Encashment",
  "Gross Pay", "PT", PAYROLL_LABELS.lop, "Previous Month Adjustment", PAYROLL_LABELS.tds, "Net Pay",
];

export function salaryRegisterRows(run: PayrollRun) {
  return (run.entries || []).map((entry) => [
    entry.employee_code,
    entry.employee_name,
    entry.department || "",
    entry.bonus,
    entry.leave_encashment,
    entry.gross_salary,
    entry.professional_tax,
    entry.lop_deduction,
    entry.previous_month_adjustment,
    entry.tds,
    entry.net_salary,
  ]);
}

export type PayrollSummary = {
  basicPay: number;
  hra: number;
  conveyanceAllowance: number;
  otherAllowance: number;
  bonus: number;
  leaveEncashment: number;
  grossSalary: number;
  employeePf: number;
  employerPf: number;
  employerEps: number;
  professionalTax: number;
  lop: number;
  previousMonthAdjustment: number;
  tds: number;
  netSalary: number;
  employeesProcessed: number;
  grossPayroll: number;
  netPayroll: number;
};

export function summarizePayroll(entries: PayrollEntry[]): PayrollSummary {
  const employeeIds = new Set<string>();
  return entries.reduce<PayrollSummary>((summary, entry) => {
    employeeIds.add(entry.employee_id);
    summary.basicPay += Number(entry.basic_pay || 0);
    summary.hra += Number(entry.hra || 0);
    summary.conveyanceAllowance += Number(entry.conveyance_allowance || 0);
    summary.otherAllowance += Number(entry.other_allowance || 0);
    summary.bonus += Number(entry.bonus || 0);
    summary.leaveEncashment += Number(entry.leave_encashment || 0);
    summary.grossSalary += Number(entry.gross_salary || 0);
    summary.employeePf += Number(entry.employee_pf || 0);
    summary.employerPf += Number(entry.employer_pf || 0);
    summary.employerEps += Number(entry.employer_eps || 0);
    summary.professionalTax += Number(entry.professional_tax || 0);
    summary.lop += Number(entry.lop_deduction || 0);
    summary.previousMonthAdjustment += Number(entry.previous_month_adjustment || 0);
    summary.tds += Number(entry.tds || 0);
    summary.netSalary += Number(entry.net_salary || 0);
    summary.grossPayroll += Number(entry.gross_salary || 0);
    summary.netPayroll += Number(entry.net_salary || 0);
    summary.employeesProcessed = employeeIds.size;
    return summary;
  }, {
    basicPay: 0, hra: 0, conveyanceAllowance: 0, otherAllowance: 0, bonus: 0,
    leaveEncashment: 0, grossSalary: 0, employeePf: 0, employerPf: 0,
    employerEps: 0, professionalTax: 0, lop: 0, previousMonthAdjustment: 0,
    tds: 0, netSalary: 0, employeesProcessed: 0, grossPayroll: 0, netPayroll: 0,
  });
}
