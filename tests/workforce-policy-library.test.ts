import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAppraisalPolicySections, buildPolicySections, TEAM_POLICY_DOCUMENTS } from "../src/lib/team-policies";
import type { AppraisalPolicyConfiguration } from "../src/lib/team-policies";

const source = (path: string) => readFileSync(path, "utf8");
const configuration: AppraisalPolicyConfiguration = {
  policies: [
    { level_group: "level_1", expected_percent: 60, minimum_percent: 40, monthly_expected_hours: 90, monthly_minimum_hours: 60, quarterly_expected_hours: 270, quarterly_minimum_hours: 180, annual_expected_hours: 1080, annual_minimum_hours: 720 },
    { level_group: "level_2", expected_percent: 80, minimum_percent: 60, monthly_expected_hours: 120, monthly_minimum_hours: 90, quarterly_expected_hours: 360, quarterly_minimum_hours: 270, annual_expected_hours: 1440, annual_minimum_hours: 1080 },
    { level_group: "level_3_plus", expected_percent: 100, minimum_percent: 70, monthly_expected_hours: 150, monthly_minimum_hours: 105, quarterly_expected_hours: 450, quarterly_minimum_hours: 315, annual_expected_hours: 1800, annual_minimum_hours: 1260 },
  ],
  metrics: [{ id: "rockstar", name: "Rockstar Award", code: "rockstar_award", category: "booster", default_score_delta: 25, requires_client: false, active: true, display_order: 1, core_metric: true, qualification_rules: {} }],
  settings: { singleton_key: true, policy_version: 7, eligibility_rules: { minimumOverallScore: 85, maximumEscalations: 1 }, performance_categories: [{ name: "Met Expectations", minimumScore: 100 }] },
};

describe("Workforce internal policy library", () => {
  const ui = source("src/components/team/TeamPolicies.tsx");
  const pdf = source("src/components/team/PolicyPdfDocument.tsx");
  const route = source("src/app/api/workforce/policies/[slug]/pdf/route.ts");
  const loader = source("src/lib/team-policy-server.ts");

  it.each(TEAM_POLICY_DOCUMENTS)("$title offers common read and PDF actions", (policy) => {
    expect(policy.downloadable).toBe(true);
    expect(ui).toContain("Read Policy");
    expect(ui).toContain("Download PDF");
  });
  it("opens policy content inside an accessible Kairo dialog", () => {
    expect(ui).toContain('role="dialog"');
    expect(ui).toContain('aria-modal="true"');
    expect(ui).toContain("<PolicyContent");
  });
  it("stores Roles and Responsibilities internally without a Google Drive dependency", () => {
    const content = source("src/lib/team-policy-static-content.ts");
    expect(content).toContain("ROLES_AND_RESPONSIBILITIES_TEXT");
    expect(content).toContain("Junior Process Executive");
    expect(ui).not.toContain("drive.google.com");
    expect(source("src/lib/team-policies.ts")).not.toContain("drive.google.com");
  });
  it("preserves the supplied Exit Policy wording and renders it", () => {
    const exit = TEAM_POLICY_DOCUMENTS.find((policy) => policy.id === "exit-policy");
    expect(exit).toBeTruthy();
    const text = JSON.stringify(buildPolicySections(exit!));
    expect(text).toContain("Thirty (30) days");
    expect(text).toContain("five (5) days");
    expect(text).toContain("no severance payment");
    expect(text).toContain("computer and its accessories");
  });
  it("uses a shared premium PDF and the official Despacho logo", () => {
    expect(route).toContain("PolicyPdfDocument");
    expect(route).toContain('invoice_logo_url: "/despacho-logo-full.png"');
    expect(pdf).toContain("#153E90");
    expect(pdf).toContain("System-generated internal policy document");
    expect(pdf).toContain("pageNumber, totalPages");
    expect(route).not.toContain("protectEmployeePdf");
  });
  it("reads every configurable appraisal value from Reviews settings", () => {
    const rendered = JSON.stringify(buildAppraisalPolicySections(configuration));
    for (const value of ["100%", "70%", "150 expected / 105 minimum", "450 expected / 315 minimum", "1,800 expected / 1,260 minimum", "Rockstar Award", "25", "85%", "Met Expectations"]) expect(rendered).toContain(value);
  });
  it("updates the policy when Reviews utilization settings change", () => {
    const initial = JSON.stringify(buildAppraisalPolicySections(configuration));
    const changed = JSON.stringify(buildAppraisalPolicySections({ ...configuration, policies: configuration.policies.map((policy) => policy.level_group === "level_3_plus" ? { ...policy, expected_percent: 95, minimum_percent: 75 } : policy) }));
    expect(initial).toContain("100%");
    expect(changed).toContain("95%");
    expect(changed).toContain("75%");
    expect(changed).not.toEqual(initial);
  });
  it("uses the same section builder for the modal and downloaded appraisal PDF", () => {
    expect(ui).toContain("buildPolicySections");
    expect(route).toContain("buildPolicySections");
    expect(route).toContain("loadAppraisalPolicyConfiguration");
  });
  it("limits policy configuration loading to small settings queries", () => {
    for (const table of ["utilization_policies", "performance_metric_definitions", "performance_settings"]) expect(loader).toContain(table);
    for (const forbidden of ['from("employees")', 'from("time_entries")', 'from("performance_reviews")', 'from("performance_events")', "calculatePerformance(", "loadPerformance("]) expect(loader).not.toContain(forbidden);
    expect(ui).toContain('policy.contentSource === "reviews-settings"');
  });
  it("preserves Workforce policy visibility by reusing the existing tab", () => {
    const page = source("src/app/(app)/team/page.tsx");
    expect(page).toContain('tab === "policies"');
    expect(page).toContain("<TeamPolicies");
  });
});
