import type { TeamEntry } from "./types";
import { formatDate, formatTime } from "@/components/reports/utils";

export default function EmployeeTimeline({
  entries,
}: {
  entries: TeamEntry[];
}) {
  const groups = Object.entries(
    entries.reduce<Record<string, TeamEntry[]>>(
      (result, entry) => ({
        ...result,
        [entry.entry_date]: [...(result[entry.entry_date] || []), entry],
      }),
      {},
    ),
  ).sort(([first], [second]) => second.localeCompare(first));
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-slate-950">Timeline</h2>
      <p className="mt-1 text-xs text-slate-400">
        Read-only time activity grouped by date.
      </p>
      <div className="mt-5 space-y-6">
        {groups.length ? (
          groups.map(([date, dateEntries]) => (
            <div key={date}>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[#153E90]">
                {formatDate(date)}
              </p>
              <div className="space-y-2">
                {dateEntries
                  .sort((a, b) =>
                    String(a.started_at).localeCompare(String(b.started_at)),
                  )
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-[90px_1fr_auto]"
                    >
                      <p className="font-bold text-slate-900">
                        {formatTime(entry.started_at)}
                      </p>
                      <div>
                        <p className="font-bold text-slate-900">
                          {entry.projects?.clients?.name || "Unassigned client"}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          [{entry.projects?.project_code}]{" "}
                          {entry.projects?.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {entry.description || "No description"}
                        </p>
                      </div>
                      <p className="font-bold text-[#153E90]">
                        {Number(entry.hours).toFixed(2)}h
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-2xl bg-slate-50 py-12 text-center text-sm text-slate-400">
            No time entries in this period.
          </p>
        )}
      </div>
    </article>
  );
}
