import {
  AUP_TEXT,
  CODE_OF_CONDUCT_TEXT,
  NDA_TEXT,
  ROLES_AND_RESPONSIBILITIES_TEXT,
} from "@/lib/team-policy-static-content";
import type {
  PerformanceMetric,
  PerformanceSettings,
  UtilizationPolicy,
} from "@/lib/performance/types";

export type PolicyTone = "blue" | "violet" | "cyan" | "emerald" | "amber" | "rose";
export type AppraisalPolicyConfiguration = { policies: UtilizationPolicy[]; metrics: PerformanceMetric[]; settings: PerformanceSettings };
export type TeamPolicyDocument = {
  id: string; slug: string; title: string; shortTitle: string; category: string;
  version: string; effectiveDate: string; lastUpdated?: string; description: string;
  contentSource: "static" | "reviews-settings"; sourceText?: string;
  downloadable: true; tone: PolicyTone;
};
export type PolicyTable = { columns: string[]; rows: Array<Array<string | number>> };
export type PolicySection = { heading: string; paragraphs?: string[]; bullets?: string[]; table?: PolicyTable };

const EXIT_POLICY_TEXT = `# Exit Policy

## During the Initial Term

1. The Employee may terminate the employment by providing Thirty (30) days prior written notice of his/her intention to terminate the employment; or

2. Despacho India Private Limited (henceforth Despacho) may terminate the employment by providing the employee with at least five (5) days prior written notice of its intention to terminate the employment.

## Following the Initial Term

1. The employee may terminate the employment by giving the other party at least Sixty (60) days prior written notice of his/her intention to terminate the employment; or

2. Despacho India Private Limited (henceforth Despacho) may terminate the employment by providing the employee with at least five (5) days prior written notice of its intention to terminate the employment.

## Termination

Despacho may terminate the employment forthwith and without prior notice on the occurrence of a material breach of the internal policies, as determined by Despacho in its sole discretion, which shall include, but is not limited to, one or more of the following events where the employee:

• commits an act of insolvency, is adjudged insolvent, applies to be adjudged an insolvent or makes any compromise or arrangement with his creditors

• violates Despacho’s policies or procedures

• fails to comply with all applicable legislation, regulations or rules in providing his services

• fails or refuses to comply with any instruction or direction lawfully given by Despacho

• fails to perform or otherwise breaches any of his obligations under the agreement / internal policies

• engages in conduct that brings Despacho in or to material public disgrace or disrepute

• performs the services in an incompetent manner or fails to provide the expertise required under the agreement

• commits an act of dishonesty, breach of trust or fraud

• fails or is unable to perform the services for any reason; or

• fails to provide services for a period greater than 5 working days without the prior approval and consent of Despacho

Upon the termination of the employment for any reason whatsoever, Despacho is not obligated to make any payment to the employee other than that owing to the employee for services provided by the employee up to the date of such termination plus any reimbursement for any pre-approved expenses incurred by the employee as provided under the agreement.

For greater certainty, no severance payment, termination fee or similar compensation shall be paid to the employee upon termination of the agreement or internal policies.

Upon the termination of the agreement or internal policies, the contractor shall forthwith return to Despacho all of Despacho’s confidential information, computer and its accessories, all copies thereof, any related material including without limitation, memoranda, notes and documents containing extracts or reproductions of proprietary information, all copies thereof, and all other property of Despacho in the employee's possession or control.`;

