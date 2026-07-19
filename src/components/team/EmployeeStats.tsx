import type { EmployeeAnalytics } from "./types";
import { formatDecimalHours } from "@/lib/format-hours";

export default function EmployeeStats({
  analytics,
}: {
  analytics: EmployeeAnalytics;
}) {
  const metrics = [
    ["Hours", `${formatDecimalHours(analytics.hours)} hrs`],
    ["Entries", String(analytics.entries.length)],
    ["Average Session", `${formatDecimalHours(analytics.averageSession)} hrs`],
    ["Longest Session", `${formatDecimalHours(analytics.longestSession)} hrs`],
    ["Projects Worked", String(analytics.projects)],
    ["Clients Worked", String(analytics.clients)],
    ["Total Billable Hours", formatDecimalHours(analytics.billableHours)],
  ];
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {metrics.map(([label, value]) => (
        <article
          key={label}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <p className="text-xs font-semibold text-slate-400">{label}</p>
          <p className="mt-2 text-xl font-bold text-slate-950">{value}</p>
        </article>
      ))}
    </section>
  );
}
