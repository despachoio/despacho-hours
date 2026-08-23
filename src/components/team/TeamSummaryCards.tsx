import type { TeamMetrics } from "@/lib/metrics/types";
import { formatDecimalHours } from "@/lib/format-hours";

export default function TeamSummaryCards({
  metrics: summary,
  personal,
}: {
  metrics: TeamMetrics;
  personal: boolean;
}) {
  const metrics = personal
    ? [
        ["My Hours", `${formatDecimalHours(summary.totalHoursLogged)} hrs`],
        [
          "My Utilisation",
          `${summary.aggregateUtilization.toFixed(0)}%`,
        ],
        ["Projects", String(summary.projectsWorked)],
        ["Clients", String(summary.clientsServed)],
        [
          "Average Session",
          `${formatDecimalHours(summary.averageSessionHours)} hrs`,
        ],
      ]
    : [
        ["Employees", String(summary.employeeCount)],
        ["Currently Working", String(summary.currentlyWorkingCount)],
        ["Projects Worked", String(summary.projectsWorked)],
        ["Clients Served", String(summary.clientsServed)],
        ["Hours Logged", `${formatDecimalHours(summary.totalHoursLogged)} hrs`],
        [
          "Billable Hours",
          `${formatDecimalHours(summary.totalBillableHours)} hrs`,
        ],
        [
          "Average Utilisation",
          `${summary.aggregateUtilization.toFixed(0)}%`,
        ],
      ];
  const visualTones = [
    { accent: "from-[#153E90] to-cyan-400", surface: "from-white via-white to-blue-50/80", badge: "bg-blue-50 text-[#153E90] ring-blue-100" },
    { accent: "from-emerald-600 to-teal-300", surface: "from-white via-white to-emerald-50/80", badge: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
    { accent: "from-violet-600 to-fuchsia-300", surface: "from-white via-white to-violet-50/75", badge: "bg-violet-50 text-violet-700 ring-violet-100" },
    { accent: "from-cyan-600 to-sky-300", surface: "from-white via-white to-cyan-50/75", badge: "bg-cyan-50 text-cyan-700 ring-cyan-100" },
    { accent: "from-amber-500 to-orange-300", surface: "from-white via-white to-amber-50/70", badge: "bg-amber-50 text-amber-700 ring-amber-100" },
    { accent: "from-indigo-600 to-blue-300", surface: "from-white via-white to-indigo-50/70", badge: "bg-indigo-50 text-indigo-700 ring-indigo-100" },
    { accent: "from-rose-600 to-pink-300", surface: "from-white via-white to-rose-50/70", badge: "bg-rose-50 text-rose-700 ring-rose-100" },
  ] as const;
  return (
    <section
      className={`grid gap-4 sm:grid-cols-2 ${personal ? "xl:grid-cols-5" : "xl:grid-cols-4 2xl:grid-cols-7"}`}
    >
      {metrics.map(([label, value], index) => {
        const tone = visualTones[index % visualTones.length];
        return <article
          key={label}
          className={`group relative min-h-32 overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br ${tone.surface} p-5 shadow-lg shadow-slate-200/55 transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-100/70`}
        >
          <span className={`absolute inset-x-5 top-0 h-1 rounded-b-full bg-gradient-to-r ${tone.accent}`} />
          <span aria-hidden="true" className={`absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-2xl text-xs font-black ring-1 ${tone.badge}`}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <p className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            {label}
          </p>
          <p className="mt-4 whitespace-nowrap text-2xl font-bold tracking-tight text-[#153E90]">
            {value}
          </p>
        </article>;
      })}
    </section>
  );
}
