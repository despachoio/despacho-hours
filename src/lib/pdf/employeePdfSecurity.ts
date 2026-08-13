import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveEmployeePdfPassword, type EmployeePdfIdentity, type EmployeePdfPasswordRule } from "./employeePdfPassword";
import { encryptEmployeePdf } from "./passwordProtection";

export type EmployeePdfDocumentType = "payslip" | "ytd" | "performance";

export type EmployeePdfSecuritySettings = {
  payslip_password_protection: boolean;
  ytd_password_protection: boolean;
  performance_password_protection: boolean;
  payslip_password_rule: EmployeePdfPasswordRule;
};

const protectionField: Record<EmployeePdfDocumentType, keyof EmployeePdfSecuritySettings> = {
  payslip: "payslip_password_protection",
  ytd: "ytd_password_protection",
  performance: "performance_password_protection",
};

export async function loadEmployeePdfSecuritySettings(admin: SupabaseClient) {
  const result = await admin
    .from("payroll_settings")
    .select("payslip_password_protection,ytd_password_protection,performance_password_protection,payslip_password_rule")
    .eq("singleton_key", true)
    .single();
  if (result.error || !result.data) throw new Error("PDF Security settings could not be loaded. No sensitive PDF was generated.");
  return result.data as EmployeePdfSecuritySettings;
}

export async function protectEmployeePdf({
  admin,
  pdfBytes,
  employee,
  documentType,
  settings,
}: {
  admin: SupabaseClient;
  pdfBytes: Buffer | Uint8Array;
  employee: EmployeePdfIdentity;
  documentType: EmployeePdfDocumentType;
  settings?: EmployeePdfSecuritySettings;
}) {
  const security = settings || await loadEmployeePdfSecuritySettings(admin);
  if (!security[protectionField[documentType]]) return Buffer.from(pdfBytes);
  const password = deriveEmployeePdfPassword({ ...employee, rule: security.payslip_password_rule });
  return encryptEmployeePdf(pdfBytes, password);
}
