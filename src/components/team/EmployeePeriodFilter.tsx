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
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-3">
        <PeriodSelect value={period} onChange={onPeriod} />
        {period === "custom" ? (
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
