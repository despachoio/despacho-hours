"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { TeamEmployee } from "./types";
import { initials } from "./utils";

type ChartNode = TeamEmployee & { children: ChartNode[] };

const nodeTones = [
  ["border-blue-200 from-white via-blue-50 to-cyan-50", "from-[#153E90] to-cyan-600", "bg-blue-100 text-[#153E90]"],
  ["border-violet-200 from-white via-violet-50 to-fuchsia-50", "from-violet-700 to-fuchsia-500", "bg-violet-100 text-violet-700"],
  ["border-emerald-200 from-white via-emerald-50 to-teal-50", "from-emerald-700 to-teal-500", "bg-emerald-100 text-emerald-700"],
  ["border-amber-200 from-white via-amber-50 to-orange-50", "from-amber-600 to-orange-500", "bg-amber-100 text-amber-800"],
] as const;

export function organizationChartEmployeeName(name: string) {
  return name.replace(/^(?:mr|mrs|ms|miss|dr)\.?\s+/i, "").trim();
}

export function organizationChartActiveEmployees(employees: TeamEmployee[]) {
  return employees.filter((employee) => String(employee.status || "").trim().toLowerCase() === "active");
}

function employeeSearch(employee: TeamEmployee) {
  return `${employee.employee_code || ""} ${organizationChartEmployeeName(employee.name)} ${employee.role || ""} ${employee.department || ""}`.toLowerCase();
}

function buildForest(employees: TeamEmployee[]) {
  const nodes = new Map(employees.map((employee) => [employee.id, { ...employee, children: [] as ChartNode[] }]));
  const roots: ChartNode[] = [];
  nodes.forEach((node) => {
    const manager = node.reporting_manager_id ? nodes.get(node.reporting_manager_id) : null;
    if (manager && manager.id !== node.id) manager.children.push(node);
    else roots.push(node);
  });
  const sort = (items: ChartNode[]) => items.sort((a, b) => String(a.employee_code || "").localeCompare(String(b.employee_code || ""), undefined, { numeric: true }) || organizationChartEmployeeName(a.name).localeCompare(organizationChartEmployeeName(b.name))).forEach((item) => sort(item.children));
  sort(roots);
  return roots;
}

