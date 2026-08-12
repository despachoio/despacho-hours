"use client";

import { useState, type ReactNode } from "react";

type PolicySection = {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  tone: "blue" | "emerald" | "violet" | "amber" | "rose" | "cyan";
  content: ReactNode;
};

const toneClasses = {
  blue: "from-[#153E90] to-blue-500 bg-blue-50 text-[#153E90] border-blue-100",
  emerald: "from-emerald-600 to-teal-400 bg-emerald-50 text-emerald-800 border-emerald-100",
  violet: "from-violet-600 to-fuchsia-400 bg-violet-50 text-violet-800 border-violet-100",
  amber: "from-amber-500 to-orange-400 bg-amber-50 text-amber-800 border-amber-100",
  rose: "from-rose-600 to-pink-400 bg-rose-50 text-rose-800 border-rose-100",
  cyan: "from-cyan-600 to-sky-400 bg-cyan-50 text-cyan-800 border-cyan-100",
} as const;

function PolicyIcon({ name }: { name: "shield" | "calendar" | "wallet" | "calculator" | "flow" | "gift" }) {
  const paths: Record<typeof name, ReactNode> = {
    shield: <><path d="M12 3 5 6v5c0 4.5 2.8 7.8 7 10 4.2-2.2 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    wallet: <><path d="M4 6h14a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3h12"/><path d="M15 12h5v4h-5a2 2 0 0 1 0-4Z"/></>,
    calculator: <><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4"/></>,
    flow: <><circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M9 6h5a4 4 0 0 1 4 4v5M15 18H9a3 3 0 0 1-3-3V9"/></>,
    gift: <><rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12M3 13h18M7.5 9C5 9 4 7.5 4.8 6.2 6.2 4 10 6 12 9M16.5 9C19 9 20 7.5 19.2 6.2 17.8 4 14 6 12 9"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">{paths[name]}</svg>;
}

function BulletList({ children }: { children: ReactNode }) {
  return <ul className="space-y-2 text-sm leading-6 text-slate-600">{children}</ul>;
}

function Bullet({ children }: { children: ReactNode }) {
  return <li className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#153E90]"/><span>{children}</span></li>;
}

function RuleCard({ title, value, detail }: { title: string; value?: string; detail: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_-26px_rgba(15,23,42,.5)]"><p className="text-xs font-bold uppercase tracking-[.14em] text-slate-400">{title}</p>{value ? <p className="mt-2 text-xl font-bold text-[#153E90]">{value}</p> : null}<p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p></div>;
}

function RewardTier({ hours, reward }: { hours: string; reward: string }) {
  return <div className="flex flex-col justify-between gap-2 rounded-2xl border border-amber-200 bg-white/90 p-4 sm:flex-row sm:items-center"><span className="text-sm font-semibold text-slate-700">{hours}</span><span className="whitespace-nowrap rounded-full bg-amber-100 px-3 py-1.5 text-sm font-bold text-amber-800">{reward}</span></div>;
}

const sections: PolicySection[] = [
  {
    id: "governance",
    eyebrow: "Governance & confidentiality",
    title: "Payroll Access and Records",
    summary: "Payroll administration is restricted, auditable, and separated from employee self-service.",
    tone: "blue",
    content: <BulletList><Bullet>Finance Admin controls salary structures, payroll processing, recurring adjustments, payroll reports, and payroll settings.</Bullet><Bullet>Employees can access only their own published salary slips, payroll history, YTD statements, and this policy.</Bullet><Bullet>Payroll mutations are recorded in the payroll audit log with the acting user, role, timestamp, and before/after values where applicable.</Bullet><Bullet>Published payroll is treated as an immutable payroll-month snapshot.</Bullet></BulletList>,
  },
  {
    id: "period",
    eyebrow: "Payroll calendar",
    title: "Processing Period and Financial Year",
    summary: "Payroll periods and reports follow the configured company cycle and Indian financial year.",
    tone: "cyan",
    content: <div className="grid gap-3 sm:grid-cols-2"><RuleCard title="Default payroll period" value="26th – 25th" detail="The default payroll period starts on the 26th of the previous month and ends on the 25th of the payroll month. Finance settings may define the configured start and end days."/><RuleCard title="Financial year" value="April – March" detail="Payroll history, reporting, salary slips, and YTD statements follow the selected Indian financial year."/></div>,
  },
  {
    id: "structure",
    eyebrow: "Compensation foundation",
    title: "Salary Structure Policy",
    summary: "Every payroll calculation uses the salary structure effective for that payroll month.",
    tone: "violet",
    content: <BulletList><Bullet>Salary structures are effective-dated and version controlled; only one structure may begin for an employee on the same effective date.</Bullet><Bullet>Basic Pay defaults to 50% of gross salary. For gross salary up to ₹16,800, Basic Pay defaults to ₹15,000.</Bullet><Bullet>HRA defaults to 40% of Basic Pay when gross salary is above ₹16,800; otherwise it defaults to zero.</Bullet><Bullet>Conveyance Allowance follows the configured payroll value, with ₹1,600 as the system default.</Bullet><Bullet>Other Allowance is the balancing component: Gross Salary − Basic Pay − HRA − Conveyance Allowance.</Bullet><Bullet>Editing a salary structure never rewrites payroll snapshots that have already been generated.</Bullet></BulletList>,
  },
  {
    id: "calculation",
    eyebrow: "Earnings & deductions",
    title: "Payroll Calculation Rules",
    summary: "Gross pay, statutory amounts, adjustments, and net salary use consistent payroll formulas.",
    tone: "emerald",
    content: <div className="grid gap-3 sm:grid-cols-2"><RuleCard title="Gross Pay" detail="Gross Salary + Bonus + Leave Encashment."/><RuleCard title="Total Deductions" detail="Employee PF + Professional Tax + LOP + Adjustment + TDS."/><RuleCard title="Net Salary" detail="Gross Pay − Total Deductions, with the result never falling below zero."/><RuleCard title="EPF salary" detail="The lower of Basic Pay and ₹15,000, unless an approved salary structure provides a specific value."/><RuleCard title="Employee PF" detail="12% of EPF salary by default."/><RuleCard title="Employer EPS and PF" detail="EPS is 8.33% of EPF salary, capped at ₹1,250. Employer PF is the balance of the employer contribution after EPS."/><RuleCard title="Professional Tax" detail="Applied using the threshold and amount configured in Payroll Settings. The system defaults are ₹25,000 and ₹200."/><RuleCard title="LOP" detail="Recommended LOP is Gross Salary ÷ payroll-period days × approved LOP days. Finance confirms the deduction during payroll processing."/></div>,
  },
  {
    id: "processing",
    eyebrow: "Controlled month end",
    title: "Payroll Processing and Adjustments",
    summary: "Payroll progresses through controlled stages and preserves approved month-specific decisions.",
    tone: "rose",
    content: <BulletList><Bullet>Payroll is generated from the applicable salary structure, approved leave/LOP records, recurring adjustments, and month-specific inputs.</Bullet><Bullet>Finance may edit Bonus, Leave Encashment, LOP, Adjustment, and TDS only while payroll remains generated or under review.</Bullet><Bullet>Recurring Bonus and TDS rules apply only within their enabled effective period. A month-specific override is preserved if that month is reprocessed.</Bullet><Bullet>Lifecycle: Generated → Approved → Submitted. Submitted payroll is published to employee self-service and is no longer editable.</Bullet><Bullet>Bank-transfer export is available only after payroll approval and uses the configured payroll bank account and employee bank details.</Bullet></BulletList>,
  },
  {
    id: "rewards",
    eyebrow: "Rewards policy",
    title: "Performance and Growth Rewards",
    summary: "Annual retention, leadership, scale-up, and referral rewards recognise measurable business impact.",
    tone: "amber",
    content: <div className="space-y-6">
      <div><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">Client Retention Bonus</h3><p className="mt-1 text-sm text-slate-500">Applicable to Level 1–4 employees.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#153E90]">Annual assessment</span></div><p className="mt-4 text-sm leading-6 text-slate-600">The bonus applies to active clients that have maintained their retention through the end of the year.</p><div className="mt-4 grid gap-3"><RewardTier hours="More than 500 and less than 1,000 billing hours" reward="₹5,000"/><RewardTier hours="More than 1,000 and less than 1,500 billing hours" reward="₹10,000"/><RewardTier hours="More than 1,500 billing hours" reward="₹20,000"/></div><div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-slate-700"><strong className="text-[#153E90]">Allocation rule:</strong> When multiple employees work under the same project code, total billing hours are divided by the number of employees working on that project. Billing hours are excluded for clients that ended their contract with the company on any day during the year.</div></div>
      <div className="border-t border-slate-200 pt-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-slate-900">Leadership Bonus</h3><p className="mt-1 text-sm text-slate-500">Applicable to Level 5–7 employees.</p></div><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-bold text-emerald-800">₹30,000</span></div><BulletList><Bullet>The team’s total utilisation must be 90% or higher.</Bullet><Bullet>There must be no client escalations or refunds.</Bullet><Bullet>There must be no policy violation by any team member.</Bullet></BulletList></div>
      <div className="grid gap-4 border-t border-slate-200 pt-6 md:grid-cols-2"><RuleCard title="Client Scale-ups" value="₹3,000" detail="Awarded for every successful client scale-up."/><RuleCard title="Client Referral" value="₹3,000" detail="Awarded for every successful client referral."/></div>
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5 text-sm leading-6 text-slate-700"><p><strong className="text-amber-900">Shared contribution:</strong> When more than one employee works for the client during the scale-up or referral period, the reward is divided among those employees.</p><p className="mt-2"><strong className="text-amber-900">Payment:</strong> Rewards are transferred directly to the VA’s bank account along with wages.</p></div>
    </div>,
  },
];

const sectionIcons: Record<string, Parameters<typeof PolicyIcon>[0]["name"]> = { governance: "shield", period: "calendar", structure: "wallet", calculation: "calculator", processing: "flow", rewards: "gift" };

export default function PayrollPolicy() {
  const [openSections, setOpenSections] = useState(() => new Set(["governance", "rewards"]));

  function toggle(id: string) {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return <div className="space-y-6">
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0F172A] via-[#172554] to-[#153E90] px-7 py-8 text-white shadow-xl"><div className="absolute -right-10 -top-20 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl"/><div className="relative max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.22em] text-cyan-200">Payroll knowledge centre</p><h2 className="mt-3 text-3xl font-bold tracking-tight">Payroll Policy</h2><p className="mt-3 text-sm leading-7 text-blue-100">A clear guide to payroll periods, salary calculations, statutory deductions, processing controls, employee access, and Despacho’s rewards policy.</p><div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold">Visible to everyone</span><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold">April–March financial year</span><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold">Last reviewed August 2026</span></div></div></section>
    <div className="grid gap-4 xl:grid-cols-2">{sections.map((section) => { const open = openSections.has(section.id); const tone = toneClasses[section.tone]; return <section key={section.id} className={`relative overflow-hidden rounded-3xl border bg-white shadow-[0_18px_45px_-34px_rgba(15,23,42,.4)] ${tone.split(" ").at(-1)}`}><div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tone.split(" ").slice(0, 2).join(" ")}`}/><button type="button" aria-expanded={open} aria-controls={`payroll-policy-${section.id}`} onClick={() => toggle(section.id)} className="flex w-full items-start justify-between gap-4 p-6 text-left transition hover:bg-slate-50/70"><div className="flex min-w-0 gap-4"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone.split(" ").slice(2, 4).join(" ")}`}><PolicyIcon name={sectionIcons[section.id]}/></span><span><span className="block text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">{section.eyebrow}</span><span className="mt-2 block text-xl font-bold text-slate-950">{section.title}</span><span className="mt-2 block text-sm leading-6 text-slate-500">{section.summary}</span></span></div><span className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg font-bold text-slate-500 transition ${open ? "rotate-180" : ""}`}>⌄</span></button>{open ? <div id={`payroll-policy-${section.id}`} className="border-t border-slate-100 bg-slate-50/45 p-6">{section.content}</div> : null}</section>; })}</div>
    <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm leading-6 text-slate-500"><strong className="text-slate-800">Policy administration:</strong> Payroll calculations follow approved salary structures and payroll settings recorded in Kairo. Any formally approved policy amendment must be configured by Finance Admin before it affects payroll processing.</section>
  </div>;
}
