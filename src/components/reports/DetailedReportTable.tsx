"use client";

import { useMemo, useState } from "react";
import type { AggregateRow } from "./types";
import { formatDecimalHours } from "@/lib/format-hours";
import { formatDate, formatTime } from "./utils";

type SortKey =
  | "employeeName"
  | "clientName"
  | "projectName"
  | "totalHours"
  | "entries"
  | "averageSession"
  | "longestSession"
  | "utilisation";

export default function DetailedReportTable({
  rows,
  employeeColumn,
}: {
  rows: AggregateRow[];
  employeeColumn: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("totalHours");
  const [ascending, setAscending] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const first = a[sortKey];
        const second = b[sortKey];
        const comparison =
          typeof first === "number" && typeof second === "number"
            ? first - second
            : String(first).localeCompare(String(second));
        return ascending ? comparison : -comparison;
      }),
    [ascending, rows, sortKey],
  );
  const pageRows = sorted.slice(page * pageSize, page * pageSize + pageSize);
  function sort(next: SortKey) {
    if (next === sortKey) setAscending((value) => !value);
    else {
      setSortKey(next);
      setAscending(next !== "totalHours");
    }
    setPage(0);
  }
  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const columns: { key: SortKey; label: string; hidden?: boolean }[] = [
    { key: "employeeName", label: "Employee", hidden: !employeeColumn },
    { key: "clientName", label: "Client" },
    { key: "projectName", label: "Project" },
    { key: "totalHours", label: "Total Hours" },
    { key: "entries", label: "Entries" },
    { key: "averageSession", label: "Average Session" },
    { key: "longestSession", label: "Longest Session" },
    { key: "utilisation", label: "Utilisation" },
  ];
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Detailed Report</h2>
          <p className="mt-1 text-xs text-slate-400">
            Aggregated by employee, client, and project.
          </p>
        </div>
        <select
          value={pageSize}
          onChange={(event) => {
            setPageSize(Number(event.target.value));
            setPage(0);
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="25">25 rows</option>
          <option value="50">50 rows</option>
          <option value="100">100 rows</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px]">
          <thead className="bg-slate-950 text-xs uppercase tracking-wide text-white">
            <tr>
              <th className="w-12 px-3 py-3" />
              {columns
                .filter((column) => !column.hidden)
                .map((column) => (
                  <th
                    key={column.key}
                    className={`px-4 py-3 ${["employeeName", "clientName", "projectName"].includes(column.key) ? "text-left" : "text-right"}`}
                  >
                    <button
                      type="button"
                      onClick={() => sort(column.key)}
                      className="font-bold"
                    >
                      {column.label}{" "}
                      {sortKey === column.key ? (ascending ? "↑" : "↓") : ""}
                    </button>
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const open = expanded.has(row.id);
              return (
                <ReportRows
                  key={row.id}
                  row={row}
                  open={open}
                  employeeColumn={employeeColumn}
                  onToggle={() => toggle(row.id)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-slate-500">
          Showing {rows.length ? page * pageSize + 1 : 0}–
          {Math.min((page + 1) * pageSize, rows.length)} of {rows.length} rows
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
            className="rounded-xl border border-slate-200 px-4 py-2 font-bold disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={(page + 1) * pageSize >= rows.length}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-xl bg-slate-950 px-4 py-2 font-bold text-white disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

function ReportRows({
  row,
  open,
  employeeColumn,
  onToggle,
}: {
  row: AggregateRow;
  open: boolean;
  employeeColumn: boolean;
  onToggle: () => void;
}) {
  const grouped = useMemo(
    () =>
      Object.entries(
        row.sourceEntries.reduce<Record<string, typeof row.sourceEntries>>(
          (groups, entry) => ({
            ...groups,
            [entry.entry_date]: [...(groups[entry.entry_date] || []), entry],
          }),
          {},
        ),
      ).sort(([first], [second]) => second.localeCompare(first)),
    [row],
  );
  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50">
        <td className="px-3 py-4 text-center">
          <button
            type="button"
            onClick={onToggle}
            aria-label={open ? "Collapse entries" : "Expand entries"}
            className="h-8 w-8 rounded-lg bg-slate-100 font-bold text-slate-600"
          >
            {open ? "−" : "+"}
          </button>
        </td>
        {employeeColumn ? (
          <td className="px-4 py-4 font-bold">{row.employeeName}</td>
        ) : null}
        <td className="px-4 py-4 text-sm text-slate-600">{row.clientName}</td>
        <td className="px-4 py-4">
          <p className="font-semibold">{row.projectName}</p>
          <p className="text-xs font-bold text-[#153E90]">{row.projectCode}</p>
        </td>
        <td className="px-4 py-4 text-right font-bold">
          {formatDecimalHours(row.totalHours)}
        </td>
        <td className="px-4 py-4 text-right">{row.entries}</td>
        <td className="px-4 py-4 text-right">
          {formatDecimalHours(row.averageSession)}
        </td>
        <td className="px-4 py-4 text-right">
          {formatDecimalHours(row.longestSession)}
        </td>
        <td className="px-4 py-4 text-right font-semibold">
          {row.utilisation.toFixed(1)}%
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-slate-100 bg-slate-50/70">
          <td colSpan={employeeColumn ? 9 : 8} className="px-6 py-5">
            <div className="space-y-4">
              {grouped.map(([date, entries]) => (
                <div key={date}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    {formatDate(date)}
                  </p>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="grid gap-2 border-b border-slate-100 px-4 py-3 text-sm last:border-0 sm:grid-cols-[1fr_100px_100px_90px]"
                      >
                        <p className="text-slate-600">
                          {entry.description || "No description"}
                        </p>
                        <p>{formatTime(entry.started_at)}</p>
                        <p>{formatTime(entry.stopped_at)}</p>
                        <p className="text-right font-bold">
                          {formatDecimalHours(entry.hours)} hrs
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
