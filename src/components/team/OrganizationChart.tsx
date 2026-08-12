"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { TeamEmployee } from "./types";
import { initials } from "./utils";
import styles from "./OrganizationChart.module.css";

type ChartNode = TeamEmployee & { children: ChartNode[] };

const rootTone = [
  "border-[#153E90] from-[#153E90] via-[#194CA8] to-[#0F766E]",
  "bg-white/15 text-white ring-white/20",
  "bg-white/15 text-blue-50",
] as const;

const nodeTones = [
  ["border-blue-700 from-[#153E90] to-blue-600", "bg-gradient-to-br from-[#153E90] to-cyan-600", "bg-white/15 text-blue-50"],
  ["border-violet-700 from-violet-700 to-fuchsia-500", "bg-gradient-to-br from-violet-700 to-fuchsia-500", "bg-white/15 text-violet-50"],
  ["border-emerald-700 from-emerald-700 to-teal-500", "bg-gradient-to-br from-emerald-700 to-teal-500", "bg-white/15 text-emerald-50"],
  ["border-amber-600 from-amber-600 to-orange-500", "bg-gradient-to-br from-amber-600 to-orange-500", "bg-white/15 text-amber-50"],
] as const;

export function organizationChartEmployeeName(name: string) {
  return name.replace(/^(?:mr|mrs|ms|miss|dr)\.?\s+/i, "").trim();
}

export function organizationChartActiveEmployees(employees: TeamEmployee[]) {
  return employees.filter(
    (employee) =>
      String(employee.status || "").trim().toLowerCase() === "active",
  );
}

function employeeSearch(employee: TeamEmployee) {
  return `${employee.employee_code || ""} ${organizationChartEmployeeName(employee.name)} ${employee.role || ""} ${employee.department || ""}`.toLowerCase();
}

function buildForest(employees: TeamEmployee[]) {
  const nodes = new Map(
    employees.map((employee) => [
      employee.id,
      { ...employee, children: [] as ChartNode[] },
    ]),
  );
  const roots: ChartNode[] = [];

  nodes.forEach((node) => {
    const manager = node.reporting_manager_id
      ? nodes.get(node.reporting_manager_id)
      : null;
    if (manager && manager.id !== node.id) manager.children.push(node);
    else roots.push(node);
  });

  const sort = (items: ChartNode[]) =>
    items
      .sort(
        (a, b) =>
          String(a.employee_code || "").localeCompare(
            String(b.employee_code || ""),
            undefined,
            { numeric: true },
          ) ||
          organizationChartEmployeeName(a.name).localeCompare(
            organizationChartEmployeeName(b.name),
          ),
      )
      .forEach((item) => sort(item.children));

  sort(roots);
  return roots;
}

