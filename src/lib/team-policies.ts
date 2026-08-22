import { AUP_TEXT, CODE_OF_CONDUCT_TEXT, NDA_TEXT, ROLES_AND_RESPONSIBILITIES_TEXT } from "@/lib/team-policy-static-content";
import type { PerformanceMetric, PerformanceSettings, UtilizationPolicy } from "@/lib/performance/types";

export type PolicyTone = "blue" | "violet" | "cyan" | "emerald" | "amber" | "rose";
export type AppraisalPolicyConfiguration = { policies: UtilizationPolicy[]; metrics: PerformanceMetric[]; settings: PerformanceSettings };
export type TeamPolicyDocument = { id: string; slug: string; title: string; shortTitle: string; category: string; version: string; effectiveDate: string; lastUpdated?: string; description: string; contentSource: "static" | "reviews-settings"; sourceText?: string; downloadable: true; tone: PolicyTone };
export type PolicyTable = { columns: string[]; rows: Array<Array<string | number>> };
export type PolicyBlock =
  | { type: "heading"; text: string; level: 2 | 3; number?: number }
  | { type: "paragraph"; text: string; emphasis?: "strong" }
  | { type: "ordered-list"; items: string[] }
  | { type: "unordered-list"; items: string[] }
  | { type: "callout"; text: string; tone?: "info" | "warning" }
  | { type: "table"; table: PolicyTable }
  | { type: "acknowledgement"; title: string; fields: string[] }
  | { type: "spacer"; size: "sm" | "md" };
export type StructuredPolicyDocument = TeamPolicyDocument & { blocks: PolicyBlock[] };

const EXIT_POLICY_BLOCKS: PolicyBlock[] = [
  { type: "heading", level: 2, text: "During the Initial Term" },
  { type: "ordered-list", items: ["The Employee may terminate the employment by providing Thirty (30) days prior written notice of his/her intention to terminate the employment; or", "Despacho India Private Limited (henceforth Despacho) may terminate the employment by providing the employee with at least five (5) days prior written notice of its intention to terminate the employment."] },
  { type: "heading", level: 2, text: "Following the Initial Term" },
  { type: "ordered-list", items: ["The employee may terminate the employment by giving the other party at least Sixty (60) days prior written notice of his/her intention to terminate the employment; or", "Despacho India Private Limited (henceforth Despacho) may terminate the employment by providing the employee with at least five (5) days prior written notice of its intention to terminate the employment."] },
  { type: "heading", level: 2, text: "Termination" },
  { type: "paragraph", text: "Despacho may terminate the employment forthwith and without prior notice on the occurrence of a material breach of the internal policies, as determined by Despacho in its sole discretion, which shall include, but is not limited to, one or more of the following events where the employee:" },
  { type: "unordered-list", items: ["commits an act of insolvency, is adjudged insolvent, applies to be adjudged an insolvent or makes any compromise or arrangement with his creditors", "violates Despacho’s policies or procedures", "fails to comply with all applicable legislation, regulations or rules in providing his services", "fails or refuses to comply with any instruction or direction lawfully given by Despacho", "fails to perform or otherwise breaches any of his obligations under the agreement / internal policies", "engages in conduct that brings Despacho in or to material public disgrace or disrepute", "performs the services in an incompetent manner or fails to provide the expertise required under the agreement", "commits an act of dishonesty, breach of trust or fraud", "fails or is unable to perform the services for any reason; or", "fails to provide services for a period greater than 5 working days without the prior approval and consent of Despacho"] },
  { type: "paragraph", text: "Upon the termination of the employment for any reason whatsoever, Despacho is not obligated to make any payment to the employee other than that owing to the employee for services provided by the employee up to the date of such termination plus any reimbursement for any pre-approved expenses incurred by the employee as provided under the agreement." },
  { type: "paragraph", text: "For greater certainty, no severance payment, termination fee or similar compensation shall be paid to the employee upon termination of the agreement or internal policies." },
  { type: "paragraph", text: "Upon the termination of the agreement or internal policies, the contractor shall forthwith return to Despacho all of Despacho’s confidential information, computer and its accessories, all copies thereof, any related material including without limitation, memoranda, notes and documents containing extracts or reproductions of proprietary information, all copies thereof, and all other property of Despacho in the employee's possession or control." },
];

