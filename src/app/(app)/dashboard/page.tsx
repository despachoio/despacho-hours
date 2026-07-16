"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Client = { id: string; status: string };

type Project = {
  id: string;
  name: string;
  project_code: string | null;
  remaining_hours: number;
  status: string;
};

type Employee = {
  id: string;
  name: string;
  time_entries: { hours: number; entry_date: string }[];
};

type Profile = { role: string; employee_id: string | null };

type InvoiceMetricRow = {
  currency: string;
  total_amount: number;
  paid_amount: number | null;
  status: string;
  issue_date: string;
  due_date: string;
};

type LiveTimer = {
  id: string;
  employee_id: string;
  started_at: string;
  paused_at: string | null;
  total_paused_seconds: number;
  status: string;
  description: string | null;
  employees: { name: string } | null;
  projects: {
    name: string;
    project_code: string | null;
    clients: { name: string } | null;
  } | null;
};

type CurrencySummary = {
  currency: string;
  open: number;
  paid: number;
  overdue: number;
};

const todayKey = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const money = (currency: string, amount: number) =>
  `${currency} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

function workedSeconds(timer: LiveTimer, now: number) {
  const start = new Date(timer.started_at).getTime();
  const end =
    timer.status === "paused" && timer.paused_at
      ? new Date(timer.paused_at).getTime()
      : now;
  return Math.max(
    Math.floor((end - start) / 1000) - Number(timer.total_paused_seconds || 0),
    0,
  );
}

function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return [hours, minutes, remaining]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function DashboardPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [invoices, setInvoices] = useState<InvoiceMetricRow[]>([]);
  const [liveTimers, setLiveTimers] = useState<LiveTimer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(Date.now());

  const normalizedRole = String(profile?.role || "")
    .trim()
    .toLowerCase();
  const isAdmin = normalizedRole === "admin";
  const canViewTeam = isAdmin || normalizedRole === "manager";
  const isEmployee = normalizedRole === "employee";

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("role,employee_id")
        .eq("user_id", userData.user.id)
        .single();
      const currentProfile = profileData as Profile | null;
      setProfile(currentProfile);
      const role = String(currentProfile?.role || "")
        .trim()
        .toLowerCase();

      const employeeQuery = supabase.from("employees").select(`
        id,
        name,
        time_entries(hours,entry_date)
      `);
      if (role === "employee" && currentProfile?.employee_id) {
        employeeQuery.eq("id", currentProfile.employee_id);
      }

      let projectQuery = supabase.from("projects").select(`
        id,
        name,
        project_code,
        remaining_hours,
        status,
        project_resources(employee_id)
      `);
      if (role === "employee") {
        projectQuery = projectQuery.eq("status", "active");
      }

      const requests = [employeeQuery, projectQuery] as const;
      const [employeeResult, projectResult] = await Promise.all(requests);
      setEmployees((employeeResult.data || []) as unknown as Employee[]);

      const loadedProjects = (projectResult.data ||
        []) as unknown as (Project & {
        project_resources?: { employee_id: string }[];
      })[];
      setProjects(
        role === "employee" && currentProfile?.employee_id
          ? loadedProjects.filter((project) =>
              project.project_resources?.some(
                (resource) =>
                  resource.employee_id === currentProfile.employee_id,
              ),
            )
          : loadedProjects,
      );

      if (role !== "employee") {
        const [clientResult, timerResult] = await Promise.all([
          supabase.from("clients").select("id,status"),
          supabase
            .from("active_timers")
            .select(
              `
              id,
              employee_id,
              started_at,
              paused_at,
              total_paused_seconds,
              status,
              description,
              employees(name),
              projects(name,project_code,clients(name))
            `,
            )
            .in("status", ["running", "paused"]),
        ]);
        setClients((clientResult.data || []) as Client[]);
        setLiveTimers((timerResult.data || []) as unknown as LiveTimer[]);
      }

      if (role === "admin") {
        const { data: invoiceData } = await supabase
          .from("invoices")
          .select(
            "currency,total_amount,paid_amount,status,issue_date,due_date",
          );
        setInvoices((invoiceData || []) as InvoiceMetricRow[]);
      }
      setLoading(false);
    }

    void loadDashboard();
  }, []);

  useEffect(() => {
    if (!canViewTeam || !liveTimers.some((timer) => timer.status === "running"))
      return;
    const interval = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [canViewTeam, liveTimers]);

  const weeklyHours = (employee: Employee) => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    return (employee.time_entries || [])
      .filter((entry) => new Date(`${entry.entry_date}T00:00:00`) >= weekStart)
      .reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
  };

  const activeClients = clients.filter(
    (client) => client.status === "active",
  ).length;
  const activeProjects = projects.filter(
    (project) => project.status === "active",
  ).length;
  const totalWeeklyHours = employees.reduce(
    (sum, employee) => sum + weeklyHours(employee),
    0,
  );
  const totalCapacity = employees.length * 40;
  const utilization = totalCapacity
    ? Math.round((totalWeeklyHours / totalCapacity) * 100)
    : 0;

  const invoiceYear = new Date().getFullYear();
  const invoiceSummary = useMemo(() => {
    const summaries = new Map<string, CurrencySummary>();
    const today = todayKey();
    let yearCount = 0;
    let overdueCount = 0;

    for (const invoice of invoices) {
      const currency = invoice.currency || "USD";
      const summary = summaries.get(currency) || {
        currency,
        open: 0,
        paid: 0,
        overdue: 0,
      };
      const total = Number(invoice.total_amount || 0);
      const paid = Number(invoice.paid_amount || 0);
      const status = String(invoice.status || "").toLowerCase();
      if (["sent", "overdue"].includes(status)) {
        summary.open += Math.max(total - paid, 0);
      }
      if (status === "paid") summary.paid += paid || total;
      if (["sent", "overdue"].includes(status) && invoice.due_date < today) {
        summary.overdue += Math.max(total - paid, 0);
        overdueCount += 1;
      }
      if (Number(invoice.issue_date?.slice(0, 4)) === invoiceYear)
        yearCount += 1;
      summaries.set(currency, summary);
    }
    return {
      currencies: Array.from(summaries.values()),
      yearCount,
      overdueCount,
    };
  }, [invoiceYear, invoices]);

  const sortedTimers = useMemo(
    () =>
      [...liveTimers].sort((first, second) => {
        if (first.status !== second.status)
          return first.status === "running" ? -1 : 1;
        return workedSeconds(second, tick) - workedSeconds(first, tick);
      }),
    [liveTimers, tick],
  );

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-5 py-7 sm:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="relative min-h-[210px] overflow-hidden rounded-[2rem] bg-[#0F172A] px-8 py-10 text-white shadow-xl shadow-slate-300/50 lg:px-12">
          <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#153E90]/70 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="relative flex h-full flex-col justify-between gap-8 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-200">
                Kairo command center
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight lg:text-5xl">
                Dashboard
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                Delivery, financial health, and live operations in one clear
                view.
              </p>
            </div>
            <div className="w-fit rounded-2xl border border-white/10 bg-white/10 px-5 py-3 backdrop-blur">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200">
                Signed in as
              </p>
              <p className="mt-1 font-bold">{profile?.role || "Loading"}</p>
            </div>
          </div>
        </header>

        <section
          className={`relative z-10 -mt-5 grid gap-4 px-3 sm:px-6 ${isEmployee ? "md:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4"}`}
        >
          {isEmployee ? (
            <>
              <MetricCard
                label="My Projects"
                value={projects.length}
                onClick={() => router.push("/projects")}
              />
              <MetricCard
                label="My Hours This Week"
                value={totalWeeklyHours.toFixed(2)}
                onClick={() => router.push("/timer")}
              />
              <MetricCard
                label="My Weekly Utilization"
                value={`${utilization}%`}
                onClick={() => router.push("/timer")}
              />
            </>
          ) : (
            <>
              <MetricCard
                label="Active Clients"
                value={activeClients}
                onClick={() => router.push("x /clients")}
              />
              <MetricCard
                label="Active Projects"
                value={activeProjects}
                onClick={() => router.push("/projects")}
              />
              <MetricCard
                label="Hours This Week"
                value={totalWeeklyHours.toFixed(2)}
                onClick={() => router.push("/timer")}
              />
              <MetricCard
                label="Team Utilization"
                value={`${utilization}%`}
                onClick={() => router.push("/team")}
              />
            </>
          )}
        </section>

        {isAdmin ? (
          <section className="mt-8">
            <SectionHeading
              eyebrow="Billing intelligence"
              title="Invoice Overview"
              action="View invoices"
              onAction={() => router.push("/invoices")}
            />
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InvoiceCard
                label="Total Open"
                values={invoiceSummary.currencies
                  .filter((row) => row.open > 0)
                  .map((row) => money(row.currency, Math.round(row.open)))}
                note="Sent and overdue invoices"
                tone="blue"
                onClick={() =>
                  router.push("/invoices?tab=all&status=open")
                }
              />
              <InvoiceCard
                label="Total Paid"
                values={invoiceSummary.currencies
                  .filter((row) => row.paid > 0)
                  .map((row) => money(row.currency, Math.round(row.paid)))}
                note="Completed collections"
                tone="green"
                onClick={() =>
                  router.push("/invoices?tab=all&status=paid")
                } 
              />
              <InvoiceCard
                label={`Invoices in ${invoiceYear}`}
                values={[String(invoiceSummary.yearCount)]}
                note="Draft, sent, overdue, and paid"
                tone="navy"
                onClick={() =>
                  router.push(`/invoices?tab=all&year=${invoiceYear}`)
                }
              />
              <InvoiceCard
                label="Overdue"
                values={[String(invoiceSummary.overdueCount)]}
                secondaryValues={invoiceSummary.currencies
                  .filter((row) => row.overdue > 0)
                  .map((row) => money(row.currency, Math.round(row.overdue)))}
                note="Past due today"
                tone="red"
                onClick={() =>
                  router.push("/invoices?tab=all&status=overdue")
                }
              />
            </div>
          </section>
        ) : null}

        {canViewTeam ? (
          <section className="mt-9">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeading
                eyebrow="Real-time delivery"
                title="Live Operations"
              />
              <div className="flex items-center gap-3 text-sm font-bold text-slate-700">
                <span>
                  {sortedTimers.length}{" "}
                  {sortedTimers.length === 1 ? "Timer" : "Timers"}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-emerald-600">
                  ●{" "}
                  {
                    sortedTimers.filter((timer) => timer.status === "running")
                      .length
                  }{" "}
                  Running
                </span>
                <button
                  type="button"
                  onClick={() => router.push("/timer")}
                  className="ml-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-[#153E90] shadow-sm hover:border-blue-200"
                >
                  Open Time
                </button>
              </div>
            </div>
            {sortedTimers.length ? (
              <div className="mt-4 space-y-3">
                {sortedTimers.map((timer) => {
                  const running = timer.status === "running";
                  return (
                    <article
                      key={timer.id}
                      className={`grid gap-4 rounded-2xl border border-slate-200 border-l-4 bg-white p-5 shadow-sm lg:grid-cols-[1.2fr_1fr_1.2fr_1.3fr_160px_100px] lg:items-center ${running ? "border-l-emerald-400" : "border-l-amber-400"}`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${running ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                        >
                          {initials(timer.employees?.name || "")}
                        </span>
                        <div>
                          <p className="font-bold text-slate-950">
                            {timer.employees?.name || "Unknown employee"}
                          </p>
                          <p className="text-xs text-slate-400">Employee</p>
                        </div>
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">
                          {timer.projects?.clients?.name || "—"}
                        </p>
                        <p className="text-xs text-slate-400">Client</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#153E90]">
                          [{timer.projects?.project_code || "—"}]
                        </p>
                        <p className="mt-1 font-bold text-slate-900">
                          {timer.projects?.name || "—"}
                        </p>
                      </div>
                      <p className="line-clamp-2 text-sm text-slate-600">
                        {timer.description || "No description"}
                      </p>
                      <p
                        className={`font-mono text-xl font-bold ${running ? "text-emerald-600" : "text-amber-600"}`}
                      >
                        {duration(workedSeconds(timer, tick))}
                      </p>
                      <span
                        className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${running ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200"}`}
                      >
                        ● {running ? "Running" : "Paused"}
                      </span>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm font-medium text-slate-500">
                No active timers right now.
              </div>
            )}
          </section>
        ) : null}

        {!isEmployee ? (
          <section className="mt-9 grid gap-5 lg:grid-cols-2">
            <HealthCard
              title="Project Wallet Health"
              healthyText="All projects have healthy hours"
              items={projects
                .filter(
                  (project) =>
                    project.remaining_hours <= 10 &&
                    project.status === "active",
                )
                .map((project) => ({
                  id: project.id,
                  title: `[${project.project_code}] ${project.name}`,
                  detail: `${Number(project.remaining_hours).toFixed(2)} hrs remaining`,
                }))}
            />
            <HealthCard
              title="Team Capacity"
              healthyText="Team capacity looks healthy"
              items={employees
                .filter((employee) => weeklyHours(employee) > 40)
                .map((employee) => ({
                  id: employee.id,
                  title: employee.name,
                  detail: `${weeklyHours(employee).toFixed(2)} hrs this week`,
                }))}
            />
          </section>
        ) : null}

        {loading ? (
          <p className="mt-8 text-center text-sm text-slate-400">
            Refreshing your dashboard…
          </p>
        ) : null}
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number | string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-lg shadow-slate-200/50 transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
    >
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-4 text-3xl font-bold tracking-tight text-[#153E90]">
        {value}
      </p>
      <p className="mt-3 text-xs font-semibold text-slate-400 group-hover:text-[#153E90]">
        View details →
      </p>
    </button>
  );
}

