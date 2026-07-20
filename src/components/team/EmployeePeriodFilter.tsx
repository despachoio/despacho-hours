"use client";

import { PeriodSelect } from "./TeamFilters";

export default function EmployeePeriodFilter({
  period,
  from,
  to,
  onPeriod,
  onFrom,
  onTo,
}: {
  period: string;
  from: string;
  to: string;
  onPeriod: (value: string) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
  const isCustomRange = period === "custom";

  return (
    <div className="inline-block max-w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div
        className={
          isCustomRange
            ? "grid gap-3 sm:grid-cols-3"
            : "w-fit max-w-full"
        }
      >
        <PeriodSelect value={period} onChange={onPeriod} />
        {isCustomRange ? (
          <>
            <input
              type="date"
              aria-label="Custom start date"
              value={from}
              onChange={(event) => onFrom(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
            />
            <input
              type="date"
              aria-label="Custom end date"
              value={to}
              onChange={(event) => onTo(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
