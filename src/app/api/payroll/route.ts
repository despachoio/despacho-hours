import { cancelPayroll, createRecurringAdjustment, createSalaryStructure, deleteSalaryStructure, duplicateRecurringAdjustment, duplicateSalaryStructure, generatePayroll, loadPayroll, reprocessPayroll, savePayrollBankSettings, savePayrollSettings, toggleRecurringAdjustment, transitionPayroll, updatePayrollEntry, updateRecurringAdjustment, updateSalaryStructure } from "@/lib/payroll/server";
import { normalizePayrollNumber } from "@/lib/payroll/numbers";

export async function GET(request: Request) {
  try {
    const month = new URL(request.url).searchParams.get("month");
    return Response.json(await loadPayroll(request, month));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to load payroll";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 403 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    if (action === "create_structure") return Response.json(await createSalaryStructure(request, { employeeId: String(body.employeeId), grossSalary: normalizePayrollNumber(body.grossSalary as string | number | null | undefined), effectiveFrom: String(body.effectiveFrom), notes: String(body.notes || "") }));
    if (action === "update_structure") return Response.json(await updateSalaryStructure(request, String(body.structureId), { gross_salary: normalizePayrollNumber(body.grossSalary as string | number | null | undefined), basic_pay: normalizePayrollNumber(body.basicPay as string | number | null | undefined), hra: normalizePayrollNumber(body.hra as string | number | null | undefined), conveyance_allowance: normalizePayrollNumber(body.conveyanceAllowance as string | number | null | undefined), other_allowance: normalizePayrollNumber(body.otherAllowance as string | number | null | undefined), epf_salary: normalizePayrollNumber(body.epfSalary as string | number | null | undefined), employee_pf: normalizePayrollNumber(body.employeePf as string | number | null | undefined), employer_pf: normalizePayrollNumber(body.employerPf as string | number | null | undefined), employer_eps: normalizePayrollNumber(body.employerEps as string | number | null | undefined), effectiveFrom: String(body.effectiveFrom), notes: String(body.notes || "") }));
    if (action === "duplicate_structure") return Response.json(await duplicateSalaryStructure(request, String(body.structureId), String(body.effectiveFrom || "")));
    if (action === "delete_structure") return Response.json(await deleteSalaryStructure(request, String(body.structureId)));
    if (action === "create_recurring_adjustment") return Response.json(await createRecurringAdjustment(request, { employeeId: String(body.employeeId), adjustmentType: String(body.adjustmentType) as "earning" | "deduction", component: String(body.component) as "bonus" | "tds", amount: normalizePayrollNumber(body.amount as string | number | null | undefined), fromMonth: String(body.fromMonth), toMonth: String(body.toMonth || ""), enabled: body.enabled !== false, notes: String(body.notes || "") }));
    if (action === "update_recurring_adjustment") return Response.json(await updateRecurringAdjustment(request, String(body.adjustmentId), { employeeId: String(body.employeeId || ""), adjustmentType: String(body.adjustmentType) as "earning" | "deduction", component: String(body.component) as "bonus" | "tds", amount: normalizePayrollNumber(body.amount as string | number | null | undefined), fromMonth: String(body.fromMonth), toMonth: String(body.toMonth || ""), enabled: body.enabled !== false, notes: String(body.notes || "") }));
    if (action === "duplicate_recurring_adjustment") return Response.json(await duplicateRecurringAdjustment(request, String(body.adjustmentId), String(body.fromMonth), String(body.toMonth || "")));
    if (action === "toggle_recurring_adjustment") return Response.json(await toggleRecurringAdjustment(request, String(body.adjustmentId), Boolean(body.enabled)));
    if (action === "generate") return Response.json(await generatePayroll(request, String(body.payrollMonth), String(body.processingDate || "")));
    if (action === "reprocess") return Response.json(await reprocessPayroll(request, String(body.payrollMonth)));
    if (action === "update_entry") return Response.json(await updatePayrollEntry(request, String(body.entryId), { bonus: normalizePayrollNumber(body.bonus as string | number | null | undefined), leaveEncashment: normalizePayrollNumber(body.leaveEncashment as string | number | null | undefined), lopDeduction: normalizePayrollNumber(body.lopDeduction as string | number | null | undefined), previousMonthAdjustment: normalizePayrollNumber(body.previousMonthAdjustment as string | number | null | undefined), tds: normalizePayrollNumber(body.tds as string | number | null | undefined), notes: String(body.notes || "") }));
    if (["approve", "submit"].includes(action)) return Response.json(await transitionPayroll(request, String(body.runId), action));
    if (action === "cancel") return Response.json(await cancelPayroll(request, String(body.runId), String(body.reason || "")));
    if (action === "save_settings") return Response.json(await savePayrollSettings(request, { period_start_day: normalizePayrollNumber(body.periodStartDay as string | number | null | undefined), period_end_day: normalizePayrollNumber(body.periodEndDay as string | number | null | undefined), professional_tax_threshold: normalizePayrollNumber(body.professionalTaxThreshold as string | number | null | undefined), professional_tax_amount: normalizePayrollNumber(body.professionalTaxAmount as string | number | null | undefined), conveyance_allowance: normalizePayrollNumber(body.conveyanceAllowance as string | number | null | undefined), payslip_distribution_method: String(body.payslipDistributionMethod) as import("@/lib/payroll/types").PayslipDistributionMethod, payslip_password_protection: Boolean(body.payslipPasswordProtection), payslip_password_rule: String(body.payslipPasswordRule) as import("@/lib/payroll/types").PayslipPasswordRule, payslip_email_subject: String(body.payslipEmailSubject || ""), payslip_email_template: String(body.payslipEmailTemplate || "") }));
    if (action === "save_payroll_bank_settings") return Response.json(await savePayrollBankSettings(request, { payroll_bank_customer_id: String(body.customerId || ""), payroll_bank_account_number: String(body.bankAccountNumber || ""), payroll_bank_ifsc_code: String(body.ifscCode || ""), payroll_bank_branch_code: String(body.branchCode || ""), payroll_bank_currency: String(body.currency || "INR") }));
    return Response.json({ error: "Unsupported payroll action" }, { status: 400 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Payroll action failed";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