export const TEAM_POLICY_DOCUMENTS: TeamPolicyDocument[] = [
  { id: "code-of-conduct", slug: "code-of-conduct", title: "Code of Conduct", shortTitle: "Conduct", category: "HR Policy", version: "1.1", effectiveDate: "1 September 2019", lastUpdated: "1 September 2019", description: "Standards for professional conduct, integrity, workplace behaviour, and accountability.", contentSource: "static", sourceText: CODE_OF_CONDUCT_TEXT, downloadable: true, tone: "blue" },
  { id: "non-disclosure-agreement", slug: "non-disclosure-agreement", title: "Non-Disclosure Agreement (NDA)", shortTitle: "NDA", category: "Legal", version: "1.1", effectiveDate: "1 September 2019", lastUpdated: "1 September 2019", description: "Confidentiality obligations covering company, client, employee, and business information.", contentSource: "static", sourceText: NDA_TEXT, downloadable: true, tone: "violet" },
  { id: "acceptable-usage-policy", slug: "acceptable-usage-policy", title: "Acceptable Usage Policy (AUP)", shortTitle: "AUP", category: "IT / Security", version: "1.1", effectiveDate: "1 September 2019", lastUpdated: "1 September 2019", description: "Approved acknowledgement governing responsible use of company information systems.", contentSource: "static", sourceText: AUP_TEXT, downloadable: true, tone: "cyan" },
  { id: "annual-appraisal-policy", slug: "annual-appraisal-policy", title: "Annual Appraisal Policy", shortTitle: "Appraisal", category: "Performance", version: "Current", effectiveDate: "Current Reviews configuration", description: "Transparent annual scoring, billable-utilization targets, recognition, penalties, eligibility, and review stages.", contentSource: "reviews-settings", downloadable: true, tone: "emerald" },
  { id: "rewards-policy", slug: "rewards-policy", title: "Performance and Growth Rewards", shortTitle: "Rewards", category: "Rewards Policy", version: "1.0", effectiveDate: "Upon publication", description: "Annual client-retention, leadership, scale-up, and referral rewards recognising measurable business impact.", contentSource: "static", downloadable: true, tone: "amber" },
  { id: "roles-and-responsibilities", slug: "roles-and-responsibilities", title: "Roles and Responsibilities", shortTitle: "Roles", category: "People Operations", version: "1.0", effectiveDate: "Current", description: "The role expectations and responsibility framework maintained by Despacho.", contentSource: "static", sourceText: ROLES_AND_RESPONSIBILITIES_TEXT, downloadable: true, tone: "amber" },
  { id: "exit-policy", slug: "exit-policy", title: "Exit Policy", shortTitle: "Exit", category: "Employment / HR Policy", version: "1.0", effectiveDate: "Upon publication", description: "Notice periods, termination conditions, final obligations, and return of company property.", contentSource: "static", downloadable: true, tone: "rose" },
];

export function findTeamPolicy(slug: string) { return TEAM_POLICY_DOCUMENTS.find((policy) => policy.slug === slug) || null; }
const labelLevel = (value: UtilizationPolicy["level_group"]) => value === "level_1" ? "Level 1" : value === "level_2" ? "Level 2" : "Level 3+";
const policyValue = (value: number, suffix = "") => `${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}${suffix}`;

