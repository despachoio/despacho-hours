import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { utils, write } from "xlsx";
import { GratuityRegisterPdfDocument } from "@/components/payroll/GratuityRegisterPdfDocument";
import { businessDateKey } from "@/lib/metrics/date-ranges";
import { filterGratuityRegister, loadGratuityRegister } from "@/lib/payroll/gratuityRegister";
import { financePayrollOnly, payrollActor } from "@/lib/payroll/server";
import { loadCompanyLogo, loadCompanySettings } from "@/lib/settings/companySettings";

function validDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function tenure(years: number, months: number) {
  return `${years} year${years === 1 ? "" : "s"} ${months} month${months === 1 ? "" : "s"}`;
}

export async function GET(request: Request) {
  try {
    const actor = await payrollActor(request);
    financePayrollOnly(actor.role);
    const params = new URL(request.url).searchParams;
    const format = params.get("format") === "xlsx" ? "xlsx" : "pdf";
    const asOfDate = params.get("asOfDate") || businessDateKey();
    if (!validDate(asOfDate)) return Response.json({ error: "A valid as-of date is required" }, { status: 400 });
    const filters = {
      search: String(params.get("search") || "").slice(0, 100),
      status: String(params.get("status") || "all"),
      eligibility: String(params.get("eligibility") || "all"),
    };
    if (!["all", "active", "inactive", "archived"].includes(filters.status)) throw new Error("Invalid employee-status filter");
    if (!["all", "eligible", "not_eligible", "unavailable"].includes(filters.eligibility)) throw new Error("Invalid eligibility filter");
    const rows = filterGratuityRegister(await loadGratuityRegister(actor.admin, asOfDate), filters);
    if (!rows.length) return Response.json({ error: "No gratuity records match the selected filters" }, { status: 404 });
    const filename = `Gratuity_Liability_Register_${asOfDate}.${format}`;

    let bytes: Buffer;
    let contentType: string;
    if (format === "xlsx") {
      const worksheet = utils.aoa_to_sheet([
        ["Employee Code", "Employee Name", "Status", "Date of Joining", "Completed Tenure", "Counted Service Years", "Basic Salary", "Eligibility", "Eligibility Date", "Estimated Gratuity", "Currently Payable Estimate"],
        ...rows.map((row) => [row.employeeCode, row.employeeName, row.employeeStatus, row.dateOfJoining || "", tenure(row.completedYears, row.remainingMonths), row.countedServiceYears, row.available ? row.basicSalary : "", !row.coveredEmployment ? "Not applicable" : !row.available ? "Unavailable" : row.eligible ? "Eligible" : "Not yet eligible", row.eligibilityDate || "", row.available && row.coveredEmployment ? row.estimatedGratuity : "", row.currentlyPayableEstimate]),
      ]);
      worksheet["!cols"] = [15, 28, 14, 16, 22, 22, 16, 20, 16, 20, 26].map((wch) => ({ wch }));
      const workbook = utils.book_new();
      utils.book_append_sheet(workbook, worksheet, "Gratuity Register");
      bytes = Buffer.from(write(workbook, { type: "buffer", bookType: "xlsx" }));
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else {
      const company = await loadCompanySettings(actor.admin);
      const logo = await loadCompanyLogo({ ...company, invoice_logo_url: "/despacho-logo-full.png" });
      const document = createElement(GratuityRegisterPdfDocument, { rows, logoSrc: logo.dataUrl, asOfDate, filters }) as ReactElement<DocumentProps>;
      bytes = await renderToBuffer(document);
      contentType = "application/pdf";
    }
    const audit = await actor.admin.from("payroll_audit_log").insert({ action: "gratuity_register_downloaded", actor_user_id: actor.userId, actor_role: actor.role, new_value: { format, asOfDate, filters, rowCount: rows.length } });
    if (audit.error) throw new Error(audit.error.message);
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": contentType, "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" } });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to generate gratuity register";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
