export type TeamPolicyDocument = {
  id: string;
  title: string;
  shortTitle: string;
  category: string;
  version: string;
  description: string;
  kind: "pdf" | "appraisal" | "external";
  file?: string;
  externalUrl?: string;
  tone: "blue" | "violet" | "cyan" | "emerald" | "amber";
};

// Add future documents here; the policy library and viewer render from this source.
export const TEAM_POLICY_DOCUMENTS: TeamPolicyDocument[] = [
  {
    id: "code-of-conduct",
    title: "Code of Conduct",
    shortTitle: "Conduct",
    category: "HR Policy",
    version: "1.1",
    description: "Standards for professional conduct, integrity, workplace behaviour, and accountability.",
    kind: "pdf",
    file: "/policies/code-of-conduct-v1.1.pdf",
    tone: "blue",
  },
  {
    id: "non-disclosure-agreement",
    title: "Non-Disclosure Agreement (NDA)",
    shortTitle: "NDA",
    category: "Legal",
    version: "1.1",
    description: "Confidentiality obligations covering company, client, employee, and business information.",
    kind: "pdf",
    file: "/policies/non-disclosure-agreement-v1.1.pdf",
    tone: "violet",
  },
  {
    id: "acceptable-usage-policy",
    title: "Acceptable Usage Policy (AUP)",
    shortTitle: "AUP",
    category: "IT Policy",
    version: "1.1",
    description: "Responsible and secure use of company systems, devices, networks, and information assets.",
    kind: "pdf",
    file: "/policies/acceptable-usage-policy-v1.1.pdf",
    tone: "cyan",
  },
  {
    id: "appraisal-policy",
    title: "Appraisal Policy",
    shortTitle: "Appraisal",
    category: "Performance",
    version: "1.0",
    description: "Transparent annual scoring, billable-utilization targets, recognition, penalties, eligibility, and review stages.",
    kind: "appraisal",
    tone: "emerald",
  },
  {
    id: "roles-and-responsibilities",
    title: "Roles and Responsibilities",
    shortTitle: "Roles",
    category: "People Operations",
    version: "Live",
    description: "The current role expectations and responsibility framework maintained by Despacho.",
    kind: "external",
    externalUrl: "https://drive.google.com/file/d/1si77xhL2t1h6jpAMB2WXTYZqxtLOVWqW/view?usp=sharing",
    tone: "amber",
  },
];