function SectionHeading({
  eyebrow,
  title,
  action,
  onAction,
}: {
  eyebrow: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#153E90]">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
          {title}
        </h2>
      </div>
      {action ? (
        <button
          type="button"
          onClick={onAction}
          className="text-sm font-bold text-[#153E90] hover:text-blue-800"
        >
          {action} →
        </button>
      ) : null}
    </div>
  );
}

function InvoiceCard({
  label,
  values,
  secondaryValues = [],
  note,
  tone,
  onClick,
}: {
  label: string;
  values: string[];
  secondaryValues?: string[];
  note: string;
  tone: "blue" | "green" | "navy" | "red";
  onClick: () => void;
}) {
  const valueColor = {
    blue: "text-[#153E90]",
    green: "text-emerald-700",
    navy: "text-slate-950",
    red: "text-red-700",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-48 rounded-3xl border bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${tone === "red" ? "border-red-100 hover:border-red-200" : "border-slate-200 hover:border-blue-200"}`}
    >
      <p
        className={`text-xs font-bold uppercase tracking-[0.16em] ${tone === "red" ? "text-red-400" : "text-slate-400"}`}
      >
        {label}
      </p>
      <div className="mt-5 space-y-1">
        {values.length ? (
          values.map((value) => (
            <p
              key={value}
              className={`text-3xl font-bold tracking-tight ${valueColor}`}
            >
              {value}
            </p>
          ))
        ) : (
          <p className={`text-3xl font-bold ${valueColor}`}>—</p>
        )}
      </div>
      {secondaryValues.length ? (
        <div className="mt-2 space-y-1">
          {secondaryValues.map((value) => (
            <p key={value} className="text-sm font-bold text-red-600">
              {value}
            </p>
          ))}
        </div>
      ) : null}
      <p className="mt-5 text-xs font-semibold text-slate-400">
        {note} · View all →
      </p>
    </button>
  );
}

function HealthCard({
  title,
  healthyText,
  items,
}: {
  title: string;
  healthyText: string;
  items: { id: string; title: string; detail: string }[];
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      <div className="mt-5 space-y-3">
        {items.length ? (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-red-100 bg-red-50/70 p-4"
            >
              <p className="font-bold text-slate-900">{item.title}</p>
              <p className="mt-1 text-sm font-semibold text-red-600">
                {item.detail}
              </p>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm font-semibold text-emerald-700">
            ✓ {healthyText}
          </p>
        )}
      </div>
    </article>
  );
}
