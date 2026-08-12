"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { TeamEmployee } from "./types";
import { initials } from "./utils";

type ChartNode = TeamEmployee & { children: ChartNode[] };

function employeeSearch(employee: TeamEmployee) {
  return `${employee.employee_code || ""} ${employee.title || ""} ${employee.name} ${employee.role || ""} ${employee.department || ""}`.toLowerCase();
}

function buildForest(employees: TeamEmployee[]) {
  const nodes = new Map(employees.map((employee) => [employee.id, { ...employee, children: [] as ChartNode[] }]));
  const roots: ChartNode[] = [];
  nodes.forEach((node) => { const manager = node.reporting_manager_id ? nodes.get(node.reporting_manager_id) : null; if (manager && manager.id !== node.id) manager.children.push(node); else roots.push(node); });
  const sort = (items: ChartNode[]) => items.sort((a, b) => String(a.employee_code || "").localeCompare(String(b.employee_code || ""), undefined, { numeric: true }) || a.name.localeCompare(b.name)).forEach((item) => sort(item.children));
  sort(roots);
  return roots;
}

function OrgNode({ node, collapsed, toggle, selectedId }: { node: ChartNode; collapsed: Set<string>; toggle: (id: string) => void; selectedId: string }) {
  const isCollapsed = collapsed.has(node.id);
  const active = selectedId === node.id;
  return <li className="relative flex flex-col items-center px-3"><div id={`org-node-${node.id}`} className={`relative w-64 rounded-2xl border bg-white p-4 text-left shadow-sm transition ${active ? "border-[#153E90] ring-4 ring-blue-100" : "border-slate-200 hover:border-blue-200 hover:shadow-md"}`}><Link href={`/team/${node.id}`} className="absolute inset-0 rounded-2xl" aria-label={`Open ${node.name}'s employee profile`}/><div className="relative pointer-events-none flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#153E90] text-xs font-bold text-white">{initials(node.name)}</span><span className="min-w-0"><span className="block truncate font-bold text-slate-950">{node.title ? `${node.title} ` : ""}{node.name}</span><span className="mt-1 block text-xs font-semibold text-[#153E90]">{node.employee_code || "No code"}</span><span className="mt-1 block truncate text-xs text-slate-500">{node.role || "Team Member"} · {node.department || "No department"}</span></span></div><div className="relative pointer-events-none mt-3 flex items-center justify-between"><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${String(node.status).toLowerCase() === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{node.status || "Unknown"}</span>{node.children.length ? <button type="button" className="pointer-events-auto relative z-20 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600" onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggle(node.id); }}>{isCollapsed ? `+${node.children.length}` : "Collapse"}</button> : null}</div></div>{node.children.length && !isCollapsed ? <><span className="h-6 w-px bg-slate-300"/><ul className="relative flex min-w-max items-start justify-center border-t border-slate-300 pt-6">{node.children.map((child) => <OrgNode key={child.id} node={child} collapsed={collapsed} toggle={toggle} selectedId={selectedId}/>)}</ul></> : null}</li>;
}

export default function OrganizationChart({ employees }: { employees: TeamEmployee[] }) {
  const [query, setQuery] = useState(""); const [selectedId, setSelectedId] = useState(""); const [scale, setScale] = useState(1); const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set()); const viewport = useRef<HTMLDivElement>(null);
  const forest = useMemo(() => buildForest(employees), [employees]);
  const matches = useMemo(() => query.trim() ? employees.filter((employee) => employeeSearch(employee).includes(query.trim().toLowerCase())).slice(0, 8) : [], [employees, query]);
  function focus(employee: TeamEmployee) { setSelectedId(employee.id); setQuery(`${employee.employee_code || ""} · ${employee.name}`); setCollapsed(new Set()); window.setTimeout(() => document.getElementById(`org-node-${employee.id}`)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }), 80); }
  function fit() { setScale(1); setSelectedId(""); viewport.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" }); }
  return <div className="space-y-5"><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-end gap-3"><label className="relative min-w-64 flex-1 text-sm font-bold text-slate-700">Search employee<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, code, designation or department" className="mt-2 h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-[#153E90]"/>{matches.length ? <span className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">{matches.map((employee) => <button key={employee.id} type="button" onClick={() => focus(employee)} className="flex w-full justify-between border-b border-slate-100 px-4 py-3 text-left text-sm hover:bg-blue-50"><strong>{employee.name}</strong><span className="text-slate-400">{employee.employee_code}</span></button>)}</span> : null}</label><div className="flex gap-2"><button type="button" aria-label="Zoom out" onClick={() => setScale((value) => Math.max(.55, value - .1))} className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-lg font-bold">−</button><button type="button" aria-label="Zoom in" onClick={() => setScale((value) => Math.min(1.5, value + .1))} className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-lg font-bold">+</button><button type="button" onClick={fit} className="h-12 rounded-xl bg-[#153E90] px-4 text-sm font-bold text-white">Fit to screen</button></div></div></section><section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50 shadow-sm"><div className="border-b border-slate-200 px-6 py-5"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#153E90]">Reporting hierarchy</p><h2 className="mt-2 text-2xl font-bold">Organization Chart</h2><p className="mt-1 text-sm text-slate-500">Generated from each employee’s Reporting Manager. Select any node to open the existing employee profile.</p></div><div ref={viewport} className="max-h-[720px] overflow-auto p-8"><div className="min-w-max origin-top-left transition-transform duration-300" style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}><ul className="flex items-start justify-center gap-8">{forest.map((root) => <OrgNode key={root.id} node={root} collapsed={collapsed} selectedId={selectedId} toggle={(id) => setCollapsed((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; })}/>)}</ul></div>{!forest.length ? <p className="py-20 text-center text-sm text-slate-400">No employees are available in your current Team view.</p> : null}</div></section></div>;
}
