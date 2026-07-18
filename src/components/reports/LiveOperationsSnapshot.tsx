"use client";

import Link from "next/link";
import type { LiveTimer } from "./types";
import { formatDuration, timerSeconds } from "./utils";

export default function LiveOperationsSnapshot({
  timers,
  now,
}: {
  timers: LiveTimer[];
  now: number;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#153E90]">
            Live now
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">
            Live Operations Snapshot
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Top five running and paused timers. View-only.
          </p>
        </div>
        <Link
          href="/timer"
          className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-bold text-[#153E90] hover:bg-blue-50"
        >
          View all in Time Tracking →
        </Link>
      </div>
      {timers.length ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                <th className="px-3 py-3 text-left">Employee</th>
                <th className="px-3 py-3 text-left">Client</th>
                <th className="px-3 py-3 text-left">Project</th>
                <th className="px-3 py-3 text-left">Description</th>
                <th className="px-3 py-3 text-right">Live Duration</th>
                <th className="px-3 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {timers.map((timer) => {
                const running = timer.status === "running";
                return (
                  <tr
                    key={timer.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-3 py-4 font-bold text-slate-900">
                      {timer.employees?.name || "Unknown"}
                    </td>
                    <td className="px-3 py-4 text-sm text-slate-600">
                      {timer.projects?.clients?.name || "—"}
                    </td>
                    <td className="px-3 py-4">
                      <p className="text-xs font-bold text-[#153E90]">
                        {timer.projects?.project_code || "—"}
                      </p>
                      <p className="font-semibold">
                        {timer.projects?.name || "—"}
                      </p>
                    </td>
                    <td className="max-w-xs px-3 py-4 text-sm text-slate-600">
                      {timer.description || "No description"}
                    </td>
                    <td
                      className={`px-3 py-4 text-right font-mono text-lg font-bold ${running ? "text-emerald-600" : "text-amber-600"}`}
                    >
                      {formatDuration(timerSeconds(timer, now))}
                    </td>
                    <td className="px-3 py-4 text-right">
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${running ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                      >
                        ● {running ? "Running" : "Paused"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-9 text-center text-sm text-slate-500">
          No active timers right now.
        </div>
      )}
    </section>
  );
}
