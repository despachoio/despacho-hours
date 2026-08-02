import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { PayslipPdfDocument } from "@/components/payroll/PayslipPdfDocument";
import { payrollActor } from "@/lib/payroll/server";
import type { PayrollEntry } from "@/lib/payroll/types";
import { loadCompanyLogo, loadCompanySettings } from "@/lib/settings/companySettings";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await payrollActor(request);
    const { id } = await context.params;
    const result = await actor.admin.from("payroll_entries").select("*").eq("id", id).single();
    if (result.error || !result.data) return Response.json({ error: "Payslip not found" }, { status: 404 });
    const entry = result.data as PayrollEntry;
    const finance = actor.role === "finance admin";
    if (!finance && (entry.employee_id !== actor.employeeId || entry.status !== "published" || !entry.published_at)) return Response.json({ error: "Forbidden" }, { status: 403 });
    const company = await loadCompanySettings(actor.admin);
    const logo = await loadCompanyLogo(company, false);
    const document = createElement(PayslipPdfDocument, { entry, logoSrc: logo.dataUrl, companyName: company.company_name }) as ReactElement<DocumentProps>;
    const pdf = await renderToBuffer(document);
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="Payslip-${entry.employee_code}-${entry.payroll_month.slice(0, 7)}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : "Unable to generate payslip" }, { status: 401 });
  }
}
