"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  GuideAccess,
  GuideRole,
  GuideSection,
  UserGuidePayload,
} from "@/lib/user-guide/types";
import GuideIcon from "@/components/user-guide/GuideIcon";

const roleParam = (role: GuideRole) => role.toLowerCase().replace(/\s+/g, "_");
const normalizeRoleParam = (value: string | null) =>
  String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ");

function matchesSection(section: GuideSection, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    section.id,
    section.title,
    section.description,
    ...section.keywords,
    ...section.blocks.flatMap((block) => [block.title, block.description, ...block.bullets]),
    ...(section.workflows || []).flatMap((workflow) => [
      workflow.title,
      ...(workflow.keywords || []),
      ...workflow.steps,
    ]),
  ]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

export default function UserGuideWorkspace() {
  const [payload, setPayload] = useState<UserGuidePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sectionId, setSectionId] = useState("overview");
  const [selectedRole, setSelectedRole] = useState<GuideRole | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error("Please sign in to view the User Guide.");
      const response = await fetch("/api/user-guide", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        cache: "no-store",
      });
      const result = (await response.json()) as UserGuidePayload & { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load the User Guide.");
      setPayload(result);

      const params = new URLSearchParams(window.location.search);
      const requestedSection = params.get("section");
      const requestedRole = normalizeRoleParam(params.get("role"));
      const safeSection = result.sections.find((section) => section.id === requestedSection);
      const safeRole = result.allowedRoles.find(
        (role) => role.toLowerCase() === requestedRole,
      );
      setSectionId(safeSection?.id || "overview");
      setSelectedRole(safeRole || result.profile.role);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load the User Guide.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visibleSections = useMemo(
    () => payload?.sections.filter((section) => matchesSection(section, query)) || [],
    [payload, query],
  );
  const selectedSection =
    visibleSections.find((section) => section.id === sectionId) || visibleSections[0];
  const roleCapability = payload?.roleCapabilities.find(
    (capability) => capability.role === (selectedRole || payload.profile.role),
  );

  function setUrl(next: { section?: string; role?: GuideRole }) {
    const params = new URLSearchParams(window.location.search);
    if (next.section) params.set("section", next.section);
    if (next.role) params.set("role", roleParam(next.role));
    window.history.replaceState(null, "", `/user-guide?${params.toString()}`);
  }

  if (loading) return <GuideLoading />;
  if (error || !payload) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] px-5 py-7 sm:px-8">
        <div className="mx-auto max-w-[1500px] rounded-3xl border border-red-100 bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-950">User Guide couldn&apos;t load</h1>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <button type="button" onClick={() => void load()} className="mt-5 rounded-xl bg-[#153E90] px-5 py-3 text-sm font-bold text-white">Try again</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-5 py-7 sm:px-8">
      <div className="mx-auto max-w-[1500px]">
        <UserGuideHero name={payload.profile.name} role={payload.profile.role} />

        <section className="relative z-10 mx-3 -mt-5 rounded-3xl border border-white/80 bg-white/95 p-4 shadow-[0_18px_45px_-28px_rgba(15,23,42,.7)] backdrop-blur sm:mx-6 sm:p-5">
          <label htmlFor="guide-search" className="sr-only">Search the Kairo User Guide</label>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 focus-within:border-[#153E90] focus-within:ring-2 focus-within:ring-blue-100">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-[#153E90]"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
            <input id="guide-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the Kairo User Guide..." className="h-13 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400" />
            {query ? <button type="button" onClick={() => setQuery("")} className="rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-white hover:text-[#153E90]">Clear</button> : null}
          </div>
        </section>

        <div className="mt-7 grid gap-7 lg:grid-cols-[280px_minmax(0,1fr)]">
          <GuideNavigation
            sections={visibleSections}
            activeId={selectedSection?.id || ""}
            query={query}
            onSelect={(id) => { setSectionId(id); setUrl({ section: id }); }}
          />

          <div className="min-w-0 space-y-7">
            <WelcomeCard
              name={payload.profile.name}
              role={payload.profile.role}
              onViewRole={() => {
                setSectionId("roles-permissions");
                setSelectedRole(payload.profile.role);
                setUrl({ section: "roles-permissions", role: payload.profile.role });
              }}
            />

            {query ? (
              <p className="text-sm font-semibold text-slate-500" aria-live="polite">
                {visibleSections.length} guide {visibleSections.length === 1 ? "section" : "sections"} match “{query}”.
              </p>
            ) : null}

            {!selectedSection ? (
              <GuideEmptyState onClear={() => setQuery("")} />
            ) : selectedSection.id === "roles-permissions" ? (
              <div className="space-y-7">
                <GuideSectionView section={selectedSection} />
                <RoleCapabilities
                  ownRole={payload.profile.role}
                  allowedRoles={payload.allowedRoles}
                  selectedRole={selectedRole || payload.profile.role}
                  capability={roleCapability}
                  onSelect={(role) => { setSelectedRole(role); setUrl({ section: "roles-permissions", role }); }}
                />
                <PermissionMatrix rows={payload.permissionMatrix} />
              </div>
            ) : (
              <GuideSectionView section={selectedSection} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function UserGuideHero({ name, role }: { name: string; role: GuideRole }) {
  return (
    <header className="relative min-h-[250px] overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#0F172A] via-[#172554] to-[#153E90] px-8 py-10 text-white shadow-xl shadow-slate-300/50 lg:px-12">
      <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="relative flex min-h-[170px] flex-col justify-between gap-8 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.24em] text-cyan-200">Help &amp; Documentation</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight lg:text-5xl">User Guide</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">Learn how to use Kairo and understand the tools available to your role.</p>
        </div>
        <div className="w-full max-w-xs rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-200">Your Kairo Role</p>
          <p className="mt-2 text-2xl font-bold text-white">{role}</p>
          <p className="mt-1 text-xs text-blue-100">{name}, you&apos;re using Kairo as {role}.</p>
        </div>
      </div>
    </header>
  );
}

function GuideNavigation({ sections, activeId, query, onSelect }: { sections: GuideSection[]; activeId: string; query: string; onSelect: (id: string) => void }) {
  return (
    <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-24">
      <p className="px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[.2em] text-slate-400">{query ? "Search results" : "Guide sections"}</p>
      <nav aria-label="User Guide sections" className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">
        {sections.map((section) => {
          const active = section.id === activeId;
          return (
            <button key={section.id} type="button" onClick={() => onSelect(section.id)} aria-current={active ? "page" : undefined} className={`flex h-11 shrink-0 items-center gap-3 rounded-xl px-3 text-left text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 lg:w-full ${active ? "bg-gradient-to-r from-[#153E90] to-blue-700 text-white shadow-lg shadow-blue-900/20" : "text-slate-500 hover:bg-blue-50 hover:text-[#153E90]"}`}>
              <GuideIcon name={section.icon} className="h-4 w-4 shrink-0" />
              {section.title}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function WelcomeCard({ name, role, onViewRole }: { name: string; role: GuideRole; onViewRole: () => void }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-white via-blue-50/45 to-cyan-50/70 p-7 shadow-[0_18px_45px_-32px_rgba(15,62,144,.45)] sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[#153E90]">Personalised guidance</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Welcome, {name}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">You&apos;re using Kairo as <strong className="text-[#153E90]">{role}</strong>. Here&apos;s what you can access and manage in Kairo.</p>
      <button type="button" onClick={onViewRole} className="mt-5 rounded-xl bg-[#153E90] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">View what I can do</button>
    </section>
  );
}

function GuideSectionView({ section }: { section: GuideSection }) {
  return (
    <section id={`guide-${section.id}`} className="space-y-6 scroll-mt-24" aria-labelledby={`guide-title-${section.id}`}>
      <header className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#153E90] ring-1 ring-blue-100"><GuideIcon name={section.icon} className="h-6 w-6" /></span><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#153E90]">Kairo guide</p><h2 id={`guide-title-${section.id}`} className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{section.title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{section.description}</p></div></div>
      </header>
      <div className="grid gap-5 xl:grid-cols-2">
        {section.blocks.map((block) => <article key={block.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_-34px_rgba(15,23,42,.35)]"><h3 className="text-xl font-bold text-slate-950">{block.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{block.description}</p><ul className="mt-5 space-y-3">{block.bullets.map((bullet) => <li key={bullet} className="flex gap-3 text-sm leading-6 text-slate-700"><span aria-hidden="true" className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-bold text-emerald-700">✓</span><span>{bullet}</span></li>)}</ul></article>)}
      </div>
      {section.workflows?.length ? <div className="rounded-3xl border border-violet-100 bg-gradient-to-br from-white to-violet-50/60 p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-[.18em] text-violet-700">Practical workflows</p><h3 className="mt-2 text-2xl font-bold text-slate-950">How do I...?</h3><div className="mt-5 grid gap-4 xl:grid-cols-2">{section.workflows.map((workflow) => <article key={workflow.title} className="rounded-2xl border border-violet-100 bg-white p-5"><h4 className="font-bold text-slate-950">{workflow.title}</h4><ol className="mt-4 space-y-3">{workflow.steps.map((step, index) => <li key={step} className="flex gap-3 text-sm leading-6 text-slate-600"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#153E90] text-[11px] font-bold text-white">{index + 1}</span><span>{step}</span></li>)}</ol></article>)}</div></div> : null}
    </section>
  );
}

function RoleCapabilities({ ownRole, allowedRoles, selectedRole, capability, onSelect }: { ownRole: GuideRole; allowedRoles: GuideRole[]; selectedRole: GuideRole; capability?: UserGuidePayload["roleCapabilities"][number]; onSelect: (role: GuideRole) => void }) {
  return (
    <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-cyan-50/70 p-6 shadow-sm sm:p-7">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[#153E90]">What You Can Do</p>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Guide roles">{allowedRoles.map((role) => <button key={role} type="button" role="tab" aria-selected={role === selectedRole} onClick={() => onSelect(role)} className={`h-11 shrink-0 rounded-xl px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${role === selectedRole ? "bg-gradient-to-r from-[#153E90] to-blue-700 text-white shadow-lg shadow-blue-900/20" : "border border-slate-200 bg-white text-slate-500 hover:bg-blue-50 hover:text-[#153E90]"}`}>{role === ownRole ? `Your Role · ${role}` : role}</button>)}</div>
      {capability ? <div className="mt-6"><h3 className="text-2xl font-bold text-slate-950">{capability.role}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{capability.summary}</p><div className="mt-5 grid gap-4 md:grid-cols-2">{capability.modules.map((module) => <article key={module.module} className="rounded-2xl border border-blue-100 bg-white p-5"><h4 className="font-bold text-[#153E90]">{module.module}</h4><ul className="mt-3 space-y-2">{module.capabilities.map((item) => <li key={item} className="flex gap-2 text-sm leading-5 text-slate-600"><span aria-hidden="true" className="font-bold text-emerald-600">✓</span>{item}</li>)}</ul></article>)}</div></div> : null}
    </section>
  );
}

function PermissionMatrix({ rows }: { rows: UserGuidePayload["permissionMatrix"] }) {
  const accessView: Record<GuideAccess, { symbol: string; label: string; className: string }> = {
    full: { symbol: "✓", label: "Full access", className: "bg-emerald-50 text-emerald-700" },
    limited: { symbol: "◐", label: "Limited / scoped", className: "bg-amber-50 text-amber-700" },
    none: { symbol: "—", label: "No access", className: "bg-slate-100 text-slate-500" },
  };
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" aria-labelledby="permission-matrix-title">
      <header className="border-b border-slate-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 px-6 py-5"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#153E90]">Access reference</p><h3 id="permission-matrix-title" className="mt-1 text-2xl font-bold text-slate-950">Permissions Matrix</h3><p className="mt-2 text-xs leading-5 text-slate-500">High-level guide only. Record scope, hierarchy, status, protected fields, server checks, and RLS can narrow an action further.</p></header>
      <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[980px] border-collapse text-left text-sm"><thead className="bg-[#0F172A] text-xs uppercase tracking-wider text-white"><tr><th className="px-5 py-4">Feature / Action</th>{(["Employee", "Manager", "Admin", "Finance Admin", "Super Admin"] as GuideRole[]).map((role) => <th key={role} className="px-4 py-4">{role}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={`${row.module}-${row.feature}`} className="border-t border-slate-100 align-top odd:bg-white even:bg-slate-50/60"><th className="px-5 py-4"><span className="block font-bold text-slate-900">{row.feature}</span><span className="mt-1 block text-xs font-medium text-slate-400">{row.module}</span></th>{(["Employee", "Manager", "Admin", "Finance Admin", "Super Admin"] as GuideRole[]).map((role) => { const view = accessView[row.permissions[role].access]; return <td key={role} className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${view.className}`} aria-label={view.label}>{view.symbol} {view.label}</span><p className="mt-2 max-w-[180px] text-xs leading-5 text-slate-500">{row.permissions[role].note}</p></td>; })}</tr>)}</tbody></table></div>
      <div className="space-y-4 p-4 lg:hidden">{rows.map((row) => <article key={`${row.module}-${row.feature}`} className="rounded-2xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase tracking-wider text-[#153E90]">{row.module}</p><h4 className="mt-1 font-bold text-slate-950">{row.feature}</h4><div className="mt-4 space-y-3">{(["Employee", "Manager", "Admin", "Finance Admin", "Super Admin"] as GuideRole[]).map((role) => { const permission = row.permissions[role]; const view = accessView[permission.access]; return <div key={role} className="rounded-xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-700">{role}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${view.className}`}>{view.symbol} {view.label}</span></div><p className="mt-2 text-xs leading-5 text-slate-500">{permission.note}</p></div>; })}</div></article>)}</div>
    </section>
  );
}

function GuideEmptyState({ onClear }: { onClear: () => void }) {
  return <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-[#153E90]">?</span><h2 className="mt-4 text-xl font-bold text-slate-950">No guide results found</h2><p className="mt-2 text-sm text-slate-500">Try timer, leave, employee, payroll, invoice, client, project, approval, or Work Order.</p><button type="button" onClick={onClear} className="mt-5 rounded-xl bg-[#153E90] px-5 py-3 text-sm font-bold text-white">Clear search</button></section>;
}

function GuideLoading() {
  return <main className="min-h-screen bg-[#F8FAFC] px-5 py-7 sm:px-8"><div className="mx-auto max-w-[1500px]"><div className="h-[250px] animate-pulse rounded-[2rem] bg-slate-200"/><div className="mt-7 grid gap-7 lg:grid-cols-[280px_1fr]"><div className="h-[34rem] animate-pulse rounded-3xl bg-slate-200"/><div className="space-y-5"><div className="h-48 animate-pulse rounded-3xl bg-slate-200"/><div className="h-96 animate-pulse rounded-3xl bg-slate-200"/></div></div></div></main>;
}
