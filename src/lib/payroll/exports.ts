import type {
  CompanyPayrollBankDetails,
  EmployeeBankDetails,
  PayrollEntry,
  PayrollRun,
} from "./types";
import { PAYROLL_LABELS } from "./labels";
import { canExportPayroll } from "./lifecycle";

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

export function salaryRegisterGrossPay(entry: Pick<PayrollEntry, "gross_salary" | "bonus" | "leave_encashment">) {
  return Number(entry.gross_salary || 0) + Number(entry.bonus || 0) + Number(entry.leave_encashment || 0);
}

const PF_CHARGE_RATE = 0.005;
const payrollMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function payrollPfAmounts(
  entry: Pick<PayrollEntry, "epf_salary" | "employee_pf" | "employer_pf" | "employer_eps">,
) {
  const epfSalary = Number(entry.epf_salary || 0);
  const administrationCharges = payrollMoney(epfSalary * PF_CHARGE_RATE);
  const edliCharges = payrollMoney(epfSalary * PF_CHARGE_RATE);

  return {
    employeePf: Number(entry.employee_pf || 0),
    employerPf: Number(entry.employer_pf || 0),
    employerEps: Number(entry.employer_eps || 0),
    administrationCharges,
    edliCharges,
    totalPf: payrollMoney(
      Number(entry.employee_pf || 0) +
      Number(entry.employer_pf || 0) +
      Number(entry.employer_eps || 0) +
      administrationCharges +
      edliCharges,
    ),
  };
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
    salaryRegisterGrossPay(entry),
    entry.professional_tax,
    entry.lop_deduction,
    entry.previous_month_adjustment,
    entry.tds,
    entry.net_salary,
  ]);
}

const unsafeBankText = /[|^\r\n]/;
const exportError = (message: string) => new Error(`Bank transfer file cannot be generated. ${message}`);

function requiredBankValue(value: string | null | undefined, label: string) {
  const normalized = String(value || "").trim();
  if (!normalized) throw exportError(`Payroll Bank Account ${label} is missing.`);
  if (unsafeBankText.test(normalized)) throw exportError(`Payroll Bank Account ${label} contains an unsupported character.`);
  return normalized;
}

function bankProcessingDate(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) throw new Error("Salary Processing Date is missing for this payroll. Please correct the payroll processing details before exporting the bank transfer file.");
  const date = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
    throw new Error("Salary Processing Date is missing for this payroll. Please correct the payroll processing details before exporting the bank transfer file.");
  }
  return `${match[2]}/${match[3]}/${match[1]}`;
}

function safeEmployeeName(entry: PayrollEntry) {
  const name = stripEmployeeTitle(String(entry.employee_name || ""));
  if (!name) throw exportError(`${entry.employee_code || "Unknown employee"} – Employee Name missing.`);
  if (unsafeBankText.test(name)) throw exportError(`${entry.employee_code} – ${name} – Employee Name contains an unsupported character.`);
  return name;
}

function wholeRupees(value: unknown, employeeCode: string, employeeName: string) {
  if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) || Number(value) < 0) {
    throw exportError(`${employeeCode} – ${employeeName} – Net Pay missing or invalid.`);
  }
  return Math.round(Number(value));
}