function OrgNode({ node, depth, collapsed, toggle, selectedId }: { node: ChartNode; depth: number; collapsed: Set<string>; toggle: (id: string) => void; selectedId: string }) {
  const isCollapsed = collapsed.has(node.id);
  const tone = nodeTones[depth % nodeTones.length];
  const name = organizationChartEmployeeName(node.name);
  return <li className="relative flex flex-col items-center px-3">
    <article id={`org-node-${node.id}`} className={`relative w-64 overflow-hidden rounded-3xl border bg-gradient-to-br p-4 text-left shadow-[0_18px_45px_-28px_rgba(15,23,42,.45)] transition duration-300 hover:-translate-y-1 hover:shadow-xl ${tone[0]} ${selectedId === node.id ? "ring-4 ring-[#153E90]/20" : ""}`}>
      <span className="absolute -right-7 -top-8 h-24 w-24 rounded-full bg-white/60 blur-xl" />
      <Link href={`/team/${node.id}`} className="absolute inset-0 z-10 rounded-3xl" aria-label={`Open ${name}'s employee profile`} />
      <div className="pointer-events-none relative flex items-start gap-3"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${tone[1]} text-xs font-bold text-white shadow-lg`}>{initials(name)}</span><span className="min-w-0 flex-1"><span className="block truncate font-bold text-slate-950">{name}</span><span className={`mt-1.5 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${tone[2]}`}>{node.employee_code || "No code"}</span></span></div>
      <div className="pointer-events-none relative mt-4 border-t border-white/80 pt-3"><p className="truncate text-xs font-bold text-slate-700">{node.role || "Workforce Member"}</p><div className="mt-1 flex items-center justify-between gap-2"><p className="truncate text-xs text-slate-500">{node.department || "No department"}</p>{node.children.length ? <button type="button" className="pointer-events-auto relative z-20 shrink-0 rounded-full border border-white/80 bg-white/80 px-2.5 py-1 text-[10px] font-bold text-slate-600 shadow-sm" onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggle(node.id); }}>{isCollapsed ? `Show ${node.children.length}` : "Collapse"}</button> : null}</div></div>
    </article>
    {node.children.length && !isCollapsed ? <><span className="h-6 w-px bg-gradient-to-b from-[#153E90]/50 to-violet-300"/><ul className="relative flex min-w-max items-start justify-center border-t border-blue-200 pt-6">{node.children.map((child) => <OrgNode key={child.id} node={child} depth={depth + 1} collapsed={collapsed} toggle={toggle} selectedId={selectedId}/>)}</ul></> : null}
  </li>;
}

export default function OrganizationChart({ employees }: { employees: TeamEmployee[] }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [scale, setScale] = useState(1);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const viewport = useRef<HTMLDivElement>(null);
  const activeEmployees = useMemo(() => organizationChartActiveEmployees(employees), [employees]);
  const forest = useMemo(() => buildForest(activeEmployees), [activeEmployees]);
  const matches = useMemo(() => query.trim() ? activeEmployees.filter((employee) => employeeSearch(employee).includes(query.trim().toLowerCase())).slice(0, 8) : [], [activeEmployees, query]);
  function focus(employee: TeamEmployee) { setSelectedId(employee.id); setQuery(`${employee.employee_code || ""} · ${organizationChartEmployeeName(employee.name)}`); setCollapsed(new Set()); window.setTimeout(() => document.getElementById(`org-node-${employee.id}`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }), 80); }
  function fit() { setScale(1); setSelectedId(""); viewport.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" }); }
  return <div className="space-y-5">
    <section className="rounded-3xl border border-blue-100 bg-gradient-to-r from-white via-blue-50/60 to-violet-50/60 p-5 shadow-sm"><div className="flex flex-wrap items-end gap-3"><label className="relative min-w-64 flex-1 text-sm font-bold text-slate-700">Search active workforce<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, code, role or department" className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 outline-none focus:border-[#153E90]"/>{matches.length ? <span className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">{matches.map((employee) => <button key={employee.id} type="button" onClick={() => focus(employee)} className="flex w-full justify-between border-b border-slate-100 px-4 py-3 text-left text-sm hover:bg-blue-50"><strong>{organizationChartEmployeeName(employee.name)}</strong><span className="text-slate-400">{employee.employee_code}</span></button>)}</span> : null}</label><div className="flex gap-2"><button type="button" aria-label="Zoom out" onClick={() => setScale((value) => Math.max(.55, value - .1))} className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-lg font-bold">−</button><button type="button" aria-label="Zoom in" onClick={() => setScale((value) => Math.min(1.5, value + .1))} className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-lg font-bold">+</button><button type="button" onClick={fit} className="h-12 rounded-xl bg-[#153E90] px-4 text-sm font-bold text-white">Fit to screen</button></div></div></section>
    <section className="overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-violet-50 shadow-sm"><div className="border-b border-blue-100 bg-white/70 px-6 py-5"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#153E90]">Active reporting hierarchy</p><h2 className="mt-2 text-2xl font-bold">Organization Chart</h2><p className="mt-1 text-sm text-slate-500">Active workforce members organized by Reporting Manager. Select any card to open the existing employee profile.</p></div><div ref={viewport} className="max-h-[720px] overflow-auto p-8"><div className="min-w-max origin-top-left transition-transform duration-300" style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}><ul className="flex items-start justify-center gap-8">{forest.map((root) => <OrgNode key={root.id} node={root} depth={0} collapsed={collapsed} selectedId={selectedId} toggle={(id) => setCollapsed((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; })}/>)}</ul></div>{!forest.length ? <p className="py-20 text-center text-sm text-slate-400">No active workforce members are available in your current view.</p> : null}</div></section>
  </div>;
}