// Add future policies here; cards, reader and PDF downloads all render from this source.
export const TEAM_POLICY_DOCUMENTS: TeamPolicyDocument[] = [
  { id: "code-of-conduct", slug: "code-of-conduct", title: "Code of Conduct", shortTitle: "Conduct", category: "HR Policy", version: "1.1", effectiveDate: "1 September 2019", lastUpdated: "1 September 2019", description: "Standards for professional conduct, integrity, workplace behaviour, and accountability.", contentSource: "static", sourceText: CODE_OF_CONDUCT_TEXT, downloadable: true, tone: "blue" },
  { id: "non-disclosure-agreement", slug: "non-disclosure-agreement", title: "Non-Disclosure Agreement (NDA)", shortTitle: "NDA", category: "Legal", version: "1.1", effectiveDate: "1 September 2019", lastUpdated: "1 September 2019", description: "Confidentiality obligations covering company, client, employee, and business information.", contentSource: "static", sourceText: NDA_TEXT, downloadable: true, tone: "violet" },
  { id: "acceptable-usage-policy", slug: "acceptable-usage-policy", title: "Acceptable Usage Policy (AUP)", shortTitle: "AUP", category: "IT / Security", version: "1.1", effectiveDate: "1 September 2019", lastUpdated: "1 September 2019", description: "Responsible and secure use of company systems, devices, networks, and information assets.", contentSource: "static", sourceText: AUP_TEXT, downloadable: true, tone: "cyan" },
  { id: "annual-appraisal-policy", slug: "annual-appraisal-policy", title: "Annual Appraisal Policy", shortTitle: "Appraisal", category: "Performance", version: "Current", effectiveDate: "Current Reviews configuration", description: "Transparent annual scoring, billable-utilization targets, recognition, penalties, eligibility, and review stages.", contentSource: "reviews-settings", downloadable: true, tone: "emerald" },
  { id: "roles-and-responsibilities", slug: "roles-and-responsibilities", title: "Roles and Responsibilities", shortTitle: "Roles", category: "People Operations", version: "1.0", effectiveDate: "Current", description: "The role expectations and responsibility framework maintained by Despacho.", contentSource: "static", sourceText: ROLES_AND_RESPONSIBILITIES_TEXT, downloadable: true, tone: "amber" },
  { id: "exit-policy", slug: "exit-policy", title: "Exit Policy", shortTitle: "Exit", category: "Employment / HR Policy", version: "1.0", effectiveDate: "Effective upon publication", description: "Notice periods, termination conditions, final obligations, and return of company property.", contentSource: "static", sourceText: EXIT_POLICY_TEXT, downloadable: true, tone: "rose" },
];

export function findTeamPolicy(slug: string) { return TEAM_POLICY_DOCUMENTS.find((policy) => policy.slug === slug) || null }
const labelLevel = (value: UtilizationPolicy["level_group"]) => value === "level_1" ? "Level 1" : value === "level_2" ? "Level 2" : "Level 3+";
const policyValue = (value: number, suffix = "") => `${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}${suffix}`;

