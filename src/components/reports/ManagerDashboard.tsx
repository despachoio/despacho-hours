import KpiCard from "./KpiCard";

export type ManagerMetrics = {
  today: number;
  yesterday: number;
  week: number;
  previousWeek: number;
  month: number;
  runningTimers: number;
  employeesWorking: number;
  employeesTotal: number;
  employeesOnline: number;
  activeProjects: number;
  clientsToday: number;
  trackedHours: number;
  averageSession: number;
  averageUtilisation: number;
  remainingHours: number;
};

export default function ManagerDashboard({
  metrics,
  personal,
  todayComparison,
  weekComparison,
}: {
  metrics: ManagerMetrics;
  personal: boolean;
  todayComparison?: { text: string; tone: "positive" | "negative" | "neutral" };
  weekComparison?: { text: string; tone: "positive" | "negative" | "neutral" };
}) {
  const cards = personal
    ? [
        {
          label: "Today’s Hours",
          value: `${metrics.today.toFixed(2)} hrs`,
          comparison: todayComparison,
        },
        {
          label: "Yesterday’s Hours",
          value: `${metrics.yesterday.toFixed(2)} hrs`,
        },
        {
          label: "This Week’s Hours",
          value: `${metrics.week.toFixed(2)} hrs`,
          comparison: weekComparison,
        },
        {
          label: "This Month’s Hours",
          value: `${metrics.month.toFixed(2)} hrs`,
        },
        {
          label: "Average Session",
          value: `${metrics.averageSession.toFixed(2)} hrs`,
        },
        {
          label: "Weekly Utilisation",
          value: `${metrics.averageUtilisation.toFixed(0)}%`,
        },
      ]
    : [
        {
          label: "Today’s Hours",
          value: `${metrics.today.toFixed(2)} hrs`,
          comparison: todayComparison,
        },
        {
          label: "Yesterday’s Hours",
          value: `${metrics.yesterday.toFixed(2)} hrs`,
        },
        {
          label: "This Week’s Hours",
          value: `${metrics.week.toFixed(2)} hrs`,
          comparison: weekComparison,
        },
        {
          label: "This Month’s Hours",
          value: `${metrics.month.toFixed(2)} hrs`,
        },
        {
          label: "Running Timers",
          value: String(metrics.runningTimers),
          accent: "green" as const,
        },
        {
          label: "Employees Working",
          value: `${metrics.employeesWorking} / ${metrics.employeesTotal}`,
        },
        {
          label: "Employees Online",
          value: String(metrics.employeesOnline),
          accent: "green" as const,
        },
        { label: "Active Projects", value: String(metrics.activeProjects) },
        { label: "Clients Served Today", value: String(metrics.clientsToday) },
        {
          label: "Tracked Hours",
          value: `${metrics.trackedHours.toFixed(2)} hrs`,
          note: "No billable field is configured",
        },
        {
          label: "Average Session",
          value: `${metrics.averageSession.toFixed(2)} hrs`,
        },
        {
          label: "Average Utilisation",
          value: `${metrics.averageUtilisation.toFixed(0)}%`,
          accent: "violet" as const,
        },
        {
          label: "Remaining Project Hours",
          value: `${metrics.remainingHours.toFixed(2)} hrs`,
          accent: "amber" as const,
        },
      ];
  return (
    <section>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#153E90]">
          {personal ? "Personal overview" : "Manager dashboard"}
        </p>
        <h2 className="mt-1 text-2xl font-bold text-slate-950">
          {personal ? "Your operational health" : "Current operational health"}
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Live-now values are independent of the historical date filter.
        </p>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {cards.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>
    </section>
  );
}
