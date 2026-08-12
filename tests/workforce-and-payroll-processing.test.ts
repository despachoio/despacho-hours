import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("Workforce organization chart", () => {
  const chart = source("src/components/team/OrganizationChart.tsx");

  it("includes active employees only and removes honorifics", () => {
    expect(chart).toContain("organizationChartActiveEmployees");
    expect(chart).toContain('toLowerCase() === "active"');
    expect(chart).toContain("organizationChartEmployeeName");
    expect(chart).toContain("mr|mrs|ms|miss|dr");
    expect(chart).not.toContain("node.status ||");
  });

  it("uses premium color-coded cards", () => {
    expect(chart).toContain("nodeTones");
    expect(chart).toContain("from-violet-700");
    expect(chart).toContain("from-emerald-700");
    expect(chart).toContain("from-amber-600");
  });
});

describe("Workforce terminology", () => {
  it("renames the primary navigation and page title", () => {
    const layout = source("src/app/(app)/layout.tsx");
    const page = source("src/app/(app)/team/page.tsx");
    expect(layout).toContain('name: "Workforce"');
    expect(page).toContain("Workforce");
    expect(page).toContain("Workforce sections");
    expect(page).toContain("+ New Workforce Member");
  });
});

describe("Payroll Processing summary", () => {
  it("shows statutory totals beside employee, net payroll, and status", () => {
    const administration = source(
      "src/components/payroll/PayrollAdministration.tsx",
    );
    expect(administration).toContain("summarizePayroll(run?.entries || [])");
    for (const label of [
      "Employees Processed",
      "Net Payroll",
      "Total PF Amount",
      "Total PT Amount",
      "TDS Amount",
      "Status",
    ]) {
      expect(administration).toContain(`label="${label}"`);
    }
  });
});
