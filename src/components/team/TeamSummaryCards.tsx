import type { TeamMetrics } from "@/lib/metrics/types";

export default function TeamSummaryCards({
  metrics: summary,
  personal,
}: {
  metrics: TeamMetrics;
  personal: boolean;
}) {
  const metrics = personal
    ? [
        ["My Hours", `${summary.totalHoursLogged.toFixed(2)} hrs`],
        [
          "My Utilisation",
          `${summary.aggregateUtilization.toFixed(0)}%`,
        ],
        ["Projects", String(summary.projectsWorked)],
        ["Clients", String(summary.clientsServed)],
        [
          "Average Session",
          `${summary.averageSessionHours.toFixed(2)} hrs`,
        ],
      ]
    : [
        ["Employees", String(summary.employeeCount)],
        ["Currently Working", String(summary.currentlyWorkingCount)],
        [
          "Average Utilisation",
          `${summary.aggregateUtilization.toFixed(0)}%`,
        ],
        ["Hours Logged", `${summary.totalHoursLogged.toFixed(2)} hrs`],
        ["Projects Worked", String(summary.projectsWorked)],
        ["Clients Served", String(summary.clientsServed)],
        [
          "Average Daily Hours",
          `${summary.averageDailyHours.toFixed(2)} hrs`,
        ],
      ];
  return (
    <section
      className={`grid gap-4 sm:grid-cols-2 ${personal ? "xl:grid-cols-5" : "xl:grid-cols-4 2xl:grid-cols-7"}`}
    >
      {metrics.map(([label, value]) => (
        <article
          key={label}
          className="relative min-h-32 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
        >
          <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-[#153E90]" />
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
