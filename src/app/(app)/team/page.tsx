"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import TeamFilters from "@/components/team/TeamFilters";
import TeamSummaryCards from "@/components/team/TeamSummaryCards";
import EmployeeCard from "@/components/team/EmployeeCard";
import type {
  EmployeeAnalytics,
  ReportingManagerOption,
  TeamEmployee,
  TeamFilterValue,
  TeamProfile,
  TeamTimer,
} from "@/components/team/types";
import { dateRange } from "@/lib/metrics/date-ranges";
import {
  calculateTeamMetrics,
  getTeamMetrics,
} from "@/lib/metrics/team-metrics";
import type { TeamMetrics } from "@/lib/metrics/types";
import {
  emptyEmployeeProfileChanges,
  validateEmployeeProfileChanges,
  type EmployeeProfileChanges,
} from "@/lib/employee-profile";
import { EmployeeProfileFormSections } from "@/components/team/EmployeeProfileSections";
import ProfileApprovals from "@/components/team/ProfileApprovals";
import OrganizationChart from "@/components/team/OrganizationChart";
import TeamPolicies from "@/components/team/TeamPolicies";

type TeamTab = "overview" | "approvals" | "organization" | "policies";

const initialFilters: TeamFilterValue = {
  employeeId: "",
  status: "",
  department: "",
  period: "this_week",
  customFrom: "",
  customTo: "",
  search: "",
};
const EMPTY_ANALYTICS: EmployeeAnalytics[] = [];

function teamDataErrorMessage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : String(
          (error as { message?: string } | null | undefined)?.message || "",
        );
  const normalized = message.toLowerCase();
  if (
    normalized.includes("reporting_manager") ||
    normalized.includes("date_of_joining") ||
    normalized.includes("get_reporting_manager_options") ||
    normalized.includes("employees_reporting_manager_id_fkey")
  ) {
    return "The employee profile database update is pending. Apply migration 202607210001 before deploying this version.";
  }
  return "Unable to load workforce metrics right now.";
}

