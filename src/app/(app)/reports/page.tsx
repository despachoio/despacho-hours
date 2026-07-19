"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDecimalHours } from "@/lib/format-hours";
import ManagerDashboard, {
  type ManagerMetrics,
} from "@/components/reports/ManagerDashboard";
import ReportFilters from "@/components/reports/ReportFilters";
import PeriodSummaryCards from "@/components/reports/PeriodSummaryCards";
import {
  DailyTrendChart,
  HoursBarChart,
} from "@/components/reports/ReportCharts";
import TopEntitiesList from "@/components/reports/TopEntitiesList";
import DetailedReportTable from "@/components/reports/DetailedReportTable";
import ReportExportButtons from "@/components/reports/ReportExportButtons";
import {
  ReportEmptyState,
  ReportLoadingState,
} from "@/components/reports/ReportStates";
import type {
  FilterOption,
  LiveTimer,
  ReportEntry,
  ReportFiltersValue,
  ReportProfile,
  SummaryMetric,
} from "@/components/reports/types";
import {
  aggregateEntries,
  comparison,
  dailyHours,
  dateKey,
  dateRange,
  groupedHours,
  timerSeconds,
  weekdays,
} from "@/components/reports/utils";

type ActiveProject = {
  id: string;
  name: string;
  project_code: string | null;
  remaining_hours: number;
  client_id: string | null;
  is_billable: boolean;
  clients: { id: string; name: string } | null;
  project_resources: { employee_id: string }[];
};
type ActiveEmployee = { id: string; name: string };

const initialFilters: ReportFiltersValue = {
  employeeId: "",
  clientId: "",
  projectId: "",
  billingType: "all",
  datePreset: "this_month",
  customFrom: "",
  customTo: "",
  status: "all",
  search: "",
};
const entrySelect = `id,employee_id,project_id,entry_date,started_at,stopped_at,hours,description,employees(id,name),projects(id,name,project_code,remaining_hours,is_billable,clients(id,name))`;

