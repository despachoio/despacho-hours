import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import * as XLSX from "xlsx";
import { PayrollSummaryPdfDocument } from "@/components/payroll/PayrollSummaryPdfDocument";
import { summarizePayroll } from "@/lib/payroll/exports";
import { toPayrollEntryDto } from "@/lib/payroll/entry";
import { financialYearFromValue } from "@/lib/payroll/financialYear";
import { financePayrollOnly, payrollActor } from "@/lib/payroll/server";

const labels: Record<string, string> = {
  basicPay: "Basic Pay", hra: "HRA", conveyanceAllowance: "Conveyance Allowance", otherAllowance: "Other Allowance",
  bonus: "Bonus", leaveEncashment: "Leave Encashment", grossSalary: "Gross Salary", employeePf: "Employee PF",
  employerPf: "Employer PF", employerEps: "Employer EPS", professionalTax: "Professional Tax", lop: "LOP",
  previousMonthAdjustment: "Previous Month Adjustment", tds: "TDS", netSalary: "Net Salary",
  employeesProcessed: "Employees Processed", grossPayroll: "Gross Payroll", netPayroll: "Net Payroll",
};

export async function GET(request: Request) {
  try {
    const actor = await payrollActor(request);
    financePayrollOnly(actor.role);
    const params = new URL(request.url).searchParams;
    const financialYearValue = params.get("financialYear") || "";
    const financialYear = financialYearFromValue(financialYearValue);
    const fromMonth = params.get("fromMonth") || "";
    const toMonth = params.get("toMonth") || "";
    const format = params.get("format") === "xlsx" ? "xlsx" : "pdf";
    if (!financialYear || !financialYear.months.includes(fromMonth) || !financialYear.months.includes(toMonth) || fromMonth > toMonth) return Response.json({ error: "A valid financial-year month range is required" }, { status: 400 });
    const result = await actor.admin.from("payroll_entries").select("*").in("status", ["approved", "locked", "published"]).gte("payroll_month", `${fromMonth}-01`).lte("payroll_month", `${toMonth}-28`).order("payroll_month");
    if (result.error) throw new Error(result.error.message);
    const entries = (result.data || []).map(toPayrollEntryDto);
    if (!entries.length) return Response.json({ error: "No approved payroll is available for this period" }, { status: 404 });
    const summary = summarizePayroll(entries);
    const filename = `Payroll_Summary_FY_${financialYear.value}_${fromMonth}_to_${toMonth}`;
    if (format === "xlsx") {
      const rows = Object.entries(summary).map(([key, value]) => ({ "Payroll Component": labels[key] || key, Total: value }));
      const sheet = XLSX.utils.json_to_sheet(rows);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Payroll Summary");
      const output = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
      return new Response(new Uint8Array(output), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename}.xlsx"`, "Cache-Control": "private, no-store" } });
    }
    const document = createElement(PayrollSummaryPdfDocument, { summary, financialYear: financialYear.label, fromMonth, toMonth }) as ReactElement<DocumentProps>;
    const pdf = await renderToBuffer(document);
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to generate payroll summary";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 403 });
  }
}
