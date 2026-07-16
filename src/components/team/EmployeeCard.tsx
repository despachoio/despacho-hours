"use client";

import { useRouter } from "next/navigation";
import type { EmployeeAnalytics } from "./types";
import { formatTimerDuration, initials, statusLabel } from "./utils";

export default function EmployeeCard({
  analytics,
  now,
  canEdit = false,
}: {
  analytics: EmployeeAnalytics;
  now: number;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const { employee, timer, status } = analytics;
  const isActive = String(employee.status || "").toLowerCase() === "active";
  const isOnline = status === "working" || status === "paused";
  const statusTone =
    status === "working"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "paused"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-100 text-slate-600";
  const utilisationTone =
    analytics.utilisation > 100
      ? "bg-red-500"
      : analytics.utilisation >= 70
        ? "bg-emerald-500"
        : analytics.utilisation >= 40
          ? "bg-amber-400"
          : "bg-slate-400";

  return (
    <article
      data-shortcut-row
      data-shortcut-href={`/team/${employee.id}`}
      data-shortcut-edit-href={canEdit ? `/team/${employee.id}?action=edit` : undefined}
      className="group rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#153E90]/15"
      onClick={() => router.push(`/team/${employee.id}`)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(`/team/${employee.id}`);
        }
      }}
      role="link"
      tabIndex={0}
    >
      <div className="grid items-center gap-5 sm:grid-cols-2 xl:grid-cols-[1.7fr_.7fr_.7fr_1fr_.75fr_1.5fr]">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 font-bold text-[#153E90] ring-1 ring-blue-100">
            {initials(employee.name)}
            {isOnline ? (
              <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
            ) : null}
          </div>
          <div className="min-w-0">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                router.push(`/team/${employee.id}`);
              }}
              className="truncate text-left font-bold text-slate-950 group-hover:text-[#153E90]"
            >
              {employee.name}
            </button>
            <span
              className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
            >
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
        <Metric label="Period" value={`${analytics.hours.toFixed(2)} hrs`} />
        <Metric
          label="Expected"
          value={`${analytics.expectedHours.toFixed(2)} hrs`}
        />
        <div>
          <Metric
            label="Utilisation"
            value={`${analytics.utilisation.toFixed(0)}%`}
          />
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${utilisationTone}`}
              style={{ width: `${Math.min(100, analytics.utilisation)}%` }}
            />
          </div>
        </div>
        <Metric
          label="Avg daily"
          value={`${analytics.averageDailyHours.toFixed(2)} hrs`}
        />
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
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 whitespace-nowrap text-sm font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}
