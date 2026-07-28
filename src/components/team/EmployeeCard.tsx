"use client";

import Link from "next/link";
import type { EmployeeAnalytics } from "./types";
import { formatDecimalHours } from "@/lib/format-hours";
import { formatTimerDuration, initials, statusLabel } from "./utils";

export default function EmployeeCard({
  analytics,
  now,
  canEdit = false,
  canViewDetails = true,
}: {
  analytics: EmployeeAnalytics;
  now: number;
  canEdit?: boolean;
  canViewDetails?: boolean;
}) {
  const { employee, timer, status } = analytics;
  const isActive = String(employee.status || "").toLowerCase() === "active";
  const isOnline = status === "working" || status === "paused";
  const statusTone =
    status === "working"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "paused"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-100 text-slate-600";
  const utilisationTextTone =
    analytics.utilisation > 100
      ? "text-red-600"
      : analytics.utilisation >= 80
        ? "text-emerald-600"
        : "text-amber-500";
  return (
    <div
      data-shortcut-row={canViewDetails ? true : undefined}
      data-shortcut-href={
        canViewDetails ? `/team/${employee.id}` : undefined
      }
      data-shortcut-edit-href={canEdit ? `/team/${employee.id}?action=edit` : undefined}
      className={`group relative block rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition ${
        canViewDetails ? "hover:border-blue-200 hover:shadow-md" : ""
      }`}
    >
      {canViewDetails ? (
        <Link
          href={`/team/${employee.id}`}
          aria-label={`View ${employee.name}'s employee details`}
          className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
        />
      ) : null}
      <div className="pointer-events-none relative grid items-center gap-5 sm:grid-cols-2 xl:grid-cols-[1.7fr_.7fr_.7fr_.75fr_1.1fr_1.5fr]">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#153E90] text-xs font-bold text-white shadow-sm">
            {initials(employee.name)}
            {isOnline ? (
              <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
            ) : null}
          </div>
          <div className="min-w-0">
            <span className="block truncate text-left font-bold text-slate-950 group-hover:text-[#153E90]">
              {employee.title ? `${employee.title} ` : ""}
              {employee.name}
            </span>
            <span
              className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
            >
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
        <Metric
          label="Expected"
          value={`${formatDecimalHours(analytics.expectedHours)} hrs`}
        />
        <Metric
          label="Total"
          value={`${formatDecimalHours(analytics.hours)} hrs`}
        />
        <Metric
          label="Billable"
          value={`${formatDecimalHours(analytics.billableHours)} hrs`}
        />
        <div>
          <Metric
            label="Utilisation"
            value={`${analytics.utilisation.toFixed(0)}%`}
            valueClassName={utilisationTextTone}
          />
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-[#153E90]"
              style={{ width: `${Math.min(100, analytics.billableUtilisation)}%` }}
            />
          </div>
          <div className="mt-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
            <span><span className="mr-1 text-[#153E90]">●</span>Billable</span>
          </div>
        </div>
        <div className="min-w-0 rounded-xl bg-slate-50 px-3.5 py-3">
          {timer ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusTone}`}>
                  ● {statusLabel(status)}
                </span>
                <span className={`font-mono text-xs font-bold ${status === "paused" ? "text-amber-600" : "text-emerald-600"}`}>
                  {formatTimerDuration(timer, now)}
                </span>
              </div>
              <p className="mt-1.5 truncate text-xs font-bold text-slate-800">
                {timer.projects?.clients?.name || "Unassigned client"}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {timer.projects?.project_code
                  ? `[${timer.projects.project_code}] `
                  : ""}
                {timer.projects?.name || "Unassigned project"}
              </p>
            </>
          ) : (
            <>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusTone}`}>
                ● Offline
              </span>
              <p className="mt-2 text-xs text-slate-400">No active timer</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  valueClassName = "text-slate-900",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className={`mt-1 whitespace-nowrap text-sm font-bold ${valueClassName}`}>
        {value}
      </p>
    </div>
  );
}
