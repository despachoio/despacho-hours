import type { EmployeeAnalytics } from "./types";
import { initials, statusLabel } from "./utils";

export default function EmployeeHeader({
  analytics,
  actions,
}: {
  analytics: EmployeeAnalytics;
  actions?: React.ReactNode;
}) {
  const { employee, timer, status } = analytics;
  const isActive = String(employee.status || "").toLowerCase() === "active";
  return (
    <header className="relative overflow-hidden rounded-[2rem] bg-[#0F172A] px-8 py-9 text-white shadow-xl shadow-slate-300/50">
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#153E90]/70 blur-3xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-white/10 text-2xl font-bold ring-1 ring-white/15">
            {initials(employee.name)}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">
              {employee.employee_code || "Employee analytics"}
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">
              {employee.title ? `${employee.title} ` : ""}
              {employee.name}
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              {employee.role || "Team Member"}
              {employee.department ? ` · ${employee.department}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${isActive ? "bg-emerald-400/15 text-emerald-200" : "bg-slate-400/15 text-slate-200"}`}
              >
                {isActive ? "Active" : "Inactive"}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
                {statusLabel(status)}
              </span>
              {timer ? (
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-200">
                  [{timer.projects?.project_code}] {timer.projects?.name}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
