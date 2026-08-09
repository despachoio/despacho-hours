import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { YtdPayrollPdfDocument } from "@/components/payroll/YtdPayrollPdfDocument";
import { financialYearFromValue } from "@/lib/payroll/financialYear";
import { payrollActor } from "@/lib/payroll/server";
import { loadCompanyLogo, loadCompanySettings } from "@/lib/settings/companySettings";
import { ytdFilename } from "@/lib/payroll/filenames";
import { toPayrollEntryDto } from "@/lib/payroll/entry";
import { isAdminLevelRole } from "@/lib/roles";

function removeSalutation(name: string) {
  return name.replace(/^(?:mr|mrs|ms|miss|dr)\.?\s+/i, "").trim();
}

export async function GET(request: Request) {
  try {
    const actor = await payrollActor(request);
    const searchParams = new URL(request.url).searchParams;
    const financialYearValue = searchParams.get("financialYear") || "";
    const financialYear = financialYearFromValue(financialYearValue);
    if (!financialYear) return Response.json({ error: "A valid financial year is required" }, { status: 400 });
    const requestedEmployeeId = searchParams.get("employeeId") || actor.employeeId;
    if (requestedEmployeeId !== actor.employeeId && !isAdminLevelRole(actor.role)) return Response.json({ error: "Forbidden" }, { status: 403 });
    const fromMonth = searchParams.get("fromMonth") || financialYear.months[0];
    const toMonth = searchParams.get("toMonth") || financialYear.months.at(-1)!;
    const includedMonths = financialYear.months.filter((month) => month >= fromMonth && month <= toMonth);
    if (!includedMonths.length || fromMonth > toMonth) return Response.json({ error: "A valid payroll month range is required" }, { status: 400 });
    const [result, company, employeeResult, financeResult, statutoryResult] = await Promise.all([
      actor.admin
        .from("payroll_entries")
        .select("*")
        .eq("employee_id", requestedEmployeeId)
        .eq("status", "published")
        .not("published_at", "is", null)
        .gte("payroll_month", `${includedMonths[0]}-01`)
        .lte("payroll_month", `${includedMonths.at(-1)}-01`)
        .order("payroll_month", { ascending: true }),
      loadCompanySettings(actor.admin),
      actor.admin.from("employees").select("name,role,date_of_joining").eq("id", requestedEmployeeId).maybeSingle(),
      actor.admin.from("employee_finance_details").select("bank_name,bank_account_number,epf_number").eq("employee_id", requestedEmployeeId).maybeSingle(),
      actor.admin.from("employee_statutory_details").select("pan_number").eq("employee_id", requestedEmployeeId).maybeSingle(),
    ]);
    if (result.error) throw new Error(result.error.message);
    const entries = (result.data || []).map(toPayrollEntryDto);
    if (!entries.length) return Response.json({ error: `No published payroll is available for ${financialYear.label}` }, { status: 404 });
    const logo = await loadCompanyLogo({ ...company, invoice_logo_url: "/despacho-logo-full.png" });
    const employee = {
      employeeName: removeSalutation(employeeResult.data?.name || entries[0].employee_name),
      designation: employeeResult.data?.role || null,
      dateOfJoining: employeeResult.data?.date_of_joining || null,
      bankName: financeResult.data?.bank_name || null,
      bankAccountNumber: financeResult.data?.bank_account_number || null,
      pfNumber: financeResult.data?.epf_number || null,
      panNumber: statutoryResult.data?.pan_number || null,
    };
    const document = createElement(YtdPayrollPdfDocument, { entries, financialYear: financialYear.value, includedMonths, logoSrc: logo.dataUrl, employee }) as ReactElement<DocumentProps>;
    const pdf = await renderToBuffer(document);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${ytdFilename(entries[0].employee_code, financialYear.value)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to generate YTD payroll report";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
