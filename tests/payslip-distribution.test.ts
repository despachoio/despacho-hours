import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt-lite";
import { payslipPassword, payslipPasswordDescription } from "../src/lib/payroll/password";
import { buildPayslipEmail } from "../src/lib/email/templates/payroll";

describe("payslip distribution", () => {
  it("derives supported passwords without persisting them", () => {
    expect(payslipPassword("employee_code_dob", "90001", "1988-06-18")).toBe("9000118061988");
    expect(payslipPassword("employee_code", "90001", null)).toBe("90001");
    expect(payslipPassword("dob", "ignored", "1988-06-18")).toBe("18061988");
    expect(payslipPasswordDescription("employee_code_dob")).toBe("Employee Code + DOB (DDMMYYYY)");
    expect(() => payslipPassword("dob", "90001", null)).toThrow(/date of birth/i);
  });

  it("applies real PDF password protection", async () => {
    const source = await PDFDocument.create();
    source.addPage();
    const encrypted = Buffer.from(await encryptPDF(await source.save(), "9000118061988"));
    expect(encrypted.includes(Buffer.from("/Encrypt"))).toBe(true);
    await expect(PDFDocument.load(encrypted)).rejects.toThrow();
  });

  it("builds a branded portal-linked payroll email", () => {
    const html = buildPayslipEmail({ companyName: "Despacho Inc.", businessEmail: "sales@despacho.io", website: "https://www.despacho.io", employeeName: "Rajeeth", payrollMonth: "July 2026", portalUrl: "https://kairo.despacho.io/payroll?tab=history", passwordRuleDescription: "Employee Code + DOB (DDMMYYYY)", body: "Your salary slip is available." });
    expect(html).toContain("Salary Slip · July 2026");
    expect(html).toContain("Open Payroll History");
    expect(html).toContain("Employee Code + DOB (DDMMYYYY)");
  });

  it("keeps successful deliveries idempotent and preserves PDFs after email failure", () => {
    const source = readFileSync("src/lib/payroll/distribution.ts", "utf8");
    expect(source).toContain('distribution.email_status === "completed"');
    expect(source).toContain('email_status: "failed", email_error: message');
    expect(source).toContain('action: "payslip_email_failed"');
    expect(source.indexOf('payslip_status: "generated"')).toBeLessThan(source.indexOf("await sendEmail"));
  });

  it("supports failed-only retries and does not persist derived passwords", () => {
    const administration = readFileSync("src/components/payroll/PayrollAdministration.tsx", "utf8");
    const migration = readFileSync("supabase/migrations/202608130001_payslip_distribution.sql", "utf8");
    expect(administration).toContain('item.email_status === "failed"');
    expect(administration).toContain("Retry Failed Emails");
    expect(migration).not.toMatch(/password\s+(text|varchar)/i);
  });

  it("starts distribution only after the submitted payroll transition succeeds", () => {
    const administration = readFileSync("src/components/payroll/PayrollAdministration.tsx", "utf8");
    expect(administration).toContain('onAction({ action: "submit", runId: run.id }, false)');
    expect(administration).toContain("processPayslipDistribution(entry.id)");
    expect(administration.indexOf('onAction({ action: "submit", runId: run.id }, false)')).toBeLessThan(administration.indexOf("processPayslipDistribution(entry.id)"));
  });
});
