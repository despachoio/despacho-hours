"use client";

import { PeriodSelect } from "./TeamFilters";

export type AnalyticsFilterValue = {
  period: string;
  customFrom: string;
  customTo: string;
  clientId: string;
  projectId: string;
};

export type AnalyticsFilterOption = { id: string; label: string };

const controlClass =
  "h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition-colors focus:border-[#153E90] focus:ring-4 focus:ring-[#153E90]/10";

export default function EmployeePeriodFilter({
  value,
  clients,
  projects,
  error,
  exporting,
  onChange,
  onSearch,
  onReset,
  onDownloadCsv,
  onDownloadPdf,
}: {
  value: AnalyticsFilterValue;
  clients: AnalyticsFilterOption[];
  projects: AnalyticsFilterOption[];
  error: string;
  exporting: "csv" | "pdf" | "";
  onChange: (next: AnalyticsFilterValue) => void;
  onSearch: () => void;
  onReset: () => void;
  onDownloadCsv: () => void;
  onDownloadPdf: () => void;
}) {
  const update = <K extends keyof AnalyticsFilterValue>(
    key: K,
    next: AnalyticsFilterValue[K],
  ) => onChange({ ...value, [key]: next });
  const custom = value.period === "custom";

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/40">
      <div
        className={`grid gap-3 ${custom ? "md:grid-cols-2 xl:grid-cols-5" : "md:grid-cols-3"}`}
      >
        <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[.1em] text-slate-500">
          Date Range
          <PeriodSelect
            value={value.period}
            onChange={(next) => update("period", next)}
            ariaLabel="Date Range"
          />
        </label>
        {custom ? (
          <>
            <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[.1em] text-slate-500">
              From Date
              <input
                type="date"
                aria-label="From Date"
                value={value.customFrom}
                onChange={(event) => update("customFrom", event.target.value)}
                className={controlClass}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[.1em] text-slate-500">
              To Date
              <input
                type="date"
                aria-label="To Date"
                value={value.customTo}
                onChange={(event) => update("customTo", event.target.value)}
                className={controlClass}
              />
            </label>
          </>
        ) : null}
        <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[.1em] text-slate-500">
          Client
          <select
            aria-label="Client"
            value={value.clientId}
            onChange={(event) =>
              onChange({
                ...value,
                clientId: event.target.value,
                projectId: "",
              })
            }
            className={controlClass}
          >
            <option value="">All Clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-bold uppercase tracking-[.1em] text-slate-500">
          Project
          <select
            aria-label="Project"
            value={value.projectId}
            onChange={(event) => update("projectId", event.target.value)}
            className={controlClass}
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onSearch}
          className="h-11 rounded-xl bg-gradient-to-r from-[#153E90] to-blue-700 px-5 text-sm font-bold text-white shadow-lg shadow-blue-900/15"
        >
          Search
        </button>
        <button
          type="button"
          onClick={onReset}
          className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-600 hover:bg-slate-50"
        >
          Reset
        </button>
        <button
          type="button"
          disabled={Boolean(exporting)}
          onClick={onDownloadCsv}
          className="h-11 min-w-32 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-bold text-[#153E90] disabled:cursor-wait disabled:opacity-50"
        >
          {exporting === "csv" ? "Downloading…" : "Download CSV"}
        </button>
        <button
          type="button"
          disabled={Boolean(exporting)}
          onClick={onDownloadPdf}
          className="h-11 min-w-32 rounded-xl bg-[#153E90] px-4 text-sm font-bold text-white disabled:cursor-wait disabled:bg-slate-300"
        >
          {exporting === "pdf" ? "Downloading…" : "Download PDF"}
        </button>
      </div>
    </section>
  );
}
