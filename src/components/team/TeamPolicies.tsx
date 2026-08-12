"use client";

import { useState } from "react";
import { TEAM_POLICY_DOCUMENTS, type TeamPolicyDocument } from "@/lib/team-policies";

const tones = {
  blue: { accent: "from-[#153E90] to-blue-500", icon: "bg-blue-50 text-[#153E90]", badge: "bg-blue-50 text-[#153E90]" },
  violet: { accent: "from-violet-600 to-fuchsia-400", icon: "bg-violet-50 text-violet-700", badge: "bg-violet-50 text-violet-700" },
  cyan: { accent: "from-cyan-600 to-sky-400", icon: "bg-cyan-50 text-cyan-700", badge: "bg-cyan-50 text-cyan-700" },
};

function DocumentIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6"><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></svg>;
}

export default function TeamPolicies() {
  const [viewing, setViewing] = useState<TeamPolicyDocument | null>(null);
  return <div className="space-y-6">
    <section className="overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 px-7 py-7 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[#153E90]">People knowledge centre</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">HR Policies</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Read the current Despacho workplace, confidentiality, and technology policies from one controlled document library.</p>
    </section>
    <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
      {TEAM_POLICY_DOCUMENTS.map((policy) => { const tone = tones[policy.tone]; return <article key={policy.id} className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_-34px_rgba(15,23,42,.45)] transition hover:-translate-y-0.5 hover:shadow-lg">
        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tone.accent}`}/>
        <div className="flex items-start justify-between gap-4"><span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone.icon}`}><DocumentIcon/></span><span className={`rounded-full px-3 py-1 text-xs font-bold ${tone.badge}`}>v{policy.version}</span></div>
        <p className="mt-6 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">{policy.category}</p>
        <h3 className="mt-2 text-xl font-bold text-slate-950">{policy.title}</h3>
        <p className="mt-3 min-h-16 text-sm leading-6 text-slate-500">{policy.description}</p>
        <div className="mt-6 flex gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={() => setViewing(policy)} className="rounded-xl bg-[#153E90] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0B2C68]">View</button><a href={policy.file} download className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:text-[#153E90]">Download</a></div>
      </article>; })}
    </div>
    {viewing ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6"><div role="dialog" aria-modal="true" aria-label={`${viewing.title} document viewer`} className="flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#153E90]">{viewing.category} · Version {viewing.version}</p><h3 className="mt-1 font-bold text-slate-950">{viewing.title}</h3></div><div className="flex items-center gap-2"><a href={viewing.file} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600">Print / Open</a><a href={viewing.file} download className="rounded-xl bg-[#153E90] px-3 py-2 text-sm font-bold text-white">Download</a><button type="button" aria-label="Close policy viewer" onClick={() => setViewing(null)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xl text-slate-500">×</button></div></header><iframe name="policy-pdf-viewer" title={viewing.title} src={`${viewing.file}#view=FitH&toolbar=1&navpanes=1`} className="min-h-0 flex-1 bg-slate-100"/></div></div> : null}
  </div>;
}
