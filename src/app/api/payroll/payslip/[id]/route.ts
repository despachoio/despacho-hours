import { payrollActor } from "@/lib/payroll/server";
import { payslipFilename } from "@/lib/payroll/filenames";
import { toPayrollEntryDto } from "@/lib/payroll/entry";
import { isFinanceAdminRole } from "@/lib/roles";
import { generatePayslipPdf } from "@/lib/payroll/payslipPdf";
import { protectEmployeePdf } from "@/lib/pdf/employeePdfSecurity";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await payrollActor(request);
    const { id } = await context.params;
    const result = await actor.admin.from("payroll_entries").select("*").eq("id", id).single();
    if (result.error || !result.data) return Response.json({ error: "Payslip not found" }, { status: 404 });
    const entry = toPayrollEntryDto(result.data);
    const payrollAdmin = isFinanceAdminRole(actor.role);
    if (!payrollAdmin && (entry.employee_id !== actor.employeeId || entry.status !== "published" || !entry.published_at)) return Response.json({ error: "Forbidden" }, { status: 403 });
    const employee = await actor.admin.from("employees").select("date_of_birth").eq("id", entry.employee_id).single();
    if (employee.error) throw new Error(employee.error.message);
    const { pdf: generatedPdf } = await generatePayslipPdf(actor.admin, entry);
    const pdf = await protectEmployeePdf({ admin: actor.admin, pdfBytes: generatedPdf, employee: { employeeCode: entry.employee_code, employeeName: entry.employee_name, dateOfBirth: employee.data.date_of_birth }, documentType: "payslip" });
    const now = new Date().toISOString();
    await actor.admin.from("payslip_distributions").update({ last_download_at: now, downloaded_at: now, updated_at: now }).eq("payroll_entry_id", entry.id);
    const audit = await actor.admin.from("payroll_audit_log").insert({ payroll_run_id: entry.payroll_run_id, payroll_entry_id: entry.id, action: "payslip_downloaded", actor_user_id: actor.userId, actor_role: actor.role, new_value: { documentType: "payslip", payrollMonth: entry.payroll_month } });
    if (audit.error) throw new Error(audit.error.message);
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${payslipFilename(entry.employee_code, entry.payroll_month)}"`, "Cache-Control": "private, no-store" } });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : "Unable to generate payslip" }, { status: 401 });
  }
}
