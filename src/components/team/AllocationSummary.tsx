import type { TeamEntry } from "./types";
import { formatDecimalHours } from "@/lib/format-hours";

export function ProjectSummary({ entries }: { entries: TeamEntry[] }) {
  const rows = group(entries, "project");
  const billable = rows.filter((row) => row.isBillable);
  const nonBillable = rows.filter((row) => !row.isBillable);
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">Project Summary</h2>
      <div className="mt-5 space-y-6">
        <ProjectSection
          title="Billable Projects"
          rows={billable}
          tone="billable"
        />
        <ProjectSection
          title="Non-billable Projects"
          rows={nonBillable}
          tone="non_billable"
        />
      </div>
    </article>
  );
}
export function ClientSummary({ entries }: { entries: TeamEntry[] }) {
  return <Allocation title="Client Summary" rows={group(entries, "client")} />;
}

function group(entries: TeamEntry[], type: "project" | "client") {
  const rows = new Map<
    string,
    { name: string; detail?: string; hours: number; isBillable?: boolean }
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
      isBillable:
        type === "project" ? entry.projects?.is_billable !== false : undefined,
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
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      <AllocationRows rows={rows} />
    </article>
  );
}

function ProjectSection({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: { name: string; detail?: string; hours: number }[];
  tone: "billable" | "non_billable";
}) {
  const total = rows.reduce((sum, row) => sum + row.hours, 0);
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h3
          className={`text-xs font-bold uppercase tracking-[0.12em] ${tone === "billable" ? "text-[#153E90]" : "text-violet-600"}`}
        >
          {title}
        </h3>
        <span className="text-xs font-bold text-slate-400">
          {rows.length} {rows.length === 1 ? "project" : "projects"} ·{" "}
          {formatDecimalHours(total)}
        </span>
      </div>
      <AllocationRows
        rows={rows}
        barClassName={tone === "billable" ? "bg-[#153E90]" : "bg-violet-400"}
        emptyMessage={`No ${tone === "billable" ? "billable" : "non-billable"} projects.`}
      />
    </section>
  );
}

function AllocationRows({
  rows,
  barClassName = "bg-[#153E90]",
  emptyMessage = "No allocation data.",
}: {
  rows: { name: string; detail?: string; hours: number }[];
  barClassName?: string;
  emptyMessage?: string;
}) {
  const total = rows.reduce((sum, row) => sum + row.hours, 0);
  return (
    <div className="mt-4 space-y-4">
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
                  className={`h-full rounded-full ${barClassName}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })
      ) : (
        <p className="rounded-xl bg-slate-50 px-3 py-5 text-center text-xs text-slate-400">
          {emptyMessage}
        </p>
      )}
    </div>
  );
}
