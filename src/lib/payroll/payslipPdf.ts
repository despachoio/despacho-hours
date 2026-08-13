import { randomUUID } from "node:crypto";
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt-lite";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PayslipPdfDocument, type PayslipEmployeeDetails } from "@/components/payroll/PayslipPdfDocument";
import { loadCompanyLogo, loadCompanySettings } from "@/lib/settings/companySettings";
import type { PayrollEntry } from "./types";

function inclusiveDayCount(start: string, end: string) {
  return Math.max(0, Math.round((new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000) + 1);
}

export async function generatePayslipPdf(admin: SupabaseClient, entry: PayrollEntry) {
  const [company, employeeResult, financeResult, statutoryResult] = await Promise.all([
    loadCompanySettings(admin),
    admin.from("employees").select("name,role,date_of_joining").eq("id", entry.employee_id).maybeSingle(),
    admin.from("employee_finance_details").select("bank_name,bank_account_number,epf_number,uan_number").eq("employee_id", entry.employee_id).maybeSingle(),
    admin.from("employee_statutory_details").select("pan_number").eq("employee_id", entry.employee_id).maybeSingle(),
  ]);
  for (const result of [employeeResult, financeResult, statutoryResult]) if (result.error) throw new Error(result.error.message);
  const logo = await loadCompanyLogo({ ...company, invoice_logo_url: "/despacho-logo-full.png" });
  const employee: PayslipEmployeeDetails = {
    employeeName: employeeResult.data?.name || entry.employee_name,
    designation: employeeResult.data?.role || null,
    effectiveWorkingDays: Math.max(inclusiveDayCount(entry.period_start, entry.period_end) - Number(entry.lop_days || 0), 0),
    dateOfJoining: employeeResult.data?.date_of_joining || null,
    bankName: financeResult.data?.bank_name || null,
    bankAccountNumber: financeResult.data?.bank_account_number || null,
    pfNumber: financeResult.data?.epf_number || null,
    uan: financeResult.data?.uan_number || null,
    panNumber: statutoryResult.data?.pan_number || null,
  };
  const document = createElement(PayslipPdfDocument, { entry, employee, logoSrc: logo.dataUrl, companyName: company.company_name }) as ReactElement<DocumentProps>;
  return { pdf: await renderToBuffer(document), company, logo, employee };
}

export async function protectPayslipPdf(pdf: Buffer, password: string) {
  const protectedBytes = await encryptPDF(new Uint8Array(pdf), password, {
    ownerPassword: randomUUID(), allowModifying: false, allowCopying: false,
    allowAnnotating: false, allowAssembly: false,
  });
  return Buffer.from(protectedBytes);
}
