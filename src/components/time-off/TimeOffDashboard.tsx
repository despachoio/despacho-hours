import KairoCard from "@/components/ui/KairoCard";
import type {
  Holiday,
  LeaveRequest,
  TimeOffDashboard as DashboardData,
  TimeOffNotification,
} from "@/lib/time-off/client";
import { markNotificationRead } from "@/lib/time-off/client";

function dayValue(value: number) {
  return `${Number(value || 0).toFixed(value % 1 ? 1 : 0)} Days`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatService(completedMonths: number) {
  const months = Math.max(0, Math.floor(Number(completedMonths || 0)));
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const yearLabel = `${years} ${years === 1 ? "Year" : "Years"}`;
  const monthLabel = `${remainingMonths} ${remainingMonths === 1 ? "Month" : "Months"}`;
  return years > 0 ? `${yearLabel} ${monthLabel}` : monthLabel;
}

export default function TimeOffDashboard({
  dashboard,
  requests,
  holidays,
  notifications,
  onChanged,
  onRequestLeave,
}: {
  dashboard: DashboardData;
  requests: LeaveRequest[];
  holidays: Holiday[];
  notifications: TimeOffNotification[];
  onChanged: () => void;
  onRequestLeave: () => void;
}) {
  const upcoming = requests
    .filter((request) => ["approved", "cancellation_rejected"].includes(request.status))
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 4);
  const stats = [
    ["Available Paid Leave", dayValue(dashboard.available_paid_days), "text-[#153E90]"],
    ["Pending Requests", String(dashboard.pending_requests), "text-amber-600"],
    ["Approved Upcoming", String(dashboard.approved_upcoming_requests), "text-emerald-600"],
    ["Unplanned Used", dayValue(dashboard.unplanned_used_days), "text-orange-600"],
    ["LOP Used", dayValue(dashboard.lop_used_days), "text-red-600"],
    [
  "Next Company Holiday",
  dashboard.next_holiday
    ? `${dashboard.next_holiday.name} <span class="block">${formatDate(dashboard.next_holiday.date)}</span>`
    : "No upcoming holiday",
  "text-violet-700",
]
  ];
  const entitlement = Number(dashboard.entitlement_days || 0);
  const used = Number(dashboard.used_paid_days || 0);
  const pending = Number(dashboard.pending_paid_days || 0);
  const available = Math.max(Number(dashboard.available_paid_days || 0), 0);
  const denominator = Math.max(entitlement, used + pending + available, 1);

  return (
    <div className="space-y-6">
      {notifications.some((notification) => !notification.read_at) ? (
        <section aria-label="Time Off notifications" className="grid gap-3 lg:grid-cols-2">
          {notifications.filter((notification) => !notification.read_at).slice(0, 4).map((notification) => (
            <button key={notification.id} type="button" onClick={async () => { await markNotificationRead(notification.id); onChanged(); }} className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-left transition hover:border-blue-300">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#153E90]">Notification</span>
              <span className="mt-1 block font-bold text-slate-950">{notification.subject}</span>
              <span className="mt-1 block text-sm text-slate-600">{notification.body}</span>
            </button>
          ))}
        </section>
      ) : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {stats.map(([label, value, tone]) => (
          <KairoCard key={label} className="relative overflow-hidden p-5">
            <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-[#153E90]" />
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
              {label}
            </p>
            <p className={`mt-4 text-xl font-bold tracking-tight ${tone}`}>{value}</p>
          </KairoCard>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <KairoCard className="overflow-hidden p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#153E90]">
                Paid leave balance
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                {dayValue(available)} available
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Live balance for leave year {dashboard.leave_year}
              </p>
            </div>
            <button
              type="button"
              onClick={onRequestLeave}
              className="rounded-xl bg-[#153E90] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#153E90]/30"
            >
              Request Leave
            </button>
          </div>
          <div className="mt-7 flex h-3 overflow-hidden rounded-full bg-slate-100" aria-label="Leave balance utilisation">
            <span className="bg-emerald-500" style={{ width: `${(used / denominator) * 100}%` }} />
            <span className="bg-amber-400" style={{ width: `${(pending / denominator) * 100}%` }} />
            <span className="bg-[#153E90]" style={{ width: `${(available / denominator) * 100}%` }} />
          </div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Entitlement", dayValue(entitlement)],
              ["Used", dayValue(used)],
              ["Pending", dayValue(pending)],
              ["Available", dayValue(available)],
              ["LOP", dayValue(dashboard.lop_used_days)],
              ["Encashable", dayValue(dashboard.encashable_estimate_days)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
                <dd className="mt-1 text-sm font-bold text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </KairoCard>

        <KairoCard className="p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#153E90]">Policy status</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">
            {dashboard.policy_tier === "first_year" ? "First-year accrual" : "Annual entitlement"}
          </h2>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-slate-400">Service</dt><dd className="mt-1 font-bold">{formatService(dashboard.service_completed_months)}</dd></div>
            <div><dt className="text-slate-400">{dashboard.parental_leave_label}</dt><dd className={`mt-1 font-bold ${dashboard.parental_leave_eligible ? "text-emerald-700" : "text-slate-700"}`}>{dashboard.parental_leave_eligible ? "Yes" : "No"}</dd></div>
            <div><dt className="text-slate-400">Monthly applications</dt><dd className="mt-1 font-bold">{dashboard.monthly_application_allowance}</dd></div>
            <div><dt className="text-slate-400">Monthly paid days</dt><dd className="mt-1 font-bold">{dashboard.monthly_day_allowance}</dd></div>
            <div><dt className="text-slate-400">Unplanned remaining</dt><dd className="mt-1 font-bold">{dayValue(dashboard.unplanned_remaining_days)}</dd></div>
            <div><dt className="text-slate-400">Extended exception</dt><dd className="mt-1 font-bold capitalize">{dashboard.extended_exception_status.replaceAll("_", " ")}</dd></div>
          </dl>
          {dashboard.extended_exception_reason ? (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
              {dashboard.extended_exception_reason}
            </p>
          ) : null}
        </KairoCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <KairoCard className="p-6">
          <h2 className="text-lg font-bold text-slate-950">Upcoming leave</h2>
          <div className="mt-4 space-y-3">
            {upcoming.length ? upcoming.map((request) => (
              <article key={request.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <span className="h-10 w-1 rounded-full" style={{ backgroundColor: request.leave_types?.colour || "#153E90" }} />
                <div className="min-w-0 flex-1"><p className="font-bold text-slate-900">{request.leave_types?.name}</p><p className="text-xs text-slate-500">{formatDate(request.start_date)} – {formatDate(request.end_date)}</p></div>
                <span className="text-sm font-bold text-[#153E90]">{dayValue(request.working_days)}</span>
              </article>
            )) : <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">No upcoming approved leave.</p>}
          </div>
        </KairoCard>
        <KairoCard className="p-6">
          <h2 className="text-lg font-bold text-slate-950">Company holidays</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {holidays.map((holiday) => (
              <article key={holiday.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="font-bold text-slate-900">{holiday.name}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDate(holiday.holiday_date)}</p>
              </article>
            ))}
            {!holidays.length ? <p className="col-span-2 rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">No company holidays configured for {dashboard.leave_year}.</p> : null}
          </div>
        </KairoCard>
        <KairoCard className="p-6">
          <h2 className="text-lg font-bold text-slate-950">Recent requests</h2>
          <div className="mt-4 space-y-3">
            {requests.slice(0, 6).map((request) => <article key={request.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"><div className="flex items-center justify-between gap-3"><p className="font-bold text-slate-900">{request.leave_types?.name}</p><span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase text-slate-500">{request.status.replaceAll("_", " ")}</span></div><p className="mt-1 text-xs text-slate-500">{formatDate(request.start_date)} · {dayValue(request.working_days)}</p></article>)}
          </div>
        </KairoCard>
      </section>
    </div>
  );
}
