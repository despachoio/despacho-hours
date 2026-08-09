import type {
  CompanyPayrollBankDetails,
  EmployeeBankDetails,
  PayrollEntry,
  PayrollRun,
} from "./types";
import { PAYROLL_LABELS } from "./labels";

export const salaryRegisterHeaders = [
  "Employee Code", "Employee Name", "Bank Name", "IFSC Code", "Bank Account Number",
  "Bonus", "Leave Encashment", "Gross Pay", "PT", PAYROLL_LABELS.lop,
  "Adjustment", PAYROLL_LABELS.tds, "Net Pay",
];

export function stripEmployeeTitle(name: string) {
  return name.replace(/^(?:mr|mrs|ms|miss|dr)\.?\s+/i, "").trim();
}

export function employeeBankDetailsMap(bankDetails: EmployeeBankDetails[]) {
  return new Map(bankDetails.map((details) => [details.employee_id, details]));
}

export function salaryRegisterRows(run: PayrollRun, bankDetails: EmployeeBankDetails[] = []) {
  const detailsByEmployee = employeeBankDetailsMap(bankDetails);
  return (run.entries || []).map((entry) => [
    entry.employee_code,
    stripEmployeeTitle(entry.employee_name),
    detailsByEmployee.get(entry.employee_id)?.bank_name || "",
    detailsByEmployee.get(entry.employee_id)?.ifsc_code || "",
    detailsByEmployee.get(entry.employee_id)?.bank_account_number || "",
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

const requiredCompanyBankValue = (value: string | null | undefined, label: string) => {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${label} is missing in Company Settings.`);
  return normalized;
};

export function buildBankTransferFile(
  run: PayrollRun,
  bankDetails: EmployeeBankDetails[],
  companyBankDetails: CompanyPayrollBankDetails,
) {
  const customerId = requiredCompanyBankValue(companyBankDetails.payroll_bank_customer_id, "Customer ID");
  const debitAccount = requiredCompanyBankValue(companyBankDetails.payroll_bank_account_number, "Company bank account number");
  const debitIfsc = requiredCompanyBankValue(companyBankDetails.payroll_bank_ifsc_code, "Company IFSC code");
  const processingDate = requiredCompanyBankValue(run.processing_date, "Payroll processing date");
  const detailsByEmployee = employeeBankDetailsMap(bankDetails);
  const paymentRows = (run.entries || []).map((entry) => {
    const details = detailsByEmployee.get(entry.employee_id);
    if (!details?.bank_account_number || !details.ifsc_code) {
      throw new Error(`Bank account number and IFSC code are required for ${stripEmployeeTitle(entry.employee_name)}.`);
    }
    return [
      entry.employee_code,
      stripEmployeeTitle(entry.employee_name),
      details.bank_name || "",
      details.bank_account_number,
      details.ifsc_code,
      Math.round(Number(entry.net_salary || 0)),
    ].join("\t");
  });
  const metadata = [
    ["Customer ID", customerId],
    ["Debit Account Number", debitAccount],
    ["Debit IFSC", debitIfsc],
    ["Processing Date", processingDate],
    ["Payroll Month", run.payroll_month.slice(0, 7)],
    ["Total Amount", Math.round(Number(run.net_payroll || 0))],
  ].map((row) => row.join("\t"));
  const header = ["Employee Code", "Beneficiary", "Bank Name", "Account Number", "IFSC", "Amount"].join("\t");
  return [...metadata, "", header, ...paymentRows].join("\n");
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
