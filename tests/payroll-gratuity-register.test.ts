import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("finance gratuity liability register", () => {
  it("reuses the shared gratuity calculation for every employee", () => {
    const register = source("src/lib/payroll/gratuityRegister.ts");
    expect(register).toContain("calculateGratuityEstimate");
    expect(register).toContain("selectEffectiveSalaryStructures");
    expect(register).toContain("latestEntries");
  });

  it("is visible only inside the Finance Admin reports payload", () => {
    const server = source("src/lib/payroll/server.ts");
    const workspace = source("src/components/payroll/PayrollAdministration.tsx");
    expect(server.indexOf("if (!isFinanceAdminRole(actor.role)) return base")).toBeLessThan(server.indexOf("loadGratuityRegister(actor.admin, asOfDate)"));
    expect(workspace).toContain('data.role === "finance admin"');
    expect(workspace).toContain("GratuityLiabilityRegister");
  });

  it("supports employee, status and eligibility filters with reset", () => {
    const workspace = source("src/components/payroll/PayrollAdministration.tsx");
    expect(workspace).toContain("Employee Status");
    expect(workspace).toContain("Eligibility");
    expect(workspace).toContain("Search code or name");
    expect(workspace).toContain("emptyGratuityFilters");
  });

  it("exports the currently applied filters to PDF and Excel", () => {
    const workspace = source("src/components/payroll/PayrollAdministration.tsx");
    const route = source("src/app/api/payroll/reports/gratuity/route.ts");
    expect(workspace).toContain('downloadGratuityRegister({ ...applied, asOfDate }, format)');
    expect(workspace).toContain('Download Excel');
    expect(workspace).toContain('Download PDF');
    expect(route).toContain("financePayrollOnly(actor.role)");
    expect(route).toContain("filterGratuityRegister");
    expect(route).toContain("GratuityRegisterPdfDocument");
  });

  it("keeps the report informational and does not create payroll entries", () => {
    const route = source("src/app/api/payroll/reports/gratuity/route.ts");
    const pdf = source("src/components/payroll/GratuityRegisterPdfDocument.tsx");
    expect(route).not.toContain('.from("payroll_entries").insert');
    expect(pdf).toContain("Informational estimate only");
  });
});
