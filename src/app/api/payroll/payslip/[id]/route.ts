import { payrollActor } from "@/lib/payroll/server";
import { payslipFilename } from "@/lib/payroll/filenames";
import { toPayrollEntryDto } from "@/lib/payroll/entry";
import { isAdminLevelRole } from "@/lib/roles";
import { generatePayslipPdf } from "@/lib/payroll/payslipPdf";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await payrollActor(request);
    const { id } = await context.params;
    const result = await actor.admin.from("payroll_entries").select("*").eq("id", id).single();
    if (result.error || !result.data) return Response.json({ error: "Payslip not found" }, { status: 404 });
    const entry = toPayrollEntryDto(result.data);
    const payrollAdmin = isAdminLevelRole(actor.role);
    if (!payrollAdmin && (entry.employee_id !== actor.employeeId || entry.status !== "published" || !entry.published_at)) return Response.json({ error: "Forbidden" }, { status: 403 });
    const { pdf } = await generatePayslipPdf(actor.admin, entry);
    const now = new Date().toISOString();
    await actor.admin.from("payslip_distributions").update({ last_download_at: now, downloaded_at: now, updated_at: now }).eq("payroll_entry_id", entry.id);
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${payslipFilename(entry.employee_code, entry.payroll_month)}"`, "Cache-Control": "private, no-store" } });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : "Unable to generate payslip" }, { status: 401 });
  }
}