function appraisalBlocks(config: AppraisalPolicyConfiguration): PolicyBlock[] {
  const rules = config.settings.eligibility_rules || {};
  const policies = [...config.policies].sort((a, b) => a.level_group.localeCompare(b.level_group));
  const metrics = config.metrics.filter((metric) => metric.active).sort((a, b) => a.display_order - b.display_order);
  const categories = [...(config.settings.performance_categories || [])].sort((a, b) => b.minimumScore - a.minimumScore);
  return [
    { type: "heading", level: 2, text: "Purpose and scoring method" },
    { type: "paragraph", text: "The annual appraisal framework combines billable delivery, documented recognition, performance issues, and consistent eligibility controls." },
    { type: "callout", text: "Overall Score = Billable Utilization + Recognition − Penalties" },
    { type: "paragraph", text: "Actual Billable includes completed time-entry hours from every billable project in the review year, whether that project is active, inactive, or archived. Non-billable project hours are excluded." },
    { type: "heading", level: 2, text: "Utilization policy" },
    { type: "table", table: { columns: ["Level", "Expected", "Minimum", "Monthly hours", "Quarterly hours", "Annual hours"], rows: policies.map((policy) => [labelLevel(policy.level_group), policyValue(policy.expected_percent, "%"), policyValue(policy.minimum_percent, "%"), `${policyValue(policy.monthly_expected_hours)} expected / ${policyValue(policy.monthly_minimum_hours)} minimum`, `${policyValue(policy.quarterly_expected_hours)} expected / ${policyValue(policy.quarterly_minimum_hours)} minimum`, `${policyValue(policy.annual_expected_hours)} expected / ${policyValue(policy.annual_minimum_hours)} minimum`]) } },
    { type: "heading", level: 2, text: "Recognition and penalties" },
    { type: "paragraph", text: "Configured Reviews metrics apply to the relevant performance year when their qualification requirements are met." },
    { type: "table", table: { columns: ["Metric", "Type", "Score", "Client required"], rows: metrics.map((metric) => [metric.name, metric.category === "booster" ? "Recognition" : "Penalty", policyValue(Math.abs(metric.default_score_delta)), metric.requires_client ? "Yes" : "No"]) } },
    { type: "heading", level: 2, text: "Annual eligibility" },
    { type: "unordered-list", items: [`Minimum overall score: ${policyValue(Number(rules.minimumOverallScore ?? 80), "%")}`, `Maximum qualified client escalations: ${policyValue(Number(rules.maximumEscalations ?? 2))}`, "The employee must meet the minimum billable-hours threshold for their level.", "Critical policy conditions may affect eligibility even when the numeric score is met."] },
    { type: "heading", level: 2, text: "Performance categories" },
    { type: "table", table: { columns: ["Category", "Minimum score"], rows: categories.map((category) => [category.name, policyValue(category.minimumScore)]) } },
    { type: "heading", level: 2, text: "Review lifecycle and transparency" },
    { type: "unordered-list", items: ["Not started — live performance remains visible.", "Started — manager review and comments are in progress.", "Finalized — the approved calculation and policy version are frozen.", "Reopened — authorized administrators document a reason before changes.", "Employees can monitor their live annual performance and download their report. Managers can review direct reports. Super Admin and Finance Admin retain administrative review and audit controls."] },
  ];
}

function normalizeLegacyText(value: string, annexure: "A" | "B" | "C") {
  const artifact = new RegExp(`Annexure ${annexure}:[^\\n]*\\nVersion 1\\.1 - Sep 1, 2019[^\\n]*`, "gi");
  return value.replace(artifact, " ").replace(/\u000c/g, " ").replace(/[\t\n\r]+/g, " ").replace(/\s+/g, " ").trim();
}
function splitAtStarts(text: string, starts: string[]) {
  const positions = starts.map((start) => ({ start, index: text.indexOf(start) })).filter((item) => item.index >= 0).sort((a, b) => a.index - b.index);
  if (!positions.length) return text ? [text] : [];
  const parts: string[] = [];
  if (positions[0].index > 0) parts.push(text.slice(0, positions[0].index).trim());
  positions.forEach((item, index) => parts.push(text.slice(item.index, positions[index + 1]?.index ?? text.length).trim()));
  return parts.filter(Boolean);
}
function numberedSlices(text: string, headings: readonly string[]) {
  const markers = headings.map((heading, index) => `${index + 1}. ${heading}`);
  const positions = markers.map((marker, index) => ({ index: text.indexOf(marker), marker, number: index + 1, heading: headings[index] }));
  if (positions.some((item) => item.index < 0)) throw new Error("Approved policy section marker is missing.");
  return { introduction: text.slice(0, positions[0].index).trim(), sections: positions.map((item, index) => ({ number: item.number, heading: item.heading, body: text.slice(item.index + item.marker.length, positions[index + 1]?.index ?? text.length).trim() })) };
}

