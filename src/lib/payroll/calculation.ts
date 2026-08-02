export type PayrollCalculationInput = {
  grossSalary: number;
  conveyanceAllowance?: number;
  bonus?: number;
  leaveEncashment?: number;
  reimbursements?: number;
  lopDays?: number;
  periodDays?: number;
  confirmedLopDeduction?: number | null;
  previousMonthAdjustment?: number;
  tds?: number;
  professionalTaxThreshold?: number;
  professionalTaxAmount?: number;
};

const money = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const safe = (value: number | undefined) => Math.max(Number(value || 0), 0);

export function calculatePayroll(input: PayrollCalculationInput) {
  const grossSalary = safe(input.grossSalary);
  const basicPay = money(grossSalary <= 16_800 ? 15_000 : grossSalary * 0.5);
  const hra = money(grossSalary <= 16_800 ? 0 : basicPay * 0.4);
  const conveyanceAllowance = money(safe(input.conveyanceAllowance ?? 1_600));
  const otherAllowance = money(grossSalary - basicPay - hra - conveyanceAllowance);
  const epfSalary = money(Math.min(basicPay, 15_000));
  const employeePf = money(epfSalary * 0.12);

const employerEps = money(
  Math.min(Math.round(epfSalary * 0.0833), 1250),
);

const employerPf = money(employeePf - employerEps);
  const employerTotalContribution = money(employerPf + employerEps);
  const bonus = money(safe(input.bonus));
  const leaveEncashment = money(safe(input.leaveEncashment));
  const reimbursements = money(safe(input.reimbursements));
  const lopDays = safe(input.lopDays);
  const periodDays = Math.max(Number(input.periodDays || 30), 1);
  const lopRecommended = money((grossSalary / periodDays) * lopDays);
  const lopDeduction = money(input.confirmedLopDeduction == null ? lopRecommended : safe(input.confirmedLopDeduction));
  const previousMonthAdjustment = money(Number(input.previousMonthAdjustment || 0));
  const tds = money(safe(input.tds));
  const totalEarnings = money(grossSalary + bonus + leaveEncashment + reimbursements);
  const beforeProfessionalTax = money(totalEarnings - employeePf - lopDeduction - previousMonthAdjustment - tds);
  const professionalTax = beforeProfessionalTax >= Number(input.professionalTaxThreshold ?? 25_000)
    ? money(Number(input.professionalTaxAmount ?? 200))
    : 0;
  const totalDeductions = money(employeePf + professionalTax + lopDeduction + previousMonthAdjustment + tds);
  const netSalary = money(Math.max(totalEarnings - totalDeductions, 0));

  return { grossSalary, basicPay, hra, conveyanceAllowance, otherAllowance, bonus, leaveEncashment, reimbursements, epfSalary, employeePf, employerPf, employerEps, employerTotalContribution, professionalTax, lopDays, lopRecommended, lopDeduction, previousMonthAdjustment, tds, totalEarnings, totalDeductions, netSalary };
}

export function payrollPeriod(payrollMonth: string, startDay = 26, endDay = 25) {
  const month = new Date(`${payrollMonth.slice(0, 7)}-01T00:00:00Z`);
  const start = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, startDay));
  const end = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), endDay));
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end), days: Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1 };
}
