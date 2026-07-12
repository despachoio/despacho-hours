import type { EmployeeAnalytics } from "./types";

export default function TeamSummaryCards({
  analytics,
  personal,
}: {
  analytics: EmployeeAnalytics[];
  personal: boolean;
}) {
  const hours = analytics.reduce((sum, item) => sum + item.hours, 0);
  const expected = analytics.reduce((sum, item) => sum + item.expectedHours, 0);
  const projects = new Set(
    analytics.flatMap((item) => item.entries.map((entry) => entry.project_id)),
  ).size;
  const clients = new Set(
    analytics.flatMap((item) =>
      item.entries.map((entry) => entry.projects?.clients?.id).filter(Boolean),
    ),
  ).size;
  const entries = analytics.flatMap((item) => item.entries);
  const metrics = personal
    ? [
        ["My Hours", `${hours.toFixed(2)} hrs`],
        [
          "My Utilisation",
          `${(expected ? (hours / expected) * 100 : 0).toFixed(0)}%`,
        ],
        ["Projects", String(projects)],
        ["Clients", String(clients)],
        [
          "Average Session",
          `${(entries.length ? hours / entries.length : 0).toFixed(2)} hrs`,
        ],
      ]
    : [
        ["Employees", String(analytics.length)],
        [
          "Currently Working",
          String(
            analytics.filter(
              (item) => item.status === "working" || item.status === "paused",
            ).length,
          ),
        ],
        [
          "Average Utilisation",
          `${(expected ? (hours / expected) * 100 : 0).toFixed(0)}%`,
        ],
        ["Hours Logged", `${hours.toFixed(2)} hrs`],
        ["Projects Worked", String(projects)],
        ["Clients Served", String(clients)],
        [
          "Average Daily Hours",
          `${(analytics.length ? analytics.reduce((sum, item) => sum + item.averageDailyHours, 0) / analytics.length : 0).toFixed(2)} hrs`,
        ],
      ];
  return (
    <section
      className={`grid gap-4 sm:grid-cols-2 ${personal ? "xl:grid-cols-5" : "xl:grid-cols-4 2xl:grid-cols-7"}`}
    >
      {metrics.map(([label, value]) => (
        <article
          key={label}
          className="relative min-h-32 overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
        >
          <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-gradient-to-r from-[#153E90] to-blue-300" />
          <p className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            {label}
          </p>
          <p className="mt-4 whitespace-nowrap text-2xl font-bold tracking-tight text-[#153E90]">
            {value}
          </p>
        </article>
      ))}
    </section>
  );
}
