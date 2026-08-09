import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { PayslipPdfDocument } from "@/components/payroll/PayslipPdfDocument";
import { payrollActor } from "@/lib/payroll/server";
import { loadCompanyLogo, loadCompanySettings } from "@/lib/settings/companySettings";
import { payslipFilename } from "@/lib/payroll/filenames";
import { toPayrollEntryDto } from "@/lib/payroll/entry";
import { isAdminLevelRole } from "@/lib/roles";

function inclusiveDayCount(start: string, end: string) {
  const startTime = new Date(`${start}T00:00:00Z`).getTime();
  const endTime = new Date(`${end}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((endTime - startTime) / 86_400_000) + 1);
}

function removeSalutation(name: string) {
  return name.replace(/^(?:mr|mrs|ms|miss|dr)\.?\s+/i, "").trim();
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await payrollActor(request);
    const { id } = await context.params;
    const result = await actor.admin.from("payroll_entries").select("*").eq("id", id).single();
    if (result.error || !result.data) return Response.json({ error: "Payslip not found" }, { status: 404 });
    const entry = toPayrollEntryDto(result.data);
    const payrollAdmin = isAdminLevelRole(actor.role);
    if (!payrollAdmin && (entry.employee_id !== actor.employeeId || entry.status !== "published" || !entry.published_at)) return Response.json({ error: "Forbidden" }, { status: 403 });
    const [company, employeeResult, financeResult, statutoryResult] = await Promise.all([
      loadCompanySettings(actor.admin),
      actor.admin.from("employees").select("name,role,date_of_joining").eq("id", entry.employee_id).maybeSingle(),
      actor.admin.from("employee_finance_details").select("bank_name,bank_account_number,epf_number,uan_number").eq("employee_id", entry.employee_id).maybeSingle(),
      actor.admin.from("employee_statutory_details").select("pan_number").eq("employee_id", entry.employee_id).maybeSingle(),
    ]);
    const logo = await loadCompanyLogo({
      ...company,
      invoice_logo_url: "/despacho-logo-full.png",
    });
    const periodDays = inclusiveDayCount(entry.period_start, entry.period_end);
    const employee = {
      employeeName: employeeResult.data?.name || removeSalutation(entry.employee_name),
      designation: employeeResult.data?.role || null,
      effectiveWorkingDays: Math.max(periodDays - Number(entry.lop_days || 0), 0),
      dateOfJoining: employeeResult.data?.date_of_joining || null,
      bankName: financeResult.data?.bank_name || null,
      bankAccountNumber: financeResult.data?.bank_account_number || null,
      pfNumber: financeResult.data?.epf_number || null,
      uan: financeResult.data?.uan_number || null,
      panNumber: statutoryResult.data?.pan_number || null,
    };
    const document = createElement(PayslipPdfDocument, { entry, employee, logoSrc: logo.dataUrl, companyName: company.company_name }) as ReactElement<DocumentProps>;
    const pdf = await renderToBuffer(document);
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${payslipFilename(entry.employee_code, entry.payroll_month)}"`, "Cache-Control": "private, no-store" } });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : "Unable to generate payslip" }, { status: 401 });
  }
}
