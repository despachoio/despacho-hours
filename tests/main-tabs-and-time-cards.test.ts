import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("main workspace tab consistency", () => {
  it("adds semantic icons to every Workforce tab without changing visibility", () => {
    const workforce = source("src/app/(app)/team/page.tsx");
    for (const icon of ["chart", "check", "hierarchy", "star", "monitor", "exit", "shield"]) {
      expect(workforce).toContain(`icon: "${icon}"`);
    }
    expect(workforce).toContain("...(isAdmin ?");
    expect(workforce).toContain('<TimeOffIcon name={item.icon} className="h-4 w-4"/>');
  });

  it("keeps Payroll Policies last and preserves Administration permission gating", () => {
    const payroll = source("src/components/payroll/PayrollWorkspace.tsx");
    const administration = payroll.indexOf('["administration", "Administration", "settings"]');
    const policies = payroll.indexOf('["policy", "Policies", "shield"]');
    expect(administration).toBeGreaterThan(-1);
    expect(policies).toBeGreaterThan(administration);
    expect(payroll).toContain("...(administrationAccess ?");
    expect(payroll).toContain("mainTabs.map(([value, label, icon])");
  });

  it("adds icons to all existing Invoice and Accounts tabs", () => {
    const invoices = source("src/app/(app)/invoices/page.tsx");
    const accounts = source("src/app/(app)/accounts/page.tsx");
    expect(invoices).toContain('["overview", "Overview", "chart"]');
    expect(invoices).toContain('["all", "All Invoices", "receipt"]');
    expect(invoices).toContain('["recurring", "Recurring Invoices", "repeat"]');
    expect(accounts).toContain('{ value: "clients", label: "Clients", icon: "people" }');
    expect(accounts).toContain('{ value: "projects", label: "Projects", icon: "folder" }');
    expect(accounts).toContain("const visibleTabs = canViewClients ? accountTabs : accountTabs.slice(1)");
  });
});

describe("Time summary card presentation", () => {
  it("uses premium non-interactive metric cards without changing source values", () => {
    const timer = source("src/app/(app)/timer/page.tsx");
    expect(timer).toContain("formatDecimalHours(summary.today)");
    expect(timer).toContain("formatDecimalHours(summary.week)");
    expect(timer).toContain("String(summary.running)");
    expect(timer).toContain("String(summary.projects)");
    expect(timer).toContain("rounded-3xl border border-slate-200/80 bg-gradient-to-br");
    expect(timer).toContain("absolute inset-x-5 top-0 h-1 rounded-b-full");
    expect(timer).toContain('<TimeOffIcon name={card.icon} className="h-5 w-5" />');
    expect(timer).not.toContain('className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"');
  });
});
