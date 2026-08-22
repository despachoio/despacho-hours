import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAppraisalPolicySections, buildPolicyDocument, buildPolicySections, TEAM_POLICY_DOCUMENTS, validateStructuredPolicy } from "../src/lib/team-policies";
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
  const pdfPostProcessor = source("src/lib/team-policy-pdf.ts");

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
  it("moves the rewards policy into the shared Workforce reader and PDF flow", () => {
    const policy = TEAM_POLICY_DOCUMENTS.find((item) => item.id === "rewards-policy");
    expect(policy).toBeTruthy();
    const content = JSON.stringify(buildPolicyDocument(policy!));
    for (const expected of ["Client Retention Bonus", "₹5,000", "Leadership Bonus", "₹30,000", "Client Scale-up", "Client Referral"]) {
      expect(content).toContain(expected);
    }
    expect(source("src/components/payroll/PayrollPolicy.tsx")).not.toContain('id: "rewards"');
  });
  it("uses a shared premium PDF and the official Despacho logo", () => {
    expect(route).toContain("PolicyPdfDocument");
    expect(route).toContain('invoice_logo_url: "/despacho-logo-full.png"');
    expect(pdf).toContain("#153E90");
    expect(pdf).toContain("System-generated internal policy document");
    expect(pdf).toContain("width: 72.5, height: 21");
    expect(route).toContain("stampPolicyPageNumbers");
    expect(pdfPostProcessor).toContain("Page ${index + 1} of ${pages.length}");
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
    expect(ui).toContain("buildPolicyDocument");
    expect(route).toContain("buildPolicyDocument");
    expect(route).toContain("loadAppraisalPolicyConfiguration");
  });
  it("waits for Reviews settings before building the Annual Appraisal document", () => {
    expect(ui).toContain('displayPolicy.contentSource === "reviews-settings" && !configuration');
    expect(ui).toContain('viewing?.contentSource !== "reviews-settings"');
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

  it("normalizes all 22 Code of Conduct sections as ordered headings", () => {
    const policy = TEAM_POLICY_DOCUMENTS.find((item) => item.id === "code-of-conduct")!;
    const headings = buildPolicyDocument(policy).blocks.filter((block) => block.type === "heading" && block.number);
    expect(headings).toHaveLength(22);
    expect(headings.map((block) => block.type === "heading" ? block.number : null)).toEqual(Array.from({ length: 22 }, (_, index) => index + 1));
  });

  it("renders Unacceptable Performance as six approved bullet criteria", () => {
    const blocks = buildPolicyDocument(TEAM_POLICY_DOCUMENTS.find((item) => item.id === "code-of-conduct")!).blocks;
    const headingIndex = blocks.findIndex((block) => block.type === "heading" && block.number === 20);
    const criteria = blocks[headingIndex + 1];
    expect(criteria).toMatchObject({ type: "unordered-list" });
    expect(criteria?.type === "unordered-list" ? criteria.items : []).toHaveLength(6);
  });

  it("separates all NDA clauses, definitions, and Governing Law", () => {
    const blocks = buildPolicyDocument(TEAM_POLICY_DOCUMENTS.find((item) => item.id === "non-disclosure-agreement")!).blocks;
    const headings = blocks.filter((block) => block.type === "heading").map((block) => block.type === "heading" ? `${block.number || ""}${block.text}` : "");
    for (const expected of ["1Confidentiality", "2Inventions, Copyrights and Patents", "3Despacho Materials", "4Non-raiding of Employee and clients", "5No Interference", "6Other Employment", "7Miscellaneous", "Definition: Inventions", "Definition: Works", "Governing Law"]) expect(headings).toContain(expected);
  });

  it("removes repeated legacy Annexure metadata from canonical body blocks", () => {
    for (const id of ["code-of-conduct", "non-disclosure-agreement", "acceptable-usage-policy"]) {
      const body = JSON.stringify(buildPolicyDocument(TEAM_POLICY_DOCUMENTS.find((item) => item.id === id)!));
      expect(body).not.toMatch(/Annexure [ABC]:/);
      expect(body).not.toContain("Accepted & Signed");
    }
  });

  it("keeps the approved AUP as an acknowledgement instead of inventing clauses", () => {
    const blocks = buildPolicyDocument(TEAM_POLICY_DOCUMENTS.find((item) => item.id === "acceptable-usage-policy")!).blocks;
    expect(blocks.some((block) => block.type === "acknowledgement" && block.fields.join("|") === "Name|Accepted Date|Signature")).toBe(true);
    expect(blocks.filter((block) => block.type === "heading")).toHaveLength(1);
  });

  it("preserves Exit Policy termination block order", () => {
    const blocks = buildPolicyDocument(TEAM_POLICY_DOCUMENTS.find((item) => item.id === "exit-policy")!).blocks;
    const termination = blocks.findIndex((block) => block.type === "heading" && block.text === "Termination");
    expect(blocks.slice(termination, termination + 6).map((block) => block.type)).toEqual(["heading", "paragraph", "unordered-list", "paragraph", "paragraph", "paragraph"]);
  });

  it("validates required metadata, non-empty lists, and table shape", () => {
    const valid = buildPolicyDocument(TEAM_POLICY_DOCUMENTS.find((item) => item.id === "exit-policy")!);
    expect(validateStructuredPolicy(valid)).toBe(valid);
    expect(() => validateStructuredPolicy({ ...valid, title: "" })).toThrow(/metadata/);
    expect(() => validateStructuredPolicy({ ...valid, blocks: [{ type: "unordered-list", items: [] }] })).toThrow(/empty list/);
  });

  it("renders every canonical block sequentially in modal and PDF", () => {
    expect(ui).toContain("document.blocks.map");
    expect(pdf).toContain("document.blocks.map");
    expect(pdf).toContain("minPresenceAhead={45}");
    expect(pdf).not.toContain("section.paragraphs");
  });

  it("uses separated, wrapping metadata cells and a compact continuation header", () => {
    for (const label of ["Version", "Effective", "Last Updated"]) expect(pdf).toContain(label);
    expect(pdf).toContain("metadataCell");
    expect(pdf).toContain("continuationHeader");
    expect(pdf).toContain("Internal policy library  ·  {document.title}");
  });

  it("keeps the policy modal wide and vertically scrollable", () => {
    expect(ui).toContain("max-w-[1440px]");
    expect(ui).toContain("overflow-y-auto");
  });

  it("reduces only the policy PDF logo by half while preserving its aspect ratio", () => {
    const previous = { width: 145, height: 42 };
    const current = { width: 72.5, height: 21 };
    expect(current.width / previous.width).toBe(0.5);
    expect(current.height / previous.height).toBe(0.5);
    expect(current.width / current.height).toBe(previous.width / previous.height);
  });

  it("keeps policy metadata canonical and separate from the title", () => {
    const document = buildPolicyDocument(TEAM_POLICY_DOCUMENTS.find((item) => item.id === "exit-policy")!);
    expect(document.title).toBe("Exit Policy");
    expect(document.version).toBe("1.0");
    expect(document.effectiveDate).toBe("Upon publication");
    expect(document.title).not.toContain(document.version);
    expect(document.title).not.toContain(document.effectiveDate);
  });

  it("keeps the Code of Conduct introduction separate from numbered Section 1", () => {
    const blocks = buildPolicyDocument(TEAM_POLICY_DOCUMENTS.find((item) => item.id === "code-of-conduct")!).blocks;
    const firstNumberedHeading = blocks.findIndex((block) => block.type === "heading" && block.number === 1);
    expect(firstNumberedHeading).toBeGreaterThan(0);
    expect(blocks.slice(0, firstNumberedHeading).some((block) => block.type === "paragraph")).toBe(true);
  });

  it("formats AUP acknowledgement fields in both canonical renderers", () => {
    expect(ui).toContain('case "acknowledgement"');
    expect(pdf).toContain('case "acknowledgement"');
    const blocks = buildPolicyDocument(TEAM_POLICY_DOCUMENTS.find((item) => item.id === "acceptable-usage-policy")!).blocks;
    expect(blocks).toContainEqual(expect.objectContaining({ type: "acknowledgement", fields: ["Name", "Accepted Date", "Signature"] }));
  });

  it("does not silently omit canonical content from any policy", () => {
    for (const policy of TEAM_POLICY_DOCUMENTS) {
      const document = buildPolicyDocument(policy, policy.contentSource === "reviews-settings" ? configuration : undefined);
      expect(document.blocks.length).toBeGreaterThan(0);
      expect(JSON.stringify(document.blocks)).not.toContain("[object Object]");
    }
  });

  it("keeps a compact footer and stamps Page X of Y on multi-page PDFs", () => {
    expect(pdf).toContain("Despacho India Private Limited");
    expect(pdf).toContain("System-generated internal policy document");
    expect(pdfPostProcessor).toContain("pages.forEach");
    expect(pdfPostProcessor).toContain("Page ${index + 1} of ${pages.length}");
  });

  it.each([
    [1, "Confidentiality"],
    [2, "Inventions, Copyrights and Patents"],
    [3, "Despacho Materials"],
    [4, "Non-raiding of Employee and clients"],
    [5, "No Interference"],
    [6, "Other Employment"],
    [7, "Miscellaneous"],
  ] as const)("renders NDA clause %i (%s) as its own heading", (number, text) => {
    const blocks = buildPolicyDocument(TEAM_POLICY_DOCUMENTS.find((item) => item.id === "non-disclosure-agreement")!).blocks;
    expect(blocks).toContainEqual(expect.objectContaining({ type: "heading", number, text }));
  });
});
