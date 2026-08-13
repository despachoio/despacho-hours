import { buildEmailHtml, escapeHtml } from "../template";

export function buildPayslipEmail(input: { companyName: string; businessEmail: string; website: string; employeeName: string; payrollMonth: string; portalUrl: string; passwordRuleDescription: string; body: string }) {
  return buildEmailHtml({
    companyName: input.companyName, businessEmail: input.businessEmail, website: input.website,
    eyebrow: "Payroll", title: `Salary Slip · ${input.payrollMonth}`,
    introHtml: `<div style="white-space:pre-line;font-size:14px;line-height:1.75;color:#334155;">${escapeHtml(input.body)}</div>`,
    status: { label: "Available", tone: "green" },
    details: [{ label: "Employee", value: input.employeeName }, { label: "Payroll Month", value: input.payrollMonth }, { label: "PDF Password", value: input.passwordRuleDescription }],
    cta: { label: "Open Payroll History", url: input.portalUrl },
    preheader: `Your salary slip for ${input.payrollMonth} is available.`,
  });
}
