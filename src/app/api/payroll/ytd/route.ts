import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { YtdPayrollPdfDocument } from "@/components/payroll/YtdPayrollPdfDocument";
import { payrollActor } from "@/lib/payroll/server";
import type { PayrollEntry } from "@/lib/payroll/types";
import { loadCompanyLogo, loadCompanySettings } from "@/lib/settings/companySettings";

const validYear = (value: string) => /^\d{4}$/.test(value) && Number(value) >= 2000 && Number(value) <= 2100;

export async function GET(request: Request) {
  try {
    const actor = await payrollActor(request);
    const year = new URL(request.url).searchParams.get("year") || "";
    if (!validYear(year)) return Response.json({ error: "A valid payroll year is required" }, { status: 400 });
    const result = await actor.admin
      .from("payroll_entries")
      .select("*")
      .eq("employee_id", actor.employeeId)
      .eq("status", "published")
      .not("published_at", "is", null)
      .gte("payroll_month", `${year}-01-01`)
      .lte("payroll_month", `${year}-12-31`)
      .order("payroll_month", { ascending: true });
    if (result.error) throw new Error(result.error.message);
    const entries = (result.data || []) as PayrollEntry[];
    if (!entries.length) return Response.json({ error: `No published payroll is available for ${year}` }, { status: 404 });
    const company = await loadCompanySettings(actor.admin);
    const logo = await loadCompanyLogo({ ...company, invoice_logo_url: "/despacho-logo-full.png" });
    const document = createElement(YtdPayrollPdfDocument, { entries, year, logoSrc: logo.dataUrl, companyName: company.company_name }) as ReactElement<DocumentProps>;
    const pdf = await renderToBuffer(document);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="YTD-${entries[0].employee_code}-${year}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unable to generate YTD payroll report";
    return Response.json({ error: message }, { status: message === "Unauthorized" ? 401 : 400 });
  }
}
