import type { ChartDatum } from "./types";

export default function TopEntitiesList({
  title,
  data,
  total,
}: {
  title: string;
  data: ChartDatum[];
  total: number;
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-bold text-slate-950">{title}</h3>
      <div className="mt-4 space-y-3">
        {data.length ? (
          data.slice(0, 5).map((item, index) => {
            const percentage = total ? (item.hours / total) * 100 : 0;
            return (
              <div key={item.name} className="rounded-2xl bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#153E90] text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <p className="truncate text-sm font-bold text-slate-900">
                      {item.name}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-[#153E90]">
                    {item.hours.toFixed(2)} hrs
                  </p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-[#153E90]"
                    style={{ width: `${Math.min(100, percentage)}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-[10px] font-semibold text-slate-400">
                  {percentage.toFixed(1)}%
                </p>
              </div>
            );
          })
        ) : (
          <p className="rounded-2xl bg-slate-50 py-10 text-center text-sm text-slate-400">
            No data
          </p>
        )}
      </div>
    </article>
  );
}
