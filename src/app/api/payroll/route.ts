import { cancelPayroll, generatePayroll, loadPayroll, reprocessPayroll, savePayrollSettings, saveSalaryStructure, transitionPayroll, updatePayrollEntry } from "@/lib/payroll/server";
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
    if (action === "save_structure") return Response.json(await saveSalaryStructure(request, { employeeId: String(body.employeeId), grossSalary: normalizePayrollNumber(body.grossSalary as string | number | null | undefined), effectiveFrom: String(body.effectiveFrom), notes: String(body.notes || "") }));
    if (action === "generate") return Response.json(await generatePayroll(request, String(body.payrollMonth)));
    if (action === "reprocess") return Response.json(await reprocessPayroll(request, String(body.payrollMonth)));
    if (action === "update_entry") return Response.json(await updatePayrollEntry(request, String(body.entryId), { bonus: normalizePayrollNumber(body.bonus as string | number | null | undefined), leaveEncashment: normalizePayrollNumber(body.leaveEncashment as string | number | null | undefined), lopDeduction: normalizePayrollNumber(body.lopDeduction as string | number | null | undefined), previousMonthAdjustment: normalizePayrollNumber(body.previousMonthAdjustment as string | number | null | undefined), tds: normalizePayrollNumber(body.tds as string | number | null | undefined), notes: String(body.notes || "") }));
    if (["approve", "submit"].includes(action)) return Response.json(await transitionPayroll(request, String(body.runId), action));
    if (action === "cancel") return Response.json(await cancelPayroll(request, String(body.runId), String(body.reason || "")));
    if (action === "save_settings") return Response.json(await savePayrollSettings(request, { period_start_day: normalizePayrollNumber(body.periodStartDay as string | number | null | undefined), period_end_day: normalizePayrollNumber(body.periodEndDay as string | number | null | undefined), professional_tax_threshold: normalizePayrollNumber(body.professionalTaxThreshold as string | number | null | undefined), professional_tax_amount: normalizePayrollNumber(body.professionalTaxAmount as string | number | null | undefined), conveyance_allowance: normalizePayrollNumber(body.conveyanceAllowance as string | number | null | undefined) }));
    return Response.json({ error: "Unsupported payroll action" }, { status: 400 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Payroll action failed";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
