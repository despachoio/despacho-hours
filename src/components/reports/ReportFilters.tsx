import type { FilterOption, ReportFiltersValue } from "./types";

export default function ReportFilters({
  value,
  onChange,
  employees,
  clients,
  projects,
  showEmployee,
  onClear,
}: {
  value: ReportFiltersValue;
  onChange: (next: ReportFiltersValue) => void;
  employees: FilterOption[];
  clients: FilterOption[];
  projects: FilterOption[];
  showEmployee: boolean;
  onClear: () => void;
}) {
  const update = (field: keyof ReportFiltersValue, next: string) =>
    onChange({ ...value, [field]: next });
  return (
    <section className="sticky top-3 z-20 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-lg shadow-slate-200/50 backdrop-blur">
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
          value={value.search}
          onChange={(event) => update("search", event.target.value)}
          placeholder="Search reports"
          className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-colors focus:border-[#153E90] focus:ring-4 focus:ring-[#153E90]/10"
        />
        <button
          type="button"
          onClick={onClear}
          className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#153E90]/10"
        >
          Reset
        </button>
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
    </section>
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