export function buildBankTransferFile(
  run: PayrollRun,
  bankDetails: EmployeeBankDetails[],
  companyBankDetails: CompanyPayrollBankDetails,
) {
  if (!canExportPayroll(run.status)) throw exportError("Payroll must be Approved or Submitted before export.");
  const customerId = requiredBankValue(companyBankDetails.payroll_bank_customer_id, "Customer ID");
  const debitAccount = requiredBankValue(companyBankDetails.payroll_bank_account_number, "Debit Account Number");
  const debitIfsc = requiredBankValue(companyBankDetails.payroll_bank_ifsc_code, "Debit IFSC").toUpperCase();
  const branchCode = requiredBankValue(companyBankDetails.payroll_bank_branch_code, "Branch Code");
  const currency = requiredBankValue(companyBankDetails.payroll_bank_currency, "Currency").toUpperCase();
  const processingDate = bankProcessingDate(run.processing_date);
  const detailsByEmployee = employeeBankDetailsMap(bankDetails);
  const monthDate = new Date(`${run.payroll_month.slice(0, 7)}-01T00:00:00Z`);
  if (Number.isNaN(monthDate.getTime())) throw exportError("Payroll Month is invalid.");
  const narration = `Despacho Salary ${monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}`;
  if (unsafeBankText.test(narration)) throw exportError("Narration contains an unsupported character.");
  const employeeErrors: string[] = [];
  const paymentRows = (run.entries || []).flatMap((entry) => {
    let name = "Employee Name";
    try { name = safeEmployeeName(entry); } catch (cause) { employeeErrors.push(cause instanceof Error ? cause.message.replace(/^Bank transfer file cannot be generated\. /, "") : `${entry.employee_code} – Employee Name missing.`); return []; }
    const details = detailsByEmployee.get(entry.employee_id);
    const account = String(details?.bank_account_number || "").trim();
    const ifsc = String(details?.ifsc_code || "").trim().toUpperCase();
    if (!account) employeeErrors.push(`${entry.employee_code} – ${name} – Bank Account Number missing.`);
    if (!ifsc) employeeErrors.push(`${entry.employee_code} – ${name} – IFSC missing.`);
    if (unsafeBankText.test(account) || unsafeBankText.test(ifsc)) employeeErrors.push(`${entry.employee_code} – ${name} – Bank details contain an unsupported character.`);
    let amount = 0;
    try { amount = wholeRupees(entry.net_salary, entry.employee_code, name); } catch (cause) { employeeErrors.push(cause instanceof Error ? cause.message.replace(/^Bank transfer file cannot be generated\. /, "") : `${entry.employee_code} – ${name} – Net Pay missing or invalid.`); }
    if (!account || !ifsc || unsafeBankText.test(account) || unsafeBankText.test(ifsc) || !Number.isFinite(Number(entry.net_salary)) || Number(entry.net_salary) < 0) return [];
    return [{
      amount,
      record: ifsc.startsWith("ICIC")
        ? ["MCW", account, branchCode, name, amount, currency, narration, ifsc, "WIB"].join("|") + "^"
        : ["MCO", account, branchCode, name, amount, currency, narration, "NFT", ifsc].join("|") + "^",
    }];
  });
  if (employeeErrors.length) {
    const employeeCount = new Set(employeeErrors.map((message) => message.split(" – ")[0])).size;
    throw exportError(`${employeeCount} ${employeeCount === 1 ? "employee has" : "employees have"} incomplete bank details.\n${employeeErrors.join("\n")}`);
  }
  const total = paymentRows.reduce((sum, row) => sum + row.amount, 0);
  const fhr = ["FHR", paymentRows.length + 1, processingDate, "Cut-off", total, currency, debitAccount, branchCode].join("|") + "^";
  const mdr = ["MDR", debitAccount, branchCode, customerId, total, currency, narration, debitIfsc, "WIB"].join("|") + "^";
  return [fhr, mdr, ...paymentRows.map((row) => row.record)].join("\n");
}

export function bankTransferSummary(run: PayrollRun, companyBankDetails: CompanyPayrollBankDetails) {
  const total = (run.entries || []).reduce((sum, entry) => sum + Math.round(Number(entry.net_salary || 0)), 0);
  const account = String(companyBankDetails.payroll_bank_account_number || "").trim();
  return {
    employeeCount: (run.entries || []).length,
    total,
    maskedDebitAccount: account ? `${"X".repeat(Math.max(account.length - 4, 4))}${account.slice(-4)}` : "Not configured",
  };
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
  administrationCharges: number;
  edliCharges: number;
  totalPf: number;
  professionalTax: number;
  lop: number;
  previousMonthAdjustment: number;
  tds: number;
  netSalary: number;
  employeesProcessed: number;
  grossPayroll: number;
  netPayroll: number;
};

export type MonthlyPayrollSummary = {
  payrollMonth: string;
  summary: PayrollSummary;
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
    const grossPay = salaryRegisterGrossPay(entry);
    const pf = payrollPfAmounts(entry);
    summary.grossSalary += grossPay;
    summary.employeePf += pf.employeePf;
    summary.employerPf += pf.employerPf;
    summary.employerEps += pf.employerEps;
    summary.administrationCharges += pf.administrationCharges;
    summary.edliCharges += pf.edliCharges;
    summary.totalPf += pf.totalPf;
    summary.professionalTax += Number(entry.professional_tax || 0);
    summary.lop += Number(entry.lop_deduction || 0);
    summary.previousMonthAdjustment += Number(entry.previous_month_adjustment || 0);
    summary.tds += Number(entry.tds || 0);
    summary.netSalary += Number(entry.net_salary || 0);
    summary.grossPayroll += grossPay;
    summary.netPayroll += Number(entry.net_salary || 0);
    summary.employeesProcessed = employeeIds.size;
    return summary;
  }, {
    basicPay: 0, hra: 0, conveyanceAllowance: 0, otherAllowance: 0, bonus: 0,
    leaveEncashment: 0, grossSalary: 0, employeePf: 0, employerPf: 0,
    employerEps: 0, administrationCharges: 0, edliCharges: 0, totalPf: 0,
    professionalTax: 0, lop: 0, previousMonthAdjustment: 0,
    tds: 0, netSalary: 0, employeesProcessed: 0, grossPayroll: 0, netPayroll: 0,
  });
}

export function summarizePayrollByMonth(
  entries: PayrollEntry[],
  payrollMonths: string[],
): MonthlyPayrollSummary[] {
  const entriesByMonth = new Map<string, PayrollEntry[]>();

  entries.forEach((entry) => {
    const payrollMonth = entry.payroll_month.slice(0, 7);
    const monthEntries = entriesByMonth.get(payrollMonth) || [];
    monthEntries.push(entry);
    entriesByMonth.set(payrollMonth, monthEntries);
  });

  return payrollMonths.map((payrollMonth) => ({
    payrollMonth,
    summary: summarizePayroll(entriesByMonth.get(payrollMonth) || []),
  }));
}
