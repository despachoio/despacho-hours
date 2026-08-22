"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  TEAM_POLICY_DOCUMENTS,
  buildPolicyDocument,
  type AppraisalPolicyConfiguration,
  type PolicyBlock,
  type StructuredPolicyDocument,
  type TeamPolicyDocument,
} from "@/lib/team-policies";

const tones = {
  blue: { accent: "from-[#153E90] to-blue-500", icon: "bg-blue-50 text-[#153E90]", badge: "bg-blue-50 text-[#153E90]" },
  violet: { accent: "from-violet-600 to-fuchsia-400", icon: "bg-violet-50 text-violet-700", badge: "bg-violet-50 text-violet-700" },
  cyan: { accent: "from-cyan-600 to-sky-400", icon: "bg-cyan-50 text-cyan-700", badge: "bg-cyan-50 text-cyan-700" },
  emerald: { accent: "from-emerald-600 to-teal-400", icon: "bg-emerald-50 text-emerald-700", badge: "bg-emerald-50 text-emerald-700" },
  amber: { accent: "from-amber-500 to-orange-400", icon: "bg-amber-50 text-amber-700", badge: "bg-amber-50 text-amber-700" },
  rose: { accent: "from-rose-600 to-pink-400", icon: "bg-rose-50 text-rose-700", badge: "bg-rose-50 text-rose-700" },
};

function DocumentIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6"><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></svg>;
}
function DownloadIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg>;
}

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

