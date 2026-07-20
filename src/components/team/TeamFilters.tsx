"use client";

import type { TeamEmployee, TeamFilterValue } from "./types";

export default function TeamFilters({
  value,
  onChange,
  employees,
  departments,
  showEmployee,
}: {
  value: TeamFilterValue;
  onChange: (next: TeamFilterValue) => void;
  employees: TeamEmployee[];
  departments: string[];
  showEmployee: boolean;
}) {
  const update = (field: keyof TeamFilterValue, next: string) =>
    onChange({ ...value, [field]: next });
  return (
    <section className="sticky top-3 z-20 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-lg shadow-slate-200/50 backdrop-blur">
      <div
        className={`grid gap-3 md:grid-cols-2 ${showEmployee ? "xl:grid-cols-6" : "xl:grid-cols-5"}`}
      >
        {showEmployee ? (
          <select
            aria-label="Employee"
            value={value.employeeId}
            onChange={(event) => update("employeeId", event.target.value)}
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-colors focus:border-[#153E90] focus:ring-4 focus:ring-[#153E90]/10"
          >
            <option value="">All Employees</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        ) : null}
        <select
          aria-label="Status"
          value={value.status}
          onChange={(event) => update("status", event.target.value)}
          className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-colors focus:border-[#153E90] focus:ring-4 focus:ring-[#153E90]/10"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="working">Working</option>
          <option value="paused">Paused</option>
          <option value="offline">Offline</option>
        </select>
        <select
          aria-label="Department"
          value={value.department}
          onChange={(event) => update("department", event.target.value)}
          className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-colors focus:border-[#153E90] focus:ring-4 focus:ring-[#153E90]/10"
        >
          <option value="">All Departments</option>
          {departments.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </select>
        <PeriodSelect
          value={value.period}
          onChange={(next) => update("period", next)}
        />
        <input
          data-shortcut-search
          value={value.search}
          onChange={(event) => update("search", event.target.value)}
          placeholder="Search employees"
          className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-colors focus:border-[#153E90] focus:ring-4 focus:ring-[#153E90]/10"
        />
        <button
          type="button"
          onClick={() =>
            onChange({
              employeeId: "",
              status: "",
              department: "",
              period: "this_week",
              customFrom: "",
              customTo: "",
              search: "",
            })
          }
          className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#153E90]/10"
        >
          Reset
        </button>
      </div>
      {value.period === "custom" ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:max-w-xl">
          <input
            type="date"
            aria-label="Custom start date"
            value={value.customFrom}
            onChange={(event) => update("customFrom", event.target.value)}
            className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-[#153E90] focus:ring-4 focus:ring-[#153E90]/10"
          />
          <input
            type="date"
            aria-label="Custom end date"
            value={value.customTo}
            onChange={(event) => update("customTo", event.target.value)}
            className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-[#153E90] focus:ring-4 focus:ring-[#153E90]/10"
          />
        </div>
      ) : null}
    </section>
  );
}

export function PeriodSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label="Period"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition-colors focus:border-[#153E90] focus:ring-4 focus:ring-[#153E90]/10"
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
  );
}
