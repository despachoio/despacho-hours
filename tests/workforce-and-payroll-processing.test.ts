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
    expect(chart).toContain("levelTones");
    expect(chart).toContain("from-[#173B70]");
    expect(chart).toContain("from-[#0F5F66]");
    expect(chart).toContain("from-[#563D7C]");
    expect(chart).toContain("from-[#7A4E28]");
    expect(chart).not.toContain('import { initials }');
    expect(chart).not.toContain("initials(name)");
    expect(chart).not.toContain("{node.employee_code");
    expect(chart).not.toContain("{node.department");
  });

  it("renders a classic connected hierarchy with level colours", () => {
    const styles = source(
      "src/components/team/OrganizationChart.module.css",
    );
    expect(chart).not.toContain("Company Organization");
    expect(chart).not.toContain("Active reporting hierarchy");
    expect(chart).toContain("levelTones[(depth - 1) % levelTones.length]");
    expect(chart).toContain("arrangeLargeBranchesTowardCenter");
    expect(chart).toContain("subtreeSize(b) - subtreeSize(a)");
    expect(chart).toContain("Math.abs(a - center) - Math.abs(b - center)");
    expect(chart).toContain("aria-expanded={!isCollapsed}");
    expect(styles).toContain(".children::before");
    expect(styles).toContain(".node::before");
    expect(styles).toContain(".node::after");
  });

  it("shows the full active hierarchy while preserving profile access", () => {
    const loader = source("src/components/team/OrganizationChartLoader.tsx");
    const migration = source(
      "supabase/migrations/202610020001_organization_chart_all_active_employees.sql",
    );
    const detail = source("src/app/(app)/team/[id]/page.tsx");

    expect(loader).toContain('rpc("get_organization_chart_employees")');
    expect(loader).toContain("can_view_profile: row.can_view_profile");
    expect(migration).toContain(
      "where lower(trim(coalesce(employee.status, 'active'))) = 'active'",
    );
    expect(migration).toContain("can_view_profile boolean");
    expect(migration).toContain("employee.reporting_manager_id = actor.employee_id");
    expect(chart).toContain("node.can_view_profile ?");
    expect(chart).toContain("Profile access is restricted");
    expect(detail).toContain('currentRole === "employee"');
    expect(detail).toContain('currentRole === "manager"');
    expect(detail).toContain('"get_team_metric_employees"');
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

  it("uses premium cards across the workforce overview", () => {
    const summaries = source("src/components/team/TeamSummaryCards.tsx");
    const employeeCard = source("src/components/team/EmployeeCard.tsx");
    expect(summaries).toContain("visualTones");
    expect(summaries).toContain("bg-gradient-to-br");
    expect(summaries).toContain("hover:-translate-y-1");
    expect(employeeCard).toContain("bg-gradient-to-r from-white via-white to-blue-50/70");
    expect(employeeCard).toContain("from-[#153E90] to-cyan-400");
  });
});

describe("My Payroll presentation", () => {
  it("uses the premium account and invoice card language", () => {
    const payroll = source("src/components/payroll/PayrollWorkspace.tsx");
    expect(payroll).toContain('tone="emerald"');
    expect(payroll).toContain('tone="rose"');
    expect(payroll).toContain('tone="blue"');
    expect(payroll).toContain("from-violet-600 to-fuchsia-300");
    expect(payroll).toContain("Latest published salary slip");
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
