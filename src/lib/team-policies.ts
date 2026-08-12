export type TeamPolicyDocument = {
  id: string;
  title: string;
  shortTitle: string;
  category: string;
  version: string;
  description: string;
  file: string;
  tone: "blue" | "violet" | "cyan";
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
    file: "/policies/acceptable-usage-policy-v1.1.pdf",
    tone: "cyan",
  },
];
