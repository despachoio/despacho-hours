import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { YtdPayrollPdfDocument } from "@/components/payroll/YtdPayrollPdfDocument";
import { financialYearFromValue } from "@/lib/payroll/financialYear";
import { payrollActor } from "@/lib/payroll/server";
import type { PayrollEntry } from "@/lib/payroll/types";
import { loadCompanyLogo, loadCompanySettings } from "@/lib/settings/companySettings";

function removeSalutation(name: string) {
  return name.replace(/^(?:mr|mrs|ms|miss|dr)\.?\s+/i, "").trim();
}

export async function GET(request: Request) {
  try {
    const actor = await payrollActor(request);
    const financialYearValue = new URL(request.url).searchParams.get("financialYear") || "";
    const financialYear = financialYearFromValue(financialYearValue);
    if (!financialYear) return Response.json({ error: "A valid financial year is required" }, { status: 400 });
    const [result, company, employeeResult, financeResult, statutoryResult] = await Promise.all([
      actor.admin
        .from("payroll_entries")
        .select("*")
        .eq("employee_id", actor.employeeId)
        .eq("status", "published")
        .not("published_at", "is", null)
        .gte("payroll_month", financialYear.startDate)
        .lte("payroll_month", financialYear.endDate)
        .order("payroll_month", { ascending: true }),
      loadCompanySettings(actor.admin),
      actor.admin.from("employees").select("name,role,date_of_joining").eq("id", actor.employeeId).maybeSingle(),
      actor.admin.from("employee_finance_details").select("bank_name,bank_account_number,epf_number,uan_number").eq("employee_id", actor.employeeId).maybeSingle(),
      actor.admin.from("employee_statutory_details").select("pan_number").eq("employee_id", actor.employeeId).maybeSingle(),
    ]);
    if (result.error) throw new Error(result.error.message);
    const entries = (result.data || []) as PayrollEntry[];
    if (!entries.length) return Response.json({ error: `No published payroll is available for ${financialYear.label}` }, { status: 404 });
    const logo = await loadCompanyLogo({ ...company, invoice_logo_url: "/despacho-logo-full.png" });
    const employee = {
      employeeName: removeSalutation(employeeResult.data?.name || entries[0].employee_name),
      designation: employeeResult.data?.role || null,
      dateOfJoining: employeeResult.data?.date_of_joining || null,
      bankName: financeResult.data?.bank_name || null,
      bankAccountNumber: financeResult.data?.bank_account_number || null,
      pfNumber: financeResult.data?.epf_number || null,
      uan: financeResult.data?.uan_number || null,
      panNumber: statutoryResult.data?.pan_number || null,
    };
    const document = createElement(YtdPayrollPdfDocument, { entries, financialYear: financialYear.value, logoSrc: logo.dataUrl, employee }) as ReactElement<DocumentProps>;
    const pdf = await renderToBuffer(document);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="YTD-${entries[0].employee_code}-${financialYear.value}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to generate YTD payroll report";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
