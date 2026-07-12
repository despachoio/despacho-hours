import type { SummaryMetric } from "./types";

export default function PeriodSummaryCards({
  metrics,
}: {
  metrics: SummaryMetric[];
}) {
  return (
    <section>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#153E90]">
          Selected period
        </p>
        <h2 className="mt-1 text-2xl font-bold text-slate-950">
          Historical summary
        </h2>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-8">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-semibold text-slate-400">
              {metric.label}
            </p>
            <p className="mt-2 text-xl font-bold text-slate-950">
              {metric.value}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