const CODE_HEADINGS = ["LEGAL/ REGULATORY COMPLIANCE", "BUSINESS INTERESTS", "CORPORATE OPPORTUNITIES", "FAIR DEALINGS AND EQUAL OPPORTUNITIES", "GIFTING AND ENTERTAINMENT", "HEALTH, SAFETY AND ENVIRONMENT", "COMPANY RECORDS", "CONFIDENTIALITY", "COMPANY RESOURCES", "COST CONSCIOUSNESS", "COMMUNICATIONS", "INTERACTION WITH MEDIA", "INTELLECTUAL PROPERTY RIGHTS", "POLITICAL CONTRIBUTIONS", "GOVERNMENT SUPPORT AND TAXES", "EMPLOYEE FEEDBACK MECHANISM", "TRAINING PROGRAM", "WHISTLE BLOWER / REPORTING OF UNACCEPTABLE BEHAVIOUR", "POLICY VIOLATION", "UNACCEPTABLE PERFORMANCE", "WORKPLACE HARASSMENT", "DISCIPLINARY ACTION"] as const;
function codeOfConductBlocks(): PolicyBlock[] {
  const { introduction, sections } = numberedSlices(normalizeLegacyText(CODE_OF_CONDUCT_TEXT, "A"), CODE_HEADINGS);
  const blocks: PolicyBlock[] = [{ type: "heading", level: 2, text: "Introduction" }, ...splitAtStarts(introduction, ["The purpose of this document", "It is the responsibility", "The company can make changes"]).map((text): PolicyBlock => ({ type: "paragraph", text }))];
  for (const section of sections) {
    blocks.push({ type: "heading", level: 2, number: section.number, text: section.heading.replace("LEGAL/", "LEGAL /") });
    if (section.number === 20) blocks.push({ type: "unordered-list", items: section.body.split(/\s*•\s*/).map((item) => item.trim()).filter(Boolean) });
    else blocks.push(...splitAtStarts(section.body, section.number === 5 ? ["Employees may however", "Employees may attend", "Regarding any gift"] : []).map((text): PolicyBlock => ({ type: "paragraph", text })));
  }
  return blocks;
}

const NDA_HEADINGS = ["Confidentiality", "Inventions, Copyrights and Patents", "Despacho Materials", "Non-raiding of Employee and clients", "No Interference", "Other Employment", "Miscellaneous"] as const;
function ndaBlocks(): PolicyBlock[] {
  const clean = normalizeLegacyText(NDA_TEXT, "B");
  const governingIndex = clean.indexOf("Governing Law:");
  if (governingIndex < 0) throw new Error("Approved NDA Governing Law clause is missing.");
  const { sections } = numberedSlices(clean.slice(0, governingIndex).trim(), NDA_HEADINGS);
  const starts: Record<number, string[]> = { 1: ["The employee shall", "The employee's agreement", "Despacho's confidential information"], 2: ["The employee will promptly", "The employee agrees", "At Despacho's direction", "\"Inventions\" mean", "\"Works\" mean"], 6: ["Any business opportunities", "The employee agrees, in the best interests"] };
  const blocks: PolicyBlock[] = [];
  for (const section of sections) {
    blocks.push({ type: "heading", level: 2, number: section.number, text: section.heading });
    for (const paragraph of splitAtStarts(section.body, starts[section.number] || [])) {
      if (paragraph.startsWith("\"Inventions\" mean")) blocks.push({ type: "heading", level: 3, text: "Definition: Inventions" });
      if (paragraph.startsWith("\"Works\" mean")) blocks.push({ type: "heading", level: 3, text: "Definition: Works" });
      blocks.push({ type: "paragraph", text: paragraph });
    }
  }
  blocks.push({ type: "heading", level: 2, text: "Governing Law" });
  blocks.push(...splitAtStarts(clean.slice(governingIndex + "Governing Law:".length).trim(), ["In any lawsuit arising"]).map((text): PolicyBlock => ({ type: "paragraph", text })));
  return blocks;
}

function aupBlocks(): PolicyBlock[] {
  const clean = normalizeLegacyText(AUP_TEXT, "C");
  const heading = "ACCEPTABLE USAGE POLICY - ACKNOWLEDGEMENT FORM";
  const headingIndex = clean.indexOf(heading), nameIndex = clean.indexOf("Name Accepted Date Signature"), noticeIndex = clean.indexOf("The information contained in this document is proprietary");
  if (headingIndex < 0 || nameIndex < 0 || noticeIndex < 0) throw new Error("Approved AUP acknowledgement structure is incomplete.");
  return [
    { type: "heading", level: 2, text: "Acknowledgement Form" },
    { type: "paragraph", text: clean.slice(0, headingIndex).trim() },
    ...splitAtStarts(clean.slice(headingIndex + heading.length, nameIndex).trim(), ["I understand", "I have been given", "I have read, clarified"]).map((text): PolicyBlock => ({ type: "paragraph", text })),
    { type: "acknowledgement", title: "Employee Acknowledgement", fields: ["Name", "Accepted Date", "Signature"] },
    { type: "callout", tone: "info", text: clean.slice(noticeIndex).trim() },
  ];
}