export default function WorkforcePage() {
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [teamMetrics, setTeamMetrics] = useState<TeamMetrics | null>(null);
  const [filters, setFilters] = useState(initialFilters);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [error, setError] = useState("");
  const [employmentView, setEmploymentView] = useState<
    "active" | "inactive" | "all"
  >("active");
  const [now, setNow] = useState(0);
  const [showNewMember, setShowNewMember] = useState(false);
  const [memberDraft, setMemberDraft] = useState<EmployeeProfileChanges>(
    emptyEmployeeProfileChanges,
  );
  const [reportingManagerId, setReportingManagerId] = useState("");
  const [reportingManagers, setReportingManagers] = useState<
    ReportingManagerOption[]
  >([]);
  const [accessRole, setAccessRole] = useState("Employee");
  const role = String(profile?.role || "")
    .trim()
    .toLowerCase();
  const isEmployee = role === "employee";
  const isFinanceAdmin = role === "finance admin";
  const isSuperAdmin = isFinanceAdmin || role === "super admin";
  const isAdmin = isSuperAdmin || role === "admin";
  const [tab, setTab] = useState<TeamTab>("overview");
  const range = useMemo(
    () => dateRange(filters.period, filters.customFrom, filters.customTo),
    [filters.customFrom, filters.customTo, filters.period],
  );
  const analytics = teamMetrics?.employees || EMPTY_ANALYTICS;
  const employees = useMemo<TeamEmployee[]>(
    () => analytics.map((item) => item.employee),
    [analytics],
  );
  const timers = useMemo<TeamTimer[]>(
    () =>
      analytics
        .map((item) => item.timer)
        .filter((timer): timer is TeamTimer => Boolean(timer)),
    [analytics],
  );

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(filters.search.trim().toLowerCase()),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    if (!timers.some((timer) => timer.status === "running")) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [timers]);

  useEffect(() => {
    async function loadBase() {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setError("Your session has expired.");
        setLoading(false);
        return;
      }
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role,employee_id")
        .eq("user_id", userData.user.id)
        .single();
      const current = profileData as TeamProfile | null;
      setProfile(current);
      const currentRole = String(current?.role || "")
        .trim()
        .toLowerCase();
      if (!current || (currentRole === "employee" && !current.employee_id)) {
        setError("Your workforce profile is not configured correctly.");
        setLoading(false);
        return;
      }
      if (["admin", "super admin", "finance admin"].includes(currentRole)) {
        const { data: managerData, error: managerError } = await supabase.rpc(
          "get_reporting_manager_options",
        );
        if (managerError) setError(teamDataErrorMessage(managerError));
        else
          setReportingManagers(
            (managerData || []) as ReportingManagerOption[],
          );
      }
      setNow(Date.now());
      setLoading(false);
    }
    void loadBase();
  }, []);

  useEffect(() => {
    if (!profile || !range.from || !range.to) return;
    let cancelled = false;
    async function loadMetrics() {
      setMetricsLoading(true);
      try {
        const currentRole = String(profile?.role || "").trim().toLowerCase();
        const metrics = await getTeamMetrics({
          startDate: range.from,
          endDate: range.to,
          employeeId:
            currentRole === "employee" ? profile?.employee_id || undefined : undefined,
          reportingManagerId:
            currentRole === "manager"
              ? profile?.employee_id || undefined
              : undefined,
          employeeStatus:
            currentRole === "employee" || currentRole === "manager"
              ? "active"
              : undefined,
        });
        if (!cancelled) setTeamMetrics(metrics);
      } catch (metricError) {
        console.error("Unable to load team metrics", metricError);
        if (!cancelled) setError(teamDataErrorMessage(metricError));
      } finally {
        if (!cancelled) setMetricsLoading(false);
      }
    }
    void loadMetrics();
    return () => {
      cancelled = true;
    };
  }, [profile, range.from, range.to]);
  const visibleAnalytics = useMemo(
    () =>
      analytics.filter((item) => {
        const employmentStatus = String(item.employee.status || "")
          .trim()
          .toLowerCase();
        if (
          isAdmin &&
          employmentView !== "all" &&
          employmentStatus !== employmentView
        )
          return false;
        if (
          !isEmployee &&
          filters.employeeId &&
          item.employee.id !== filters.employeeId
        )
          return false;
        if (
          filters.status === "active" ||
          filters.status === "inactive"
        ) {
          if (employmentStatus !== filters.status) return false;
        } else if (filters.status && item.status !== filters.status) {
          return false;
        }
        if (
          filters.department &&
          item.employee.department !== filters.department
        )
          return false;
        if (
          debouncedSearch &&
          !`${item.employee.title} ${item.employee.name} ${item.employee.email} ${item.employee.employee_code} ${item.employee.role} ${item.employee.department} ${item.employee.epf_number} ${item.employee.uan_number} ${item.employee.reporting_manager?.name}`
            .toLowerCase()
            .includes(debouncedSearch)
        )
          return false;
        return true;
      }).sort((a, b) =>
        a.employee.name.localeCompare(b.employee.name, undefined, {
          sensitivity: "base",
        }),
      ),
    [
      analytics,
      debouncedSearch,
      filters.department,
      filters.employeeId,
      filters.status,
      employmentView,
      isAdmin,
      isEmployee,
    ],
  );
  const departments = useMemo(
    () =>
      Array.from(
        new Set(
          employees
            .map((employee) => employee.department)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [employees],
  );
  const visibleMetrics = useMemo(
    () => calculateTeamMetrics(visibleAnalytics),
    [visibleAnalytics],
  );

  async function addTeamMember() {
    if (!isAdmin) return;
    const validation = validateEmployeeProfileChanges(memberDraft);
    if ("error" in validation) {
      setError(validation.error || "Enter valid employee details.");
      return;
    }
    setError("");
    const { error: inviteError } = await supabase.functions.invoke(
      "invite-team-member",
      {
        body: {
          ...validation.value,
          full_name: validation.value.name,
          designation: validation.value.role,
          reporting_manager_id: reportingManagerId || null,
          access_role: accessRole,
        },
      },
    );
    if (inviteError) {
      setError(inviteError.message);
      return;
    }
    setMemberDraft(emptyEmployeeProfileChanges());
    setReportingManagerId("");
    setAccessRole("Employee");
    setShowNewMember(false);
    window.location.reload();
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-5 py-7 sm:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="relative overflow-hidden rounded-[2rem] bg-[#0F172A] px-8 py-10 text-white shadow-xl shadow-slate-300/50 lg:px-11">
          <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#153E90]/70 blur-3xl" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">
                People and capacity
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight lg:text-5xl">
                Workforce
              </h1>
              <p className="mt-3 text-sm text-slate-300">
                Manage your organization&apos;s workforce, reporting structure,
                approvals and company policies.
              </p>
            </div>
          </div>
        </header>
        <nav aria-label="Workforce sections" className="relative z-20 -mt-4 mx-4 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
          {([...[{ value: "overview", label: "Overview" }], ...(isAdmin ? [{ value: "approvals", label: "Profile Approvals" }] : []), { value: "organization", label: "Organization Chart" }, { value: "policies", label: "Policies" }] as Array<{ value: TeamTab; label: string }>).map((item) => <button key={item.value} type="button" onClick={() => setTab(item.value)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${tab === item.value ? "bg-[#153E90] text-white shadow" : "text-slate-500 hover:bg-slate-100"}`}>{item.label}</button>)}
        </nav>
        {error ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          >
            {error}
          </div>
        ) : null}
        {tab === "overview" && showNewMember && isAdmin ? (
          <section className="relative z-10 -mt-4 rounded-3xl border border-blue-100 bg-white p-6 shadow-xl sm:mx-5">
            <h2 className="text-xl font-bold">Add workforce member</h2>
            <p className="mt-1 text-sm text-slate-500">
              Add employment details now so the profile is ready for future
              time-off and payroll workflows.
            </p>
            <div className="mt-6">
              <EmployeeProfileFormSections
                value={memberDraft}
                showFinanceDetails={isFinanceAdmin}
                benefitsReadOnly={!isFinanceAdmin}
                onChange={(key, value) =>
                  setMemberDraft((current) => ({
                    ...current,
                    [key]: value,
                  }))
                }
                joiningExtras={
                  <>
                    <FormSelect
                      label="Reporting Manager"
                      value={reportingManagerId}
                      onChange={setReportingManagerId}
                    >
                      <option value="">No reporting manager</option>
                      {reportingManagers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name} · {manager.access_role}
                        </option>
                      ))}
                    </FormSelect>
                    <FormSelect
                      label="Access Type"
                      value={accessRole}
                      onChange={setAccessRole}
                    >
                      <option value="Employee">Employee</option>
                      <option value="Manager">Manager</option>
                      <option value="Admin">Admin</option>
                      {isSuperAdmin ? (
                        <option value="Super Admin">Super Admin</option>
                      ) : null}
                      {isFinanceAdmin ? (
                        <option value="Finance Admin">Finance Admin</option>
                      ) : null}
                    </FormSelect>
                  </>
                }
              />
            </div>
            <button
              type="button"
              data-shortcut-primary
              aria-keyshortcuts="Control+Enter Meta+Enter"
              onClick={() => void addTeamMember()}
              className="mt-5 rounded-2xl bg-[#153E90] px-6 py-3 font-bold text-white"
            >
              Send Invitation
            </button>
          </section>
        ) : null}
        {tab === "overview" ? <div className="mt-8 space-y-7">
          <TeamFilters
            value={filters}
            onChange={setFilters}
            employees={employees}
            departments={departments}
            showEmployee={!isEmployee}
          />
          {loading || metricsLoading ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[450px] animate-pulse rounded-3xl bg-white"
                />
              ))}
            </div>
          ) : (
            <>
              <TeamSummaryCards
                metrics={visibleMetrics}
                personal={isEmployee}
              />
              {isAdmin ? (
                <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-bold text-slate-950">Employees</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Manage active and inactive workforce accounts.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setShowNewMember((value) => !value)} className="rounded-xl bg-[#153E90] px-4 py-2.5 text-xs font-bold text-white shadow-sm">{showNewMember ? "Close" : "+ New Workforce Member"}</button><div className="inline-flex w-fit rounded-xl bg-slate-100 p-1">
                    {(["active", "inactive", "all"] as const).map((view) => (
                      <button
                        key={view}
                        type="button"
                        onClick={() => setEmploymentView(view)}
                        className={`rounded-lg px-4 py-2 text-xs font-bold capitalize transition ${employmentView === view ? "bg-white text-[#153E90] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                      >
                        {view}
                      </button>
                    ))}
                  </div></div>
                </section>
              ) : null}
              {visibleAnalytics.length ? (
                <section className="space-y-3">
                  {visibleAnalytics.map((item) => (
                    <EmployeeCard
                      key={item.employee.id}
                      analytics={item}
                      now={now}
                      canEdit={isAdmin}
                      canViewDetails
                    />
                  ))}
                </section>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">
                  No workforce members match these filters.
                </div>
              )}
            </>
          )}
        </div> : null}
        {tab === "approvals" && isAdmin ? <div className="mt-8"><ProfileApprovals/></div> : null}
        {tab === "organization" ? <div className="mt-8"><OrganizationChart employees={employees}/></div> : null}
        {tab === "policies" ? <div className="mt-8"><TeamPolicies/></div> : null}
      </div>
    </main>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 font-normal outline-none focus:border-blue-400"
      >
        {children}
      </select>
    </label>
  );
}
