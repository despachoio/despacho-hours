import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { form16Filename } from "../src/lib/payroll/filenames";

const source = (path: string) => readFileSync(path, "utf8");

describe("secure Form 16 self-service", () => {
  it("uses the employee code and financial year in the download filename", () => {
    expect(form16Filename("90001", "2025-26")).toBe("Form16_90001_FY 2025-26.pdf");
  });

  it("stores finance-issued PDFs in a private bucket with employee self-read metadata", () => {
    const migration = source("supabase/migrations/202610200001_form16_documents.sql");
    expect(migration).toContain("payroll_form16_documents_employee_read");
    expect(migration).toContain("employee_id = public.get_my_employee_id()");
    expect(migration).toContain("'payroll-form16', 'payroll-form16', false");
    expect(migration).toContain("unique(employee_id, financial_year)");
  });

  it("restricts publication to Finance Admin and validates PDF content", () => {
    const upload = source("src/app/api/payroll/form-16/route.ts");
    expect(upload).toContain("financePayrollOnly(actor.role)");
    expect(upload).toContain('!== "%PDF-"');
    expect(upload).toContain("MAX_FILE_SIZE");
  });

  it("restricts downloads to the document owner or Finance Admin", () => {
    const download = source("src/app/api/payroll/form-16/[id]/route.ts");
    expect(download).toContain("document.data.employee_id !== actor.employeeId && !isFinanceAdminRole(actor.role)");
    expect(download).toContain('"Cache-Control": "private, no-store"');
    expect(download).toContain('action: "form16_downloaded"');
  });

  it("shows document status and disables download while unavailable or downloading", () => {
    const workspace = source("src/components/payroll/PayrollWorkspace.tsx");
    expect(workspace).toContain("Download Form 16");
    expect(workspace).toContain("Awaiting issuance");
    expect(workspace).toContain("disabled={!document || downloading}");
    expect(workspace).toContain('downloading ? "Downloading..."');
  });
});
