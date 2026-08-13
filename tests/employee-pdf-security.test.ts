import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { deriveEmployeePdfPassword } from "../src/lib/pdf/employeePdfPassword";

vi.mock("server-only", () => ({}));

const source = (path: string) => readFileSync(path, "utf8");

describe("shared employee PDF security", () => {
  const migration = source("supabase/migrations/202608130003_employee_pdf_security.sql");
  const security = source("src/lib/pdf/employeePdfSecurity.ts");

  it("enables every sensitive employee PDF type by default", () => {
    expect(migration).toContain("ytd_password_protection boolean not null default true");
    expect(migration).toContain("performance_password_protection boolean not null default true");
    expect(source("supabase/migrations/202608130001_payslip_distribution.sql")).toContain("payslip_password_protection boolean not null default true");
  });

  it("derives Employee Code plus DOB with leading zeroes and no separators", () => {
    expect(deriveEmployeePdfPassword({ employeeCode: "90001", dateOfBirth: "1988-06-18", rule: "employee_code_dob" })).toBe("9000118061988");
    expect(deriveEmployeePdfPassword({ employeeCode: "7", dateOfBirth: "2001-01-09", rule: "employee_code_dob" })).toBe("709012001");
  });

  it("blocks missing or invalid authoritative employee data", () => {
    expect(() => deriveEmployeePdfPassword({ employeeCode: "90001", dateOfBirth: null, rule: "employee_code_dob" })).toThrow(/Date of Birth is missing/);
    expect(() => deriveEmployeePdfPassword({ employeeCode: "90001", dateOfBirth: "2001-02-31", rule: "employee_code_dob" })).toThrow(/Date of Birth is invalid/);
    expect(() => deriveEmployeePdfPassword({ employeeCode: "", dateOfBirth: "2001-01-09", rule: "employee_code_dob" })).toThrow(/Employee Code is missing/);
  });

  it("uses one typed server-side protection service for all document types", () => {
    expect(security).toContain('export type EmployeePdfDocumentType = "payslip" | "ytd" | "performance"');
    expect(source("src/app/api/payroll/payslip/[id]/route.ts")).toContain('documentType: "payslip"');
    expect(source("src/app/api/payroll/ytd/route.ts")).toContain('documentType: "ytd"');
    expect(source("src/app/api/performance/report/[id]/route.ts")).toContain('documentType:"performance"');
    expect(source("src/lib/payroll/distribution.ts")).toContain('documentType: "payslip"');
  });

  it("produces encrypted PDF bytes through the shared engine", async () => {
    const original = await PDFDocument.create();
    original.addPage([200, 200]);
    const bytes = await original.save();
    const { encryptEmployeePdf } = await import("../src/lib/pdf/passwordProtection");
    const protectedBytes = await encryptEmployeePdf(bytes, "9000118061988");
    const protectedText = Buffer.from(protectedBytes).toString("latin1");
    expect(protectedBytes.equals(Buffer.from(bytes))).toBe(false);
    expect(protectedText).toContain("/Encrypt");
  });

  it("does not persist, log, return, or send a generated password", () => {
    expect(migration).not.toMatch(/generated_password|pdf_password\s+(?:text|varchar)/i);
    expect(security).not.toMatch(/console\.|localStorage|sessionStorage|Response\.json/);
    expect(source("src/lib/payroll/distribution.ts")).not.toContain("const password =");
  });

  it("keeps PDF Security under Finance Admin-only Payroll Administration", () => {
    const workspace = source("src/components/payroll/PayrollWorkspace.tsx");
    const server = source("src/lib/payroll/server.ts");
    expect(workspace).toContain("Finance Admin only");
    expect(workspace).toContain("administrationAccess = isFinanceAdminRole");
    expect(server).toContain("payrollAdminOnly(actor.role)");
    expect(server).toContain("isFinanceAdminRole");
  });

  it("protects historical downloads at request time and refreshes stale attachments", () => {
    const payslipRoute = source("src/app/api/payroll/payslip/[id]/route.ts");
    const ytdRoute = source("src/app/api/payroll/ytd/route.ts");
    const distribution = source("src/lib/payroll/distribution.ts");
    expect(payslipRoute).toContain("protectEmployeePdf");
    expect(ytdRoute).toContain("protectEmployeePdf");
    expect(ytdRoute).toContain("fromMonth");
    expect(ytdRoute).toContain("toMonth");
    expect(distribution).toContain("storedPdfUsesCurrentSecurity");
    expect(distribution).toContain("password_rule_used: activePasswordRule");
  });

  it("retains self-service and Finance Admin-only cross-employee authorization", () => {
    const payslipRoute = source("src/app/api/payroll/payslip/[id]/route.ts");
    const ytdRoute = source("src/app/api/payroll/ytd/route.ts");
    expect(payslipRoute).toContain("isFinanceAdminRole(actor.role)");
    expect(payslipRoute).toContain("entry.employee_id !== actor.employeeId");
    expect(ytdRoute).toContain("requestedEmployeeId !== actor.employeeId && !isFinanceAdminRole(actor.role)");
  });

  it("does not alter approved Payslip and YTD visual documents", () => {
    expect(source("src/components/payroll/PayslipPdfDocument.tsx")).toContain("PayslipPdfDocument");
    expect(source("src/components/payroll/YtdPayrollPdfDocument.tsx")).toContain("YTD Summary");
  });
});