export function buildAppraisalPolicySections(config: AppraisalPolicyConfiguration): PolicySection[] {
  const rules = config.settings.eligibility_rules || {};
  const orderedPolicies = [...config.policies].sort((a, b) => a.level_group.localeCompare(b.level_group));
  const activeMetrics = config.metrics.filter((metric) => metric.active).sort((a, b) => a.display_order - b.display_order);
  const categories = [...(config.settings.performance_categories || [])].sort((a, b) => b.minimumScore - a.minimumScore);
  return [
    { heading: "Purpose and scoring method", paragraphs: ["The annual appraisal framework combines billable delivery, documented recognition, performance issues, and consistent eligibility controls.", "Overall Score = Billable Utilization + Recognition − Penalties", "Actual Billable includes completed time-entry hours from every billable project in the review year, whether that project is active, inactive, or archived. Non-billable project hours are excluded."] },
    { heading: "Utilization policy", table: { columns: ["Level", "Expected", "Minimum", "Monthly hours", "Quarterly hours", "Annual hours"], rows: orderedPolicies.map((policy) => [labelLevel(policy.level_group), policyValue(policy.expected_percent, "%"), policyValue(policy.minimum_percent, "%"), `${policyValue(policy.monthly_expected_hours)} expected / ${policyValue(policy.monthly_minimum_hours)} minimum`, `${policyValue(policy.quarterly_expected_hours)} expected / ${policyValue(policy.quarterly_minimum_hours)} minimum`, `${policyValue(policy.annual_expected_hours)} expected / ${policyValue(policy.annual_minimum_hours)} minimum`]) } },
    { heading: "Recognition and penalties", paragraphs: ["Configured Reviews metrics apply to the relevant performance year when their qualification requirements are met."], table: { columns: ["Metric", "Type", "Score", "Client required"], rows: activeMetrics.map((metric) => [metric.name, metric.category === "booster" ? "Recognition" : "Penalty", policyValue(Math.abs(metric.default_score_delta)), metric.requires_client ? "Yes" : "No"]) } },
    { heading: "Annual eligibility", bullets: [`Minimum overall score: ${policyValue(Number(rules.minimumOverallScore ?? 80), "%")}`, `Maximum qualified client escalations: ${policyValue(Number(rules.maximumEscalations ?? 2))}`, "The employee must meet the minimum billable-hours threshold for their level.", "Critical policy conditions may affect eligibility even when the numeric score is met."] },
    { heading: "Performance categories", table: { columns: ["Category", "Minimum score"], rows: categories.map((category) => [category.name, policyValue(category.minimumScore)]) } },
    { heading: "Review lifecycle and transparency", bullets: ["Not started — live performance remains visible.", "Started — manager review and comments are in progress.", "Finalized — the approved calculation and policy version are frozen.", "Reopened — authorized administrators document a reason before changes.", "Employees can monitor their live annual performance and download their report. Managers can review direct reports. Super Admin and Finance Admin retain administrative review and audit controls."] },
  ];
}

export function buildStaticPolicySections(policy: TeamPolicyDocument): PolicySection[] {
  if (policy.id === "roles-and-responsibilities") {
    const lines = (policy.sourceText || "").split("\n").map((line) => line.trim()).filter(Boolean);
    const sections: PolicySection[] = [];
    let current: PolicySection | null = null;
    for (const line of lines.slice(lines[0] === "Roles and Responsibilities" ? 2 : 0)) {
      const match = line.match(/^(\d{1,2}[AB]?)\s+(.+)$/);
      if (match) {
        if (current) sections.push(current);
        current = { heading: `Level ${match[1]} · ${match[2]}`, bullets: [] };
      } else if (current) current.bullets = [...(current.bullets || []), line];
    }
    if (current) sections.push(current);
    if (sections.length) return sections;
  }
  const chunks = (policy.sourceText?.trim() || "").split(/\n\s*\n/).map((chunk) => chunk.replace(/\s+/g, " ").trim()).filter(Boolean);
  const sections: PolicySection[] = [];
  let current: PolicySection = { heading: policy.title, paragraphs: [] };
  for (const chunk of chunks) {
    const heading = chunk.replace(/^#{1,3}\s*/, "");
    const isHeading = /^#{1,3}\s/.test(chunk) || (/^[A-Z0-9][A-Z0-9 &/(),.'’\-]{4,}$/.test(chunk) && chunk.length < 120) || (/^\d{1,2}[.)]?\s+[A-Z]/.test(chunk) && chunk.length < 100);
    if (isHeading) {
      if (current.paragraphs?.length || current.bullets?.length) sections.push(current);
      current = { heading, paragraphs: [] };
    } else if (/^(?:•|-|\*)\s+/.test(chunk)) {
      current.bullets = [...(current.bullets || []), chunk.replace(/^(?:•|-|\*)\s+/, "")];
    } else current.paragraphs = [...(current.paragraphs || []), chunk];
  }
  if (current.paragraphs?.length || current.bullets?.length || !sections.length) sections.push(current);
  return sections;
}
export function buildPolicySections(policy: TeamPolicyDocument, config?: AppraisalPolicyConfiguration) {
  return policy.contentSource === "reviews-settings" ? (config ? buildAppraisalPolicySections(config) : []) : buildStaticPolicySections(policy);
}
