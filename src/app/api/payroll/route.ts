import { generatePayroll, loadPayroll, savePayrollSettings, saveSalaryStructure, transitionPayroll, updatePayrollEntry } from "@/lib/payroll/server";

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
    if (action === "save_structure") return Response.json(await saveSalaryStructure(request, { employeeId: String(body.employeeId), grossSalary: Number(body.grossSalary), effectiveFrom: String(body.effectiveFrom), notes: String(body.notes || "") }));
    if (action === "generate") return Response.json(await generatePayroll(request, String(body.payrollMonth)));
    if (action === "update_entry") return Response.json(await updatePayrollEntry(request, String(body.entryId), { bonus: Number(body.bonus || 0), leaveEncashment: Number(body.leaveEncashment || 0), reimbursements: Number(body.reimbursements || 0), lopDeduction: Number(body.lopDeduction || 0), previousMonthAdjustment: Number(body.previousMonthAdjustment || 0), tds: Number(body.tds || 0), notes: String(body.notes || "") }));
    if (["review", "approve", "lock", "publish", "cancel"].includes(action)) return Response.json(await transitionPayroll(request, String(body.runId), action, String(body.reason || "")));
    if (action === "save_settings") return Response.json(await savePayrollSettings(request, { period_start_day: Number(body.periodStartDay), period_end_day: Number(body.periodEndDay), professional_tax_threshold: Number(body.professionalTaxThreshold), professional_tax_amount: Number(body.professionalTaxAmount), conveyance_allowance: Number(body.conveyanceAllowance) }));
    return Response.json({ error: "Unsupported payroll action" }, { status: 400 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Payroll action failed";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
