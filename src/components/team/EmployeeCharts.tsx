import {
  DailyTrendChart,
  HoursBarChart,
} from "@/components/reports/ReportCharts";
import type { TeamEntry } from "./types";

export default function EmployeeCharts({
  entries,
  from,
  to,
}: {
  entries: TeamEntry[];
  from: string;
  to: string;
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-3">
      <DailyTrendChart data={daily(entries, from, to)} />
      <HoursBarChart
        title="Project Allocation"
        data={group(entries, "project")}
      />
      <HoursBarChart
        title="Client Allocation"
        data={group(entries, "client")}
      />
    </section>
  );
}
function group(entries: TeamEntry[], type: "project" | "client") {
  const rows = new Map<string, number>();
  for (const entry of entries) {
    const name =
      type === "project"
        ? entry.projects?.project_code
          ? `[${entry.projects.project_code}] ${entry.projects.name}`
          : entry.projects?.name
        : entry.projects?.clients?.name;
    if (name) rows.set(name, (rows.get(name) || 0) + Number(entry.hours || 0));
  }
  return Array.from(rows, ([name, hours]) => ({ name, hours }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 10);
}
function daily(entries: TeamEntry[], from: string, to: string) {
  const totals = new Map<string, number>();
  for (const entry of entries)
    totals.set(
      entry.entry_date,
      (totals.get(entry.entry_date) || 0) + Number(entry.hours || 0),
    );
  if (!from || !to) return [];
  const rows: { date: string; hours: number }[] = [];
  const current = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (current <= end) {
    const date = current.toISOString().slice(0, 10);
    rows.push({ date, hours: totals.get(date) || 0 });
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return rows;
}
