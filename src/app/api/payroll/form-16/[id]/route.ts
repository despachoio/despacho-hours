import { form16Filename } from "@/lib/payroll/filenames";
import { payrollActor } from "@/lib/payroll/server";
import { isFinanceAdminRole } from "@/lib/roles";

const BUCKET = "payroll-form16";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await payrollActor(request);
    const { id } = await context.params;
    const document = await actor.admin.from("payroll_form16_documents").select("id,employee_id,financial_year,storage_path,employees(employee_code)").eq("id", id).maybeSingle();
    if (document.error || !document.data) return Response.json({ error: "Form 16 not found" }, { status: 404 });
    if (document.data.employee_id !== actor.employeeId && !isFinanceAdminRole(actor.role)) return Response.json({ error: "Forbidden" }, { status: 403 });
    const stored = await actor.admin.storage.from(BUCKET).download(document.data.storage_path);
    if (stored.error) throw new Error(stored.error.message);
    const audit = await actor.admin.from("payroll_audit_log").insert({
      action: "form16_downloaded",
      actor_user_id: actor.userId,
      actor_role: actor.role,
      new_value: { employeeId: document.data.employee_id, financialYear: document.data.financial_year, documentId: document.data.id },
    });
    if (audit.error) throw new Error(audit.error.message);
    const employee = Array.isArray(document.data.employees) ? document.data.employees[0] : document.data.employees;
    const filename = form16Filename(employee?.employee_code || "Employee", document.data.financial_year);
    return new Response(await stored.data.arrayBuffer(), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to download Form 16";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