function PolicyTable({ table }: { table: Extract<PolicyBlock, { type: "table" }>["table"] }) {
  return <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
    <table className="w-full min-w-[660px] text-left text-sm">
      <thead className="bg-[#0F172A] text-xs uppercase tracking-wide text-slate-200"><tr>{table.columns.map((column) => <th key={column} className="px-4 py-3">{column}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{table.rows.map((row, index) => <tr key={index} className={index % 2 ? "bg-slate-50/80" : "bg-white"}>{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 align-top text-slate-700">{cell}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}

function PolicyBlockView({ block }: { block: PolicyBlock }) {
  switch (block.type) {
    case "heading": return block.level === 2
      ? <h4 className="mt-8 border-b border-blue-100 pb-3 text-xl font-bold text-[#153E90] first:mt-0">{block.number ? `${block.number}. ` : ""}{block.text}</h4>
      : <h5 className="mt-6 text-base font-bold text-slate-900">{block.text}</h5>;
    case "paragraph": return <p className={`mt-4 whitespace-pre-wrap text-[15px] leading-7 text-slate-600 ${block.emphasis === "strong" ? "font-semibold" : ""}`}>{block.text}</p>;
    case "ordered-list": return <ol className="mt-4 list-decimal space-y-3 pl-7 text-[15px] leading-7 text-slate-600">{block.items.map((item, index) => <li key={index} className="pl-2">{item}</li>)}</ol>;
    case "unordered-list": return <ul className="mt-4 space-y-3">{block.items.map((item, index) => <li key={index} className="flex gap-3 text-[15px] leading-7 text-slate-600"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#153E90]"/><span>{item}</span></li>)}</ul>;
    case "callout": return <aside className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 px-5 py-4 text-sm font-medium leading-6 text-slate-700">{block.text}</aside>;
    case "table": return <PolicyTable table={block.table}/>;
    case "acknowledgement": return <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5"><h5 className="font-bold text-[#153E90]">{block.title}</h5><div className="mt-5 grid gap-5 sm:grid-cols-3">{block.fields.map((field) => <div key={field}><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{field}</p><div className="mt-5 border-b border-slate-400"/></div>)}</div></section>;
    case "spacer": return <div className={block.size === "md" ? "h-6" : "h-3"}/>;
  }
}

function PolicyContent({ document }: { document: StructuredPolicyDocument }) {
  return <article className="mx-auto max-w-6xl rounded-3xl border border-slate-200 bg-white px-6 py-7 shadow-sm sm:px-10 sm:py-9">
    <p className="max-w-4xl text-sm leading-6 text-slate-500">{document.description}</p>
    <div className="mt-7">{document.blocks.map((block, index) => <PolicyBlockView key={`${block.type}-${index}`} block={block}/>)}</div>
  </article>;
}

function PolicyCard({ policy, onRead, onDownload, downloading }: { policy: TeamPolicyDocument; onRead: () => void; onDownload: () => void; downloading: boolean }) {
  const tone = tones[policy.tone];
  return <article className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_-34px_rgba(15,23,42,.45)] transition hover:-translate-y-0.5 hover:shadow-lg">
    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tone.accent}`}/>
    <div className="flex items-start justify-between gap-4"><span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone.icon}`}><DocumentIcon/></span><span className={`rounded-full px-3 py-1 text-xs font-bold ${tone.badge}`}>{policy.version === "Current" ? "Current" : `v${policy.version}`}</span></div>
    <p className="mt-6 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">{policy.category}</p>
    <h3 className="mt-2 text-xl font-bold text-slate-950">{policy.title}</h3>
    <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-3 text-xs"><div><dt className="text-slate-400">Version</dt><dd className="mt-1 font-bold text-slate-700">{policy.version}</dd></div><div><dt className="text-slate-400">{policy.lastUpdated ? "Last updated" : "Effective"}</dt><dd className="mt-1 font-bold text-slate-700">{policy.lastUpdated || policy.effectiveDate}</dd></div></dl>
    <p className="mt-4 min-h-16 text-sm leading-6 text-slate-500">{policy.description}</p>
    <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
      <button type="button" onClick={onRead} className="rounded-xl bg-[#153E90] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0B2C68]">Read Policy</button>
      <button type="button" onClick={onDownload} disabled={downloading} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-[#153E90] transition hover:bg-blue-50 disabled:cursor-wait disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"><DownloadIcon/>{downloading ? "Downloading…" : "Download PDF"}</button>
    </div>
  </article>;
}

export default function TeamPolicies() {
  const searchParams = useSearchParams();
  const [viewing, setViewing] = useState<TeamPolicyDocument | null>(() => {
    const requested = searchParams.get("policy");
    return TEAM_POLICY_DOCUMENTS.find((item) => item.slug === requested) || null;
  });
  const [configuration, setConfiguration] = useState<AppraisalPolicyConfiguration | null>(null);
  const [loadingPolicy, setLoadingPolicy] = useState(false);
  const [downloading, setDownloading] = useState("");
  const [error, setError] = useState("");

  const loadConfiguration = useCallback(async () => {
    if (configuration) return configuration;
    const accessToken = await token();
    if (!accessToken) throw new Error("Your session has expired.");
    const response = await fetch("/api/workforce/policies/config", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    const result = await response.json() as AppraisalPolicyConfiguration & { error?: string };
    if (!response.ok) throw new Error(result.error || "Unable to load current appraisal policy settings.");
    setConfiguration(result);
    return result;
  }, [configuration]);

  const openPolicy = useCallback(async (policy: TeamPolicyDocument) => {
    setError("");
    setViewing(policy);
    if (policy.contentSource === "reviews-settings" && !configuration) {
      setLoadingPolicy(true);
      try { await loadConfiguration() } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load this policy."); }
      finally { setLoadingPolicy(false); }
    }
  }, [configuration, loadConfiguration]);

  const downloadPolicy = useCallback(async (policy: TeamPolicyDocument) => {
    if (downloading) return;
    setDownloading(policy.id);
    setError("");
    try {
      const accessToken = await token();
      if (!accessToken) throw new Error("Your session has expired.");
      const response = await fetch(`/api/workforce/policies/${policy.slug}/pdf`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) { const result = await response.json() as { error?: string }; throw new Error(result.error || "Unable to download this policy."); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = `${policy.slug}.pdf`; link.click(); URL.revokeObjectURL(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to download this policy."); }
    finally { setDownloading(""); }
  }, [downloading]);

  useEffect(() => {
    if (!viewing) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setViewing(null) };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [viewing]);

  const displayPolicy = useMemo(() => viewing && configuration && viewing.contentSource === "reviews-settings" ? { ...viewing, version: String(configuration.settings.policy_version) } : viewing, [configuration, viewing]);
  const policyDocument = useMemo(() => displayPolicy ? buildPolicyDocument(displayPolicy, configuration || undefined) : null, [displayPolicy, configuration]);

  return <div className="space-y-6">
    <section className="overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 px-7 py-7 shadow-sm"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#153E90]">People knowledge centre</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Workforce Policies</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Read and download Despacho workplace, performance, employment, confidentiality, technology, and role guidance from one controlled internal library.</p></section>
    {error && !viewing ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
    <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">{TEAM_POLICY_DOCUMENTS.map((policy) => <PolicyCard key={policy.id} policy={policy} onRead={() => void openPolicy(policy)} onDownload={() => void downloadPolicy(policy)} downloading={downloading === policy.id}/>)}</div>
    {displayPolicy ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.currentTarget === event.target) setViewing(null) }}>
      <div role="dialog" aria-modal="true" aria-label={`${displayPolicy.title} policy viewer`} className="flex h-[94vh] w-full max-w-[1440px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#153E90]">{displayPolicy.category} · Version {displayPolicy.version}</p><h3 className="mt-1 text-xl font-bold text-slate-950">{displayPolicy.title}</h3><p className="mt-1 text-xs text-slate-500">Effective: {displayPolicy.effectiveDate}{displayPolicy.lastUpdated ? ` · Last updated: ${displayPolicy.lastUpdated}` : ""}</p></div>
          <div className="flex items-center gap-2"><button type="button" onClick={() => void downloadPolicy(displayPolicy)} disabled={downloading === displayPolicy.id} className="inline-flex items-center gap-2 rounded-xl bg-[#153E90] px-3 py-2 text-sm font-bold text-white disabled:bg-slate-300"><DownloadIcon/>{downloading === displayPolicy.id ? "Downloading…" : "Download PDF"}</button><button type="button" aria-label="Close policy viewer" onClick={() => setViewing(null)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xl text-slate-500 transition hover:bg-slate-200">×</button></div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-7">
          {loadingPolicy ? <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-500">Loading current Reviews settings…</div> : error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">{error}</div> : policyDocument ? <PolicyContent document={policyDocument}/> : null}
        </div>
      </div>
    </div> : null}
  </div>;
}