function rolesBlocks(): PolicyBlock[] {
  const lines = ROLES_AND_RESPONSIBILITIES_TEXT.split("\n").map((line) => line.trim()).filter(Boolean), blocks: PolicyBlock[] = [];
  let items: string[] = [];
  const flush = () => { if (items.length) blocks.push({ type: "unordered-list", items }); items = []; };
  for (const line of lines.slice(2)) { const match = line.match(/^(\d{1,2}[AB]?)\s+(.+)$/); if (match) { flush(); blocks.push({ type: "heading", level: 2, text: `Level ${match[1]} · ${match[2]}` }); } else items.push(line); }
  flush(); return blocks;
}

const REWARDS_POLICY_BLOCKS: PolicyBlock[] = [
  { type: "heading", level: 2, text: "Client Retention Bonus · Level 1–4" },
  { type: "paragraph", text: "The bonus applies to all active clients who have maintained their retention through the end of the year." },
  { type: "table", table: { columns: ["Annual billing hours", "Reward"], rows: [["More than 500 and less than 1,000 hours", "₹5,000"], ["More than 1,000 and less than 1,500 hours", "₹10,000"], ["More than 1,500 hours", "₹20,000"]] } },
  { type: "unordered-list", items: ["When multiple employees work under the same project code, the total billing hours are divided by the number of employees working on that project.", "Billing hours are not calculated for clients who ended their contract with the company on any day during the year."] },
  { type: "heading", level: 2, text: "Leadership Bonus · Level 5–7" },
  { type: "callout", text: "Leadership bonus: ₹30,000" },
  { type: "unordered-list", items: ["The team’s total utilization must be 90% or higher.", "There must be no client escalations or refunds.", "There must be no policy violation by any team member."] },
  { type: "heading", level: 2, text: "Client Growth Rewards" },
  { type: "table", table: { columns: ["Reward type", "Reward"], rows: [["Client Scale-up", "₹3,000 for every successful scale-up"], ["Client Referral", "₹3,000 for every successful referral"]] } },
  { type: "callout", text: "When more than one employee works for the client during the scale-up or referral period, the reward is divided among those employees." },
  { type: "paragraph", text: "The rewards amount will be transferred directly to the VA’s bank account along with wages." },
];

const STATIC_BLOCKS: Record<string, PolicyBlock[]> = { "code-of-conduct": codeOfConductBlocks(), "non-disclosure-agreement": ndaBlocks(), "acceptable-usage-policy": aupBlocks(), "rewards-policy": REWARDS_POLICY_BLOCKS, "roles-and-responsibilities": rolesBlocks(), "exit-policy": EXIT_POLICY_BLOCKS };

export function validateStructuredPolicy(policy: StructuredPolicyDocument) {
  for (const field of [policy.title, policy.category, policy.version]) if (!field.trim()) throw new Error(`Policy ${policy.id} has incomplete metadata.`);
  if (!policy.blocks.length) throw new Error(`Policy ${policy.id} has no content blocks.`);
  for (const block of policy.blocks) {
    if (!(["heading", "paragraph", "ordered-list", "unordered-list", "callout", "table", "acknowledgement", "spacer"] as string[]).includes(block.type)) throw new Error(`Policy ${policy.id} contains an unsupported block.`);
    if ((block.type === "ordered-list" || block.type === "unordered-list") && !block.items.length) throw new Error(`Policy ${policy.id} contains an empty list.`);
    if (block.type === "table" && (!block.table.columns.length || block.table.rows.some((row) => row.length !== block.table.columns.length))) throw new Error(`Policy ${policy.id} contains an invalid table.`);
  }
  return policy;
}
export function buildPolicyDocument(policy: TeamPolicyDocument, config?: AppraisalPolicyConfiguration): StructuredPolicyDocument {
  const { sourceText: _approvedSource, ...metadata } = policy;
  void _approvedSource;
  const resolved = policy.contentSource === "reviews-settings" && config ? { ...metadata, version: String(config.settings.policy_version) } : metadata;
  const blocks = policy.contentSource === "reviews-settings" ? (config ? appraisalBlocks(config) : []) : (STATIC_BLOCKS[policy.id] || []);
  return validateStructuredPolicy({ ...resolved, blocks });
}
export const buildPolicySections = (policy: TeamPolicyDocument, config?: AppraisalPolicyConfiguration) => buildPolicyDocument(policy, config).blocks;
export const buildAppraisalPolicySections = appraisalBlocks;