function OrgNode({
  node,
  depth,
  branchIndex,
  collapsed,
  toggle,
  selectedId,
}: {
  node: ChartNode;
  depth: number;
  branchIndex: number;
  collapsed: Set<string>;
  toggle: (id: string) => void;
  selectedId: string;
}) {
  const isCollapsed = collapsed.has(node.id);
  const tone = depth === 0 ? rootTone : nodeTones[branchIndex % nodeTones.length];
  const name = organizationChartEmployeeName(node.name);

  return (
    <li className={`${styles.node} ${depth === 0 ? styles.rootNode : ""}`}>
      <article
        id={`org-node-${node.id}`}
        className={`relative z-10 w-64 overflow-hidden rounded-[1.35rem] border bg-gradient-to-br text-center text-white shadow-[0_18px_40px_-20px_rgba(15,23,42,.65)] transition duration-300 hover:-translate-y-1 hover:shadow-2xl ${tone[0]} ${selectedId === node.id ? "ring-4 ring-cyan-300/50" : ""}`}
      >
        <Link
          href={`/team/${node.id}`}
          className="block px-5 pb-5 pt-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-white/60"
          aria-label={`Open ${name}'s employee profile`}
        >
          <span
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-xs font-black ring-1 ${tone[1]}`}
          >
            {initials(name)}
          </span>
          <span className="mt-3 block truncate text-base font-black tracking-wide">
            {name}
          </span>
          <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-[0.24em] text-white/80">
            {node.role || "Workforce Member"}
          </span>
          <span
            className={`mx-auto mt-3 inline-flex max-w-full rounded-full px-3 py-1 text-[10px] font-bold ${tone[2]}`}
          >
            <span className="truncate">
              {node.employee_code || "No code"}
              {node.department ? ` · ${node.department}` : ""}
            </span>
          </span>
        </Link>
        {node.children.length ? (
          <button
            type="button"
            onClick={() => toggle(node.id)}
            aria-expanded={!isCollapsed}
            aria-label={`${isCollapsed ? "Show" : "Hide"} ${node.children.length} direct reports for ${name}`}
            className="absolute bottom-2 right-2 z-20 flex h-7 min-w-7 items-center justify-center rounded-full border border-white/30 bg-slate-950/20 px-2 text-[10px] font-black text-white backdrop-blur transition hover:bg-slate-950/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {isCollapsed ? `+${node.children.length}` : "−"}
          </button>
        ) : null}
      </article>

      {node.children.length && !isCollapsed ? (
        <ul className={styles.children}>
          {node.children.map((child, childIndex) => (
            <OrgNode
              key={child.id}
              node={child}
              depth={depth + 1}
              branchIndex={depth === 0 ? childIndex : branchIndex}
              collapsed={collapsed}
              toggle={toggle}
              selectedId={selectedId}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function OrganizationChart({
  employees,
}: {
  employees: TeamEmployee[];
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [scale, setScale] = useState(1);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const viewport = useRef<HTMLDivElement>(null);
  const activeEmployees = useMemo(
    () => organizationChartActiveEmployees(employees),
    [employees],
  );
  const forest = useMemo(() => buildForest(activeEmployees), [activeEmployees]);
  const matches = useMemo(
    () =>
      query.trim()
        ? activeEmployees
            .filter((employee) =>
              employeeSearch(employee).includes(query.trim().toLowerCase()),
            )
            .slice(0, 8)
        : [],
    [activeEmployees, query],
  );

  function focus(employee: TeamEmployee) {
    setSelectedId(employee.id);
    setQuery(
      `${employee.employee_code || ""} · ${organizationChartEmployeeName(employee.name)}`,
    );
    setCollapsed(new Set());
    window.setTimeout(
      () =>
        document
          .getElementById(`org-node-${employee.id}`)
          ?.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "center",
          }),
      80,
    );
  }

  function fit() {
    setScale(1);
    setSelectedId("");
    viewport.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  }

  function toggle(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-blue-100 bg-gradient-to-r from-white via-blue-50/60 to-violet-50/60 p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="relative min-w-64 flex-1 text-sm font-bold text-slate-700">
            Search active workforce
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, code, role or department"
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 outline-none focus:border-[#153E90] focus:ring-4 focus:ring-blue-100"
            />
            {matches.length ? (
              <span className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                {matches.map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => focus(employee)}
                    className="flex w-full justify-between border-b border-slate-100 px-4 py-3 text-left text-sm hover:bg-blue-50"
                  >
                    <strong>{organizationChartEmployeeName(employee.name)}</strong>
                    <span className="text-slate-400">
                      {employee.employee_code}
                    </span>
                  </button>
                ))}
              </span>
            ) : null}
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => setScale((value) => Math.max(0.55, value - 0.1))}
              className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-lg font-bold shadow-sm"
            >
              −
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => setScale((value) => Math.min(1.5, value + 0.1))}
              className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-lg font-bold shadow-sm"
            >
              +
            </button>
            <button
              type="button"
              onClick={fit}
              className="h-12 rounded-xl bg-[#153E90] px-4 text-sm font-bold text-white shadow-sm"
            >
              Fit to screen
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_-45px_rgba(15,23,42,.45)]">
        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50 px-6 py-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#153E90]">
            Active reporting hierarchy
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-800">
            Company Organization
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">
            Select a card to open the employee profile. Use the control on a
            manager card to collapse or reveal its reporting branch.
          </p>
        </div>
        <div
          ref={viewport}
          className="max-h-[760px] overflow-auto bg-[radial-gradient(circle_at_top,_rgba(219,234,254,.55),_transparent_40%),linear-gradient(#fff,#f8fafc)] px-8 py-10"
        >
          {forest.length ? (
            <div
              className={`${styles.canvas} origin-top transition-transform duration-300`}
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "top center",
              }}
            >
              {forest.map((root, rootIndex) => (
                <ul key={root.id} className={styles.tree}>
                  <OrgNode
                    node={root}
                    depth={0}
                    branchIndex={rootIndex}
                    collapsed={collapsed}
                    selectedId={selectedId}
                    toggle={toggle}
                  />
                </ul>
              ))}
            </div>
          ) : (
            <p className="py-20 text-center text-sm text-slate-400">
              No active workforce members are available in your current view.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
