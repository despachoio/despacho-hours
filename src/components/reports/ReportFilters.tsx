import type { ReactNode } from "react";
import type { FilterOption, ReportFiltersValue } from "./types";

export default function ReportFilters({
  value,
  onChange,
  employees,
  clients,
  projects,
  showEmployee,
  onSearch,
  onClear,
  exportActions,
  searching = false,
  hasUnappliedChanges = false,
}: {
  value: ReportFiltersValue;
  onChange: (next: ReportFiltersValue) => void;
  employees: FilterOption[];
  clients: FilterOption[];
  projects: FilterOption[];
  showEmployee: boolean;
  onSearch: () => void;
  onClear: () => void;
  exportActions?: ReactNode;
  searching?: boolean;
  hasUnappliedChanges?: boolean;
}) {
  const update = (field: keyof ReportFiltersValue, next: string) =>
    onChange({ ...value, [field]: next });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSearch();
      }}
      className="sticky top-3 z-20 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-lg shadow-slate-200/50 backdrop-blur"
    >
      <div
        className={`grid gap-3 md:grid-cols-2 ${showEmployee ? "xl:grid-cols-7" : "xl:grid-cols-6"}`}
      >
        {showEmployee ? (
          <Select
            value={value.employeeId}
            onChange={(next) => update("employeeId", next)}
            label="Employee"
            options={employees}
            all="All Employees"
          />
        ) : null}
        <Select
          value={value.clientId}
          onChange={(next) => update("clientId", next)}
          label="Client"
          options={clients}
          all="All Clients"
        />
        <Select
          value={value.projectId}
          onChange={(next) => update("projectId", next)}
          label="Project"
          options={projects}
          all="All Projects"
        />
        <label className="block">
          <span className="sr-only">Billing Type</span>
          <select
            value={value.billingType}
            onChange={(event) => update("billingType", event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-colors focus:border-[#153E90] focus:ring-4 focus:ring-[#153E90]/10"
          >
            <option value="all">All Project Types</option>
            <option value="billable">Billable Projects</option>
            <option value="non_billable">Non-billable Projects</option>
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Date Range</span>
          <select
            value={value.datePreset}
            onChange={(event) => update("datePreset", event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-colors focus:border-[#153E90] focus:ring-4 focus:ring-[#153E90]/10"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_week">This Week</option>
            <option value="last_week">Last Week</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_quarter">This Quarter</option>
            <option value="last_quarter">Last Quarter</option>
            <option value="custom">Custom Range</option>
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Status</span>
          <select
            value={value.status}
            onChange={(event) => update("status", event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-colors focus:border-[#153E90] focus:ring-4 focus:ring-[#153E90]/10"
          >
            <option value="all">All Statuses</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <input
          data-shortcut-search
          value={value.search}
          onChange={(event) => update("search", event.target.value)}
          placeholder="Search reports"
          className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-colors focus:border-[#153E90] focus:ring-4 focus:ring-[#153E90]/10"
        />
      </div>
      {value.datePreset === "custom" ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:max-w-xl">
          <input
            aria-label="Custom start date"
            type="date"
            value={value.customFrom}
            onChange={(event) => update("customFrom", event.target.value)}
            className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-[#153E90] focus:ring-4 focus:ring-[#153E90]/10"
          />
          <input
            aria-label="Custom end date"
            type="date"
            value={value.customTo}
            onChange={(event) => update("customTo", event.target.value)}
            className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-[#153E90] focus:ring-4 focus:ring-[#153E90]/10"
          />
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {hasUnappliedChanges ? (
          <p className="mr-auto text-xs font-semibold text-amber-700">
            Filters changed. Click Search to update the report.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={searching}
          className="h-11 rounded-xl bg-[#153E90] px-5 text-sm font-bold text-white transition-colors hover:bg-[#123578] disabled:cursor-wait disabled:opacity-60"
        >
          {searching ? "Searching…" : "Search"}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-bold text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#153E90]/10"
        >
          Reset
        </button>
      </div>
      {exportActions ? (
        <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-blue-50/70 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0F172A] text-white shadow-sm">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
              >
                <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
                <path d="M5 16v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-bold text-slate-950">
                Export filtered report
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Downloads contain only the filters applied with Search.
              </p>
            </div>
          </div>
          <div className="shrink-0">{exportActions}</div>
        </div>
      ) : null}
    </form>
  );
}

function Select({
  value,
  onChange,
  label,
  options,
  all,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: FilterOption[];
  all: string;
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-colors focus:border-[#153E90] focus:ring-4 focus:ring-[#153E90]/10"
      >
        <option value="">{all}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.code ? `[${option.code}] ` : ""}
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
