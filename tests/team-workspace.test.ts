import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TEAM_POLICY_DOCUMENTS } from "../src/lib/team-policies";

const source = (path: string) => readFileSync(path, "utf8");

describe("Team HR workspace", () => {
  it("organizes Team into responsive permission-aware tabs", () => {
    const page = source("src/app/(app)/team/page.tsx");
    for (const tab of ["Overview", "Profile Approvals", "Organization Chart", "Policies"]) expect(page).toContain(tab);
    expect(page).toContain('isAdmin ? [{ value: "approvals"');
    expect(page).toContain('tab === "overview"');
    expect(page).toContain('tab === "organization"');
    expect(page).toContain('tab === "policies"');
    expect(page).toContain("overflow-x-auto");
  });

  it("keeps the new-member action contextual to Employees", () => {
    const page = source("src/app/(app)/team/page.tsx");
    expect(page.indexOf("<h2 className=\"font-bold text-slate-950\">Employees")).toBeLessThan(page.indexOf("+ New Workforce Member"));
    expect(page.indexOf("+ New Workforce Member")).toBeLessThan(page.indexOf('(["active", "inactive", "all"]'));
  });

  it("builds the organization hierarchy dynamically from reporting managers", () => {
    const chart = source("src/components/team/OrganizationChart.tsx");
    expect(chart).toContain("node.reporting_manager_id");
    expect(chart).toContain("<OrgNode");
    expect(chart).toContain("Zoom in");
    expect(chart).toContain("Zoom out");
    expect(chart).toContain("Fit to screen");
    expect(chart).toContain("scrollIntoView");
    expect(chart).toContain("/team/${node.id}");
  });

  it("bundles configurable policy documents with viewing and downloads", () => {
    expect(TEAM_POLICY_DOCUMENTS.map((policy) => policy.title)).toEqual(["Code of Conduct", "Non-Disclosure Agreement (NDA)", "Acceptable Usage Policy (AUP)", "Appraisal Policy", "Roles and Responsibilities"]);
    for (const policy of TEAM_POLICY_DOCUMENTS.filter((item) => item.kind === "pdf")) {
      expect(policy.version).toBe("1.1");
      expect(policy.file && source(`public${policy.file}`).startsWith("%PDF-")).toBe(true);
    }
    expect(TEAM_POLICY_DOCUMENTS.find((item) => item.id === "roles-and-responsibilities")?.externalUrl).toContain("drive.google.com");
    const policies = source("src/components/team/TeamPolicies.tsx");
    expect(policies).toContain("TEAM_POLICY_DOCUMENTS.map");
    expect(policies).toContain("Overall Score = Billable Utilization + Recognition − Penalties");
    expect(policies).toContain("active, inactive, or archived");
    expect(policies).toContain("<iframe");
    expect(policies).toContain("Print / Open");
    expect(policies).toContain("download");
  });

  it("reuses existing approval APIs and permissions", () => {
    const approvals = source("src/components/team/ProfileApprovals.tsx");
    const api = source("src/app/api/profile/change-requests/route.ts");
    expect(approvals).toContain('/api/profile/change-requests');
    expect(approvals).toContain("Pending Approvals");
    expect(approvals).toContain("Approved Today");
    expect(approvals).toContain("Needs Changes");
    expect(api).toContain("isAdminLevelRole");
  });
});
