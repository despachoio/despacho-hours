import { financialYearFromValue } from "@/lib/payroll/financialYear";
import { financePayrollOnly, payrollActor } from "@/lib/payroll/server";

const BUCKET = "payroll-form16";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function validDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function POST(request: Request) {
  try {
    const actor = await payrollActor(request);
    financePayrollOnly(actor.role);
    const form = await request.formData();
    const employeeId = String(form.get("employeeId") || "");
    const financialYear = String(form.get("financialYear") || "");
    const issuedOn = String(form.get("issuedOn") || "");
    const file = form.get("file");
    if (!employeeId) throw new Error("Select an employee");
    if (!financialYearFromValue(financialYear)) throw new Error("Select a valid financial year");
    if (!validDate(issuedOn)) throw new Error("Select a valid issue date");
    if (!(file instanceof File)) throw new Error("Select the Form 16 PDF");
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) throw new Error("Form 16 must be a PDF smaller than 10 MB");

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("The selected file is not a valid PDF");
    const employee = await actor.admin.from("employees").select("id,employee_code,name").eq("id", employeeId).maybeSingle();
    if (employee.error || !employee.data) throw new Error("Employee could not be found");

    const storagePath = `${employeeId}/${financialYear}/form-16.pdf`;
    const upload = await actor.admin.storage.from(BUCKET).upload(storagePath, bytes, { contentType: "application/pdf", upsert: true });
    if (upload.error) throw new Error(upload.error.message);
    const now = new Date().toISOString();
    const saved = await actor.admin.from("payroll_form16_documents").upsert({
      employee_id: employeeId,
      financial_year: financialYear,
      storage_path: storagePath,
      file_name: file.name || "Form 16.pdf",
      file_size_bytes: file.size,
      issued_on: issuedOn,
      uploaded_by: actor.userId,
      uploaded_at: now,
      updated_at: now,
    }, { onConflict: "employee_id,financial_year" }).select("id,employee_id,financial_year,storage_path,file_name,file_size_bytes,issued_on,uploaded_at").single();
    if (saved.error) throw new Error(saved.error.message);
    const audit = await actor.admin.from("payroll_audit_log").insert({
      action: "form16_uploaded",
      actor_user_id: actor.userId,
      actor_role: actor.role,
      new_value: { employeeId, financialYear, issuedOn, documentId: saved.data.id },
    });
    if (audit.error) throw new Error(audit.error.message);
    return Response.json(saved.data);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to upload Form 16";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