export default function ReportsPage() {
  const [profile, setProfile] = useState<ReportProfile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [entries, setEntries] = useState<ReportEntry[]>([]);
  const [operationalEntries, setOperationalEntries] = useState<ReportEntry[]>(
    [],
  );
  const [liveTimers, setLiveTimers] = useState<LiveTimer[]>([]);
  const [employees, setEmployees] = useState<ActiveEmployee[]>([]);
  const [projects, setProjects] = useState<ActiveProject[]>([]);
  const [filters, setFilters] = useState<ReportFiltersValue>(initialFilters);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [baseLoading, setBaseLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);

  const role = String(profile?.role || "")
    .trim()
    .toLowerCase();
  const isEmployee = role === "employee";
  const period = useMemo(
    () => dateRange(filters.datePreset, filters.customFrom, filters.customTo),
    [filters.customFrom, filters.customTo, filters.datePreset],
  );

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(filters.search.trim().toLowerCase()),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [filters.search]);
  useEffect(() => {
    if (!liveTimers.some((timer) => timer.status === "running")) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [liveTimers]);

  useEffect(() => {
    async function loadBase() {
      setBaseLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setProfileLoaded(true);
        setBaseLoading(false);
        return;
      }
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role,employee_id")
        .eq("user_id", userData.user.id)
        .single();
      const currentProfile = profileData as ReportProfile | null;
      setProfile(currentProfile);
      setProfileLoaded(true);
      const currentRole = String(currentProfile?.role || "")
        .trim()
        .toLowerCase();

      let employeeQuery = supabase
        .from("employees")
        .select("id,name")
        .eq("status", "active")
        .order("name");
      if (currentRole === "employee" && currentProfile?.employee_id)
        employeeQuery = employeeQuery.eq("id", currentProfile.employee_id);
      const projectQuery = supabase
        .from("projects")
        .select(
          "id,name,project_code,remaining_hours,client_id,is_billable,clients(id,name),project_resources(employee_id)",
        )
        .eq("status", "active")
        .order("name");
      let operationalQuery = supabase
        .from("time_entries")
        .select(entrySelect)
        .gte("entry_date", operationalStart())
        .lte("entry_date", dateKey(new Date()));
      if (currentRole === "employee" && currentProfile?.employee_id)
        operationalQuery = operationalQuery.eq(
          "employee_id",
          currentProfile.employee_id,
        );

      const [employeeResult, projectResult, operationalResult, timerResult] =
        await Promise.all([
          employeeQuery,
          projectQuery,
          operationalQuery,
          currentRole === "super admin" ||
          currentRole === "admin" ||
          currentRole === "manager"
            ? supabase
                .from("active_timers")
                .select(
                  "id,employee_id,project_id,started_at,paused_at,total_paused_seconds,status,description,employees(id,name),projects(id,name,project_code,is_billable,clients(id,name))",
                )
                .in("status", ["running", "paused"])
            : Promise.resolve({ data: [], error: null }),
        ]);
      const loadError =
        employeeResult.error ||
        projectResult.error ||
        operationalResult.error ||
        timerResult.error;
      if (loadError) setError(loadError.message);
      setEmployees((employeeResult.data || []) as ActiveEmployee[]);
      const loadedProjects = (projectResult.data ||
        []) as unknown as ActiveProject[];
      setProjects(
        currentRole === "employee" && currentProfile?.employee_id
          ? loadedProjects.filter((project) =>
              project.project_resources?.some(
                (resource) =>
                  resource.employee_id === currentProfile.employee_id,
              ),
            )
          : loadedProjects,
      );
      setOperationalEntries(
        (operationalResult.data || []) as unknown as ReportEntry[],
      );
      setLiveTimers((timerResult.data || []) as unknown as LiveTimer[]);
      setNow(Date.now());
      setBaseLoading(false);
    }
    void loadBase();
  }, []);

  useEffect(() => {
    if (!profileLoaded || !profile || !period.from || !period.to) {
      return;
    }
    async function loadPeriod() {
      setReportLoading(true);
      setError("");
      let query = supabase
        .from("time_entries")
        .select(entrySelect)
        .gte("entry_date", period.from)
        .lte("entry_date", period.to)
        .order("entry_date", { ascending: false });
      if (isEmployee && profile?.employee_id)
        query = query.eq("employee_id", profile.employee_id);
      const result = await query;
      if (result.error) {
        setError(result.error.message);
        setEntries([]);
      } else setEntries((result.data || []) as unknown as ReportEntry[]);
      setReportLoading(false);
    }
    void loadPeriod();
  }, [isEmployee, period.from, period.to, profile, profileLoaded]);

  const matchesEntityFilters = useCallback(
    (entry: ReportEntry) => {
      if (
        !isEmployee &&
        filters.employeeId &&
        entry.employee_id !== filters.employeeId
      )
        return false;
      if (filters.clientId && entry.projects?.clients?.id !== filters.clientId)
        return false;
      if (filters.projectId && entry.project_id !== filters.projectId)
        return false;
      if (
        filters.billingType !== "all" &&
        (entry.projects?.is_billable !== false ? "billable" : "non_billable") !==
          filters.billingType
      )
        return false;
      if (debouncedSearch) {
        const haystack =
          `${entry.employees?.name} ${entry.projects?.clients?.name} ${entry.projects?.project_code} ${entry.projects?.name} ${entry.description}`.toLowerCase();
        if (!haystack.includes(debouncedSearch)) return false;
      }
      return true;
    },
    [
      debouncedSearch,
      filters.clientId,
      filters.billingType,
      filters.employeeId,
      filters.projectId,
      isEmployee,
    ],
  );

  const filteredEntries = useMemo(
    () =>
      !period.from || !period.to || filters.status === "running"
        ? []
        : entries.filter(matchesEntityFilters),
    [entries, filters.status, matchesEntityFilters, period.from, period.to],
  );
  const filteredOperational = useMemo(
    () =>
      filters.status === "running"
        ? []
        : operationalEntries.filter(matchesEntityFilters),
    [filters.status, matchesEntityFilters, operationalEntries],
  );
  const filteredTimers = useMemo(
    () =>
      liveTimers
        .filter((timer) => {
          if (filters.status === "completed") return false;
          if (filters.employeeId && timer.employee_id !== filters.employeeId)
            return false;
          if (
            filters.clientId &&
            timer.projects?.clients?.id !== filters.clientId
          )
            return false;
          if (filters.projectId && timer.project_id !== filters.projectId)
            return false;
          if (
            filters.billingType !== "all" &&
            (timer.projects?.is_billable !== false
              ? "billable"
              : "non_billable") !== filters.billingType
          )
            return false;
          if (
            debouncedSearch &&
            !`${timer.employees?.name} ${timer.projects?.clients?.name} ${timer.projects?.project_code} ${timer.projects?.name} ${timer.description}`
              .toLowerCase()
              .includes(debouncedSearch)
          )
            return false;
          return true;
        })
        .sort((a, b) =>
          a.status === b.status
            ? timerSeconds(b, now) - timerSeconds(a, now)
            : a.status === "running"
              ? -1
              : 1,
        ),
    [
      debouncedSearch,
      filters.clientId,
      filters.billingType,
      filters.employeeId,
      filters.projectId,
      filters.status,
      liveTimers,
      now,
    ],
  );

  const operationalRanges = useMemo(
    () => ({
      today: dateRange("today"),
      yesterday: dateRange("yesterday"),
      week: dateRange("this_week"),
      lastWeek: dateRange("last_week"),
      month: dateRange("this_month"),
    }),
    [],
  );
  const hoursIn = useCallback(
    (from: string, to: string) =>
      filteredOperational
        .filter((entry) => entry.entry_date >= from && entry.entry_date <= to)
        .reduce((sum, entry) => sum + Number(entry.hours || 0), 0),
    [filteredOperational],
  );
  const managerMetrics = useMemo<ManagerMetrics>(() => {
    const todayEntries = filteredOperational.filter(
      (entry) => entry.entry_date === operationalRanges.today.from,
    );
    const weekEntries = filteredOperational.filter(
      (entry) =>
        entry.entry_date >= operationalRanges.week.from &&
        entry.entry_date <= operationalRanges.week.to,
    );
    const visibleProjects = projects.filter(
      (project) =>
        (!filters.projectId || project.id === filters.projectId) &&
        (filters.billingType === "all" ||
          (project.is_billable !== false ? "billable" : "non_billable") ===
            filters.billingType) &&
        (!filters.clientId || project.client_id === filters.clientId) &&
        (!filters.employeeId ||
          project.project_resources?.some(
            (resource) => resource.employee_id === filters.employeeId,
          )),
    );
    const visibleEmployees = isEmployee
      ? employees
      : filters.employeeId
        ? employees.filter((employee) => employee.id === filters.employeeId)
        : employees;
    const trackedHours = filteredOperational.reduce(
      (sum, entry) => sum + Number(entry.hours || 0),
      0,
    );
    return {
      today: hoursIn(operationalRanges.today.from, operationalRanges.today.to),
      yesterday: hoursIn(
        operationalRanges.yesterday.from,
        operationalRanges.yesterday.to,
      ),
      week: hoursIn(operationalRanges.week.from, operationalRanges.week.to),
      previousWeek: hoursIn(
        operationalRanges.lastWeek.from,
        operationalRanges.lastWeek.to,
      ),
      month: hoursIn(operationalRanges.month.from, operationalRanges.month.to),
      runningTimers: filteredTimers.filter(
        (timer) => timer.status === "running",
      ).length,
      employeesWorking: new Set([
        ...todayEntries.map((entry) => entry.employee_id),
        ...filteredTimers.map((timer) => timer.employee_id),
      ]).size,
      employeesTotal: visibleEmployees.length,
      employeesOnline: new Set(filteredTimers.map((timer) => timer.employee_id))
        .size,
      activeProjects: visibleProjects.length,
      clientsToday: new Set(
        todayEntries
          .map((entry) => entry.projects?.clients?.id)
          .filter(Boolean),
      ).size,
      trackedHours,
      averageSession: filteredOperational.length
        ? trackedHours / filteredOperational.length
        : 0,
      averageUtilisation: visibleEmployees.length
        ? (weekEntries.reduce(
            (sum, entry) => sum + Number(entry.hours || 0),
            0,
          ) /
            (visibleEmployees.length * 40)) *
          100
        : 0,
      remainingHours: visibleProjects.reduce(
        (sum, project) => sum + Number(project.remaining_hours || 0),
        0,
      ),
    };
  }, [
    employees,
    filteredOperational,
    filteredTimers,
    filters.clientId,
    filters.billingType,
    filters.employeeId,
    filters.projectId,
    hoursIn,
    isEmployee,
    operationalRanges,
    projects,
  ]);

  const totalHours = useMemo(
    () =>
      filteredEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0),
    [filteredEntries],
  );
  const expectedHours = weekdays(period.from, period.to) * 8;
  const aggregateRows = useMemo(
    () =>
      aggregateEntries(filteredEntries, expectedHours).sort(
        (a, b) => b.totalHours - a.totalHours,
      ),
    [expectedHours, filteredEntries],
  );
  const employeeHours = useMemo(
    () => groupedHours(filteredEntries, "employee"),
    [filteredEntries],
  );
  const clientHours = useMemo(
    () => groupedHours(filteredEntries, "client"),
    [filteredEntries],
  );
  const projectHours = useMemo(
    () => groupedHours(filteredEntries, "project"),
    [filteredEntries],
  );
  const trend = useMemo(
    () => dailyHours(filteredEntries, period.from, period.to),
    [filteredEntries, period.from, period.to],
  );
  const summary = useMemo<SummaryMetric[]>(() => {
    const sessions = filteredEntries.length;
    const calendarDays =
      period.from && period.to
        ? Math.max(
            1,
            Math.round(
              (new Date(`${period.to}T00:00:00Z`).getTime() -
                new Date(`${period.from}T00:00:00Z`).getTime()) /
                86_400_000,
            ) + 1,
          )
        : 0;
    return [
      { label: "Hours", value: `${formatDecimalHours(totalHours)} hrs` },
      { label: "Entries", value: String(sessions) },
      {
        label: "Employees",
        value: String(
          new Set(filteredEntries.map((entry) => entry.employee_id)).size,
        ),
      },
      {
        label: "Projects",
        value: String(
          new Set(filteredEntries.map((entry) => entry.project_id)).size,
        ),
      },
      {
        label: "Clients",
        value: String(
          new Set(
            filteredEntries
              .map((entry) => entry.projects?.clients?.id)
              .filter(Boolean),
          ).size,
        ),
      },
      {
        label: "Avg Daily Hours",
        value: `${formatDecimalHours(calendarDays ? totalHours / calendarDays : 0)} hrs`,
      },
      {
        label: "Avg Session",
        value: `${formatDecimalHours(sessions ? totalHours / sessions : 0)} hrs`,
      },
      {
        label: "Longest Session",
        value: `${formatDecimalHours(Math.max(0, ...filteredEntries.map((entry) => Number(entry.hours || 0))))} hrs`,
      },
    ];
  }, [filteredEntries, period.from, period.to, totalHours]);

  const employeeOptions = useMemo<FilterOption[]>(
    () =>
      employees.map((employee) => ({ id: employee.id, name: employee.name })),
    [employees],
  );
  const clientOptions = useMemo<FilterOption[]>(
    () =>
      Array.from(
        new Map(
          projects
            .filter(
              (project) =>
                project.clients &&
                (!filters.employeeId ||
                  project.project_resources?.some(
                    (resource) => resource.employee_id === filters.employeeId,
                  )),
            )
            .map((project) => [
              project.clients!.id,
              { id: project.clients!.id, name: project.clients!.name },
            ]),
        ).values(),
      ),
    [filters.employeeId, projects],
  );
  const projectOptions = useMemo<FilterOption[]>(
    () =>
      projects
        .filter(
          (project) =>
            (!filters.clientId || project.client_id === filters.clientId) &&
            (filters.billingType === "all" ||
              (project.is_billable !== false ? "billable" : "non_billable") ===
                filters.billingType) &&
            (!filters.employeeId ||
              project.project_resources?.some(
                (resource) => resource.employee_id === filters.employeeId,
              )),
        )
        .map((project) => ({
          id: project.id,
          name: project.name,
          code: project.project_code,
        })),
    [filters.billingType, filters.clientId, filters.employeeId, projects],
  );
  const clearFilters = useCallback(() => setFilters(initialFilters), []);
  const updateFilters = useCallback((next: ReportFiltersValue) => {
    setFilters((current) => ({
      ...next,
      projectId:
        next.clientId !== current.clientId ||
        next.employeeId !== current.employeeId
          ? ""
          : next.projectId,
    }));
  }, []);

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-5 py-7 sm:px-8">
      <div className="mx-auto max-w-[1550px]">
        <header className="relative overflow-hidden rounded-[2rem] bg-[#0F172A] px-8 py-10 text-white shadow-xl shadow-slate-300/50 lg:px-11">
          <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#153E90]/70 blur-3xl" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">
                Operational intelligence
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight lg:text-5xl">
                Reports
              </h1>
              <p className="mt-3 text-sm text-slate-300">
                Monitor live operations, employee productivity, client effort
                and project utilisation.
              </p>
            </div>
            <ReportExportButtons
              rows={aggregateRows}
              filters={filters}
              summary={summary}
              period={period}
              employeeColumn={!isEmployee}
            />
          </div>
        </header>
        {error ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          >
            {error}
          </div>
        ) : null}
        <div className="mt-8 space-y-8">
          {baseLoading ? (
            <ReportLoadingState />
          ) : (
            <>
              <ManagerDashboard
                metrics={managerMetrics}
                personal={isEmployee}
                todayComparison={comparison(
                  managerMetrics.today,
                  managerMetrics.yesterday,
                  "vs yesterday",
                )}
                weekComparison={comparison(
                  managerMetrics.week,
                  managerMetrics.previousWeek,
                  "vs last week",
                )}
              />

              <ReportFilters
                value={filters}
                onChange={updateFilters}
                employees={employeeOptions}
                clients={clientOptions}
                projects={projectOptions}
                showEmployee={!isEmployee}
                onClear={clearFilters}
              />
              {reportLoading ? (
                <ReportLoadingState />
              ) : filteredEntries.length ? (
                <>
                  <PeriodSummaryCards metrics={summary} />
                  <section className="grid gap-5 xl:grid-cols-2">
                    {!isEmployee ? (
                      <HoursBarChart
                        title="Hours by Employee"
                        data={employeeHours}
                      />
                    ) : null}
                    <HoursBarChart title="Hours by Client" data={clientHours} />
                    <HoursBarChart
                      title="Hours by Project"
                      data={projectHours}
                    />
                    <DailyTrendChart data={trend} />
                  </section>
                  <section
                    className={`grid gap-5 ${isEmployee ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}
                  >
                    {!isEmployee ? (
                      <TopEntitiesList
                        title="Top Employees"
                        data={employeeHours}
                        total={totalHours}
                      />
                    ) : null}
                    <TopEntitiesList
                      title="Top Clients"
                      data={clientHours}
                      total={totalHours}
                    />
                    <TopEntitiesList
                      title="Top Projects"
                      data={projectHours}
                      total={totalHours}
                    />
                  </section>
                  <DetailedReportTable
                    key={`${filters.employeeId}:${filters.clientId}:${filters.projectId}:${filters.billingType}:${filters.datePreset}:${filters.customFrom}:${filters.customTo}:${filters.status}:${debouncedSearch}`}
                    rows={aggregateRows}
                    employeeColumn={!isEmployee}
                  />
                </>
              ) : (
                <ReportEmptyState onClear={clearFilters} />
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function operationalStart() {
  const starts = [
    dateRange("last_week").from,
    dateRange("this_month").from,
    dateRange("yesterday").from,
  ];
  return starts.sort()[0];
}
