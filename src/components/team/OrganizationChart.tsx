"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { TeamEmployee } from "./types";
import styles from "./OrganizationChart.module.css";

type ChartNode = TeamEmployee & { children: ChartNode[] };

const rootTone =
  "border-[#0B1F3A] from-[#0B1F3A] via-[#153E90] to-[#2563A6]";

const nodeTones = [
  "border-[#173B70] from-[#173B70] to-[#2F66B3]",
  "border-[#0F5F66] from-[#0F5F66] to-[#2B8C88]",
  "border-[#563D7C] from-[#563D7C] to-[#7C5AA6]",
  "border-[#7A4E28] from-[#7A4E28] to-[#A96F3B]",
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
        className={`relative z-10 w-64 overflow-hidden rounded-[1.35rem] border bg-gradient-to-br text-center text-white shadow-[0_18px_40px_-20px_rgba(15,23,42,.65)] transition duration-300 hover:-translate-y-1 hover:shadow-2xl ${tone} ${selectedId === node.id ? "ring-4 ring-cyan-300/50" : ""}`}
      >
        <Link
          href={`/team/${node.id}`}
          className="block px-5 pb-5 pt-5 focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-white/60"
          aria-label={`Open ${name}'s employee profile`}
        >
          <span className="block truncate text-base font-black tracking-wide">
            {name}
          </span>
          <span className="mt-1 block truncate text-[10px] font-bold uppercase tracking-[0.24em] text-white/80">
            {node.role || "Workforce Member"}
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
        <div
          ref={viewport}
          className="max-h-[760px] overflow-auto bg-[radial-gradient(circle_at_top,_rgba(219,234,254,.45),_transparent_42%),linear-gradient(#fff,#f8fafc)] px-8 py-12"
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
