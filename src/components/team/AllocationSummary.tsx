import type { TeamEntry } from "./types";
import { formatDecimalHours } from "@/lib/format-hours";

export function ProjectSummary({ entries }: { entries: TeamEntry[] }) {
  return (
    <Allocation title="Project Summary" rows={group(entries, "project")} />
  );
}
export function ClientSummary({ entries }: { entries: TeamEntry[] }) {
  return <Allocation title="Client Summary" rows={group(entries, "client")} />;
}

function group(entries: TeamEntry[], type: "project" | "client") {
  const rows = new Map<
    string,
    { name: string; detail?: string; hours: number }
  >();
  for (const entry of entries) {
    const id =
      type === "project" ? entry.project_id : entry.projects?.clients?.id;
    if (!id) continue;
    const current = rows.get(id);
    rows.set(id, {
      name:
        type === "project"
          ? entry.projects?.name || "Unassigned"
          : entry.projects?.clients?.name || "Unassigned",
      detail:
        type === "project"
          ? entry.projects?.project_code || undefined
          : undefined,
      hours: (current?.hours || 0) + Number(entry.hours || 0),
    });
  }
  return Array.from(rows.values()).sort((a, b) => b.hours - a.hours);
}

function Allocation({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; detail?: string; hours: number }[];
}) {
  const total = rows.reduce((sum, row) => sum + row.hours, 0);
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      <div className="mt-5 space-y-4">
        {rows.length ? (
          rows.map((row) => {
            const percentage = total ? (row.hours / total) * 100 : 0;
            return (
              <div key={`${row.detail}-${row.name}`}>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    {row.detail ? (
                      <p className="text-xs font-bold text-[#153E90]">
                        {row.detail}
                      </p>
                    ) : null}
                    <p className="font-bold text-slate-900">{row.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#153E90]">
                      {formatDecimalHours(row.hours)} hrs
                    </p>
                    <p className="text-xs text-slate-400">
                      {percentage.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#153E90]"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <p className="rounded-2xl bg-slate-50 py-10 text-center text-sm text-slate-400">
            No allocation data.
          </p>
        )}
      </div>
    </article>
  );
}
