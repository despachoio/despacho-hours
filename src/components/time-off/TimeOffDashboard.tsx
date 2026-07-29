import KairoCard from "@/components/ui/KairoCard";
import type { ReactNode } from "react";
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

function formatWeekday(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
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
  const stats: Array<{ label: string; value: ReactNode; tone: string }> = [
    { label: "Available Paid Leave", value: dayValue(dashboard.available_paid_days), tone: "text-blue-800" },
    { label: "Pending Requests", value: String(dashboard.pending_requests), tone: "text-amber-700" },
    { label: "Approved Upcoming", value: String(dashboard.approved_upcoming_requests), tone: "text-emerald-700" },
    { label: "Unplanned Used", value: dayValue(dashboard.unplanned_used_days), tone: "text-orange-700" },
    { label: "LOP Used", value: dayValue(dashboard.lop_used_days), tone: "text-rose-700" },
    {
      label: "Next Company Holiday",
      value: dashboard.next_holiday
        ? <><span className="block">{dashboard.next_holiday.name}</span><span className="mt-1 block text-sm font-semibold text-violet-600">{formatDate(dashboard.next_holiday.date)}</span></>
        : "No upcoming holiday",
      tone: "text-violet-700",
    },
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
        {stats.map((stat) => (
          <KairoCard key={stat.label} className="group relative overflow-hidden border-slate-200/80 bg-gradient-to-br from-white via-slate-50/90 to-blue-50/90 p-5 shadow-[0_20px_46px_-32px_rgba(15,23,42,.65)] ring-1 ring-inset ring-white transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_26px_54px_-30px_rgba(21,62,144,.42)]">
            <span className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-blue-300/20 blur-3xl transition duration-500 group-hover:scale-125 group-hover:bg-cyan-300/25" />
            <span className="absolute inset-x-5 top-0 h-1 rounded-b-full bg-gradient-to-r from-[#153E90] via-blue-500 to-cyan-400 shadow-sm" />
            <span className="pointer-events-none absolute bottom-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
            <p className="relative text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{stat.label}</p>
            <div className={`relative mt-4 text-[1.35rem] font-bold tracking-tight ${stat.tone}`}>{stat.value}</div>
          </KairoCard>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <KairoCard className="relative overflow-hidden border-blue-100 bg-gradient-to-br from-blue-50/90 via-white to-cyan-50/70 p-6 shadow-[0_22px_55px_-36px_rgba(21,62,144,.75)]">
          <span className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-blue-200/35 blur-3xl" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="relative">
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
          <div className="relative mt-7 flex h-3 overflow-hidden rounded-full bg-white shadow-inner ring-1 ring-blue-100" aria-label="Leave balance utilisation">
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
              <div key={label} className="rounded-xl border border-white/90 bg-white/75 px-3 py-3 shadow-sm backdrop-blur">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
                <dd className="mt-1 text-sm font-bold text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </KairoCard>

        <KairoCard className="relative overflow-hidden border-indigo-100 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/70 p-6 shadow-[0_22px_55px_-36px_rgba(79,70,229,.55)]">
          <span className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-violet-200/40 blur-3xl" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#153E90]">Policy status</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">
            {dashboard.policy_tier === "first_year" ? "First-year accrual" : "Annual entitlement"}
          </h2>
          <dl className="relative mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-white/90 bg-white/75 p-3 shadow-sm"><dt className="text-slate-400">Service</dt><dd className="mt-1 font-bold">{formatService(dashboard.service_completed_months)}</dd></div>
            <div className="rounded-xl border border-white/90 bg-white/75 p-3 shadow-sm"><dt className="text-slate-400">{dashboard.parental_leave_label}</dt><dd className={`mt-1 font-bold ${dashboard.parental_leave_eligible ? "text-emerald-700" : "text-slate-700"}`}>{dashboard.parental_leave_eligible ? "Yes" : "No"}</dd></div>
            <div className="rounded-xl border border-white/90 bg-white/75 p-3 shadow-sm"><dt className="text-slate-400">Monthly applications</dt><dd className="mt-1 font-bold">{dashboard.monthly_application_allowance}</dd></div>
            <div className="rounded-xl border border-white/90 bg-white/75 p-3 shadow-sm"><dt className="text-slate-400">Monthly paid days</dt><dd className="mt-1 font-bold">{dashboard.monthly_day_allowance}</dd></div>
            <div className="rounded-xl border border-white/90 bg-white/75 p-3 shadow-sm"><dt className="text-slate-400">Unplanned remaining</dt><dd className="mt-1 font-bold">{dayValue(dashboard.unplanned_remaining_days)}</dd></div>
            <div className="rounded-xl border border-white/90 bg-white/75 p-3 shadow-sm"><dt className="text-slate-400">Extended exception</dt><dd className="mt-1 font-bold capitalize">{dashboard.extended_exception_status.replaceAll("_", " ")}</dd></div>
          </dl>
          {dashboard.extended_exception_reason ? (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
              {dashboard.extended_exception_reason}
            </p>
          ) : null}
        </KairoCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <KairoCard className="overflow-hidden border-emerald-100 p-0 shadow-[0_20px_50px_-38px_rgba(5,150,105,.7)]">
          <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50/70 px-6 py-5"><h2 className="text-lg font-bold text-slate-950">Upcoming leave</h2><p className="mt-1 text-xs text-slate-500">Your approved time away at a glance.</p></div>
          <div className="space-y-3 p-5">
            {upcoming.length ? upcoming.map((request) => (
              <article key={request.id} className="flex items-center gap-3 rounded-xl border border-emerald-100/80 bg-gradient-to-r from-emerald-50/70 to-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="h-10 w-1 rounded-full" style={{ backgroundColor: request.leave_types?.colour || "#153E90" }} />
                <div className="min-w-0 flex-1"><p className="font-bold text-slate-900">{request.leave_types?.name}</p><p className="text-xs text-slate-500">{formatDate(request.start_date)} – {formatDate(request.end_date)}</p></div>
                <span className="text-sm font-bold text-[#153E90]">{dayValue(request.working_days)}</span>
              </article>
            )) : <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">No upcoming approved leave.</p>}
          </div>
        </KairoCard>
        <KairoCard className="overflow-hidden p-0">
          <div className="border-b border-violet-100 bg-gradient-to-r from-violet-50 via-white to-fuchsia-50/60 px-6 py-5"><h2 className="text-lg font-bold text-slate-950">Company holidays</h2><p className="mt-1 text-xs text-slate-500">Official holidays for {dashboard.leave_year}, listed chronologically.</p></div>
          <div className="divide-y divide-violet-100/70">
            {[...holidays].sort((left, right) => left.holiday_date.localeCompare(right.holiday_date)).map((holiday) => {
              const isNext = holiday.holiday_date === dashboard.next_holiday?.date;
              return <article key={holiday.id} className={`relative grid gap-1 px-5 py-3.5 text-sm transition sm:grid-cols-[112px_105px_1fr] sm:items-center sm:gap-3 ${isNext ? "bg-gradient-to-r from-violet-100 via-fuchsia-50 to-amber-50 text-violet-950" : "bg-white hover:bg-violet-50/50"}`}>
                {isNext ? <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-violet-600 to-fuchsia-500" /> : null}
                <time dateTime={holiday.holiday_date} className={`font-bold ${isNext ? "text-violet-800" : "text-slate-600"}`}>{formatDate(holiday.holiday_date)}</time>
                <span className={isNext ? "font-semibold text-fuchsia-700" : "text-slate-500"}>{formatWeekday(holiday.holiday_date)}</span>
                <span className="flex min-w-0 items-center justify-between gap-3 font-bold text-slate-950"><span>{holiday.name}</span>{isNext ? <span className="shrink-0 rounded-full bg-violet-700 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">Next holiday</span> : null}</span>
              </article>;
            })}
            {!holidays.length ? <p className="px-6 py-10 text-center text-sm text-slate-400">No company holidays configured for {dashboard.leave_year}.</p> : null}
          </div>
        </KairoCard>
        <KairoCard className="overflow-hidden border-sky-100 p-0 shadow-[0_20px_50px_-38px_rgba(2,132,199,.7)]">
          <div className="border-b border-sky-100 bg-gradient-to-r from-sky-50 via-white to-blue-50/70 px-6 py-5"><h2 className="text-lg font-bold text-slate-950">Recent requests</h2><p className="mt-1 text-xs text-slate-500">Latest leave activity and approval status.</p></div>
          <div className="space-y-3 p-5">
            {requests.slice(0, 6).map((request) => {
              const pendingRequest = request.status === "pending";
              const approvedRequest = ["approved", "cancellation_rejected"].includes(request.status);
              return <article key={request.id} className="rounded-xl border border-sky-100/80 bg-gradient-to-r from-sky-50/65 to-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center justify-between gap-3"><p className="font-bold text-slate-900">{request.leave_types?.name}</p><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${pendingRequest ? "bg-amber-100 text-amber-800" : approvedRequest ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{request.status.replaceAll("_", " ")}</span></div><p className="mt-1 text-xs text-slate-500">{formatDate(request.start_date)} · {dayValue(request.working_days)}</p></article>;
            })}
            {!requests.length ? <p className="rounded-xl border border-dashed border-sky-200 py-8 text-center text-sm text-slate-400">No leave requests yet.</p> : null}
          </div>
        </KairoCard>
      </section>
    </div>
  );
}
