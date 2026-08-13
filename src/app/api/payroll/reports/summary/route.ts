import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import * as XLSX from "xlsx";
import { PayrollSummaryPdfDocument } from "@/components/payroll/PayrollSummaryPdfDocument";
import {
  summarizePayroll,
  summarizePayrollByMonth,
  type PayrollSummary,
} from "@/lib/payroll/exports";
import { toPayrollEntryDto } from "@/lib/payroll/entry";
import { financialYearFromValue } from "@/lib/payroll/financialYear";
import { payrollMonthLabel } from "@/lib/payroll/filenames";
import { financePayrollOnly, payrollActor } from "@/lib/payroll/server";

const labels: Record<string, string> = {
  basicPay: "Basic Pay", hra: "HRA", conveyanceAllowance: "Conveyance Allowance", otherAllowance: "Other Allowance",
  bonus: "Bonus", leaveEncashment: "Leave Encashment", grossSalary: "Gross Pay", employeePf: "Employee PF",
  employerPf: "Employer PF", employerEps: "Employer EPS", administrationCharges: "Administration Charges", edliCharges: "EDLI Charges", totalPf: "Total PF Amount", professionalTax: "Professional Tax", lop: "LOP",
  previousMonthAdjustment: "Previous Month Adjustment", tds: "TDS", netSalary: "Net Salary",
  employeesProcessed: "Employees Processed", grossPayroll: "Gross Payroll", netPayroll: "Net Payroll",
};

const summaryRows: Array<{
  key: keyof PayrollSummary;
  label: string;
}> = [
  { key: "employeesProcessed", label: "Employees Processed" },
  { key: "basicPay", label: "Basic Pay" },
  { key: "hra", label: "HRA" },
  { key: "conveyanceAllowance", label: "Conveyance Allowance" },
  { key: "otherAllowance", label: "Other Allowance" },
  { key: "bonus", label: "Bonus" },
  { key: "leaveEncashment", label: "Leave Encashment" },
  { key: "grossSalary", label: "Gross Pay" },
  { key: "employeePf", label: "Employee PF" },
  { key: "employerPf", label: "Employer PF" },
  { key: "employerEps", label: "Employer EPS" },
  { key: "administrationCharges", label: "Administration Charges" },
  { key: "edliCharges", label: "EDLI Charges" },
  { key: "totalPf", label: "Total PF Amount" },
  { key: "professionalTax", label: "Professional Tax" },
  { key: "lop", label: "LOP" },
  { key: "previousMonthAdjustment", label: "Previous Month Adjustment" },
  { key: "tds", label: "TDS" },
  { key: "netSalary", label: "Net Salary" },
];

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
    const reportMonths = financialYear.months.filter(
      (month) => month >= fromMonth && month <= toMonth,
    );
    const monthlySummaries = summarizePayrollByMonth(entries, reportMonths);
    const summary = summarizePayroll(entries);
    const filename = `Payroll_Summary_FY_${financialYear.value}_${fromMonth}_to_${toMonth}`;
    if (format === "xlsx") {
      const rows = summaryRows.map(({ key, label }) => ({
        "Payroll Component": labels[key] || label,
        ...Object.fromEntries(
          monthlySummaries.map(({ payrollMonth, summary: monthSummary }) => [
            payrollMonthLabel(payrollMonth),
            monthSummary[key],
          ]),
        ),
        "Grand Total": summary[key],
      }));
      const sheet = XLSX.utils.json_to_sheet(rows);
      sheet["!cols"] = [
        { wch: 30 },
        ...monthlySummaries.map(() => ({ wch: 15 })),
        { wch: 16 },
      ];
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Payroll Summary");
      const output = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
      return new Response(new Uint8Array(output), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename}.xlsx"`, "Cache-Control": "private, no-store" } });
    }
    const document = createElement(PayrollSummaryPdfDocument, { summary, monthlySummaries, financialYear: financialYear.label, fromMonth, toMonth }) as ReactElement<DocumentProps>;
    const pdf = await renderToBuffer(document);
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to generate payroll summary";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 403 });
  }
}
