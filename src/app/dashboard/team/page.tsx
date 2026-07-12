"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import TeamFilters from "@/components/team/TeamFilters";
import TeamSummaryCards from "@/components/team/TeamSummaryCards";
import EmployeeCard from "@/components/team/EmployeeCard";
import type {
  TeamEmployee,
  TeamEntry,
  TeamFilterValue,
  TeamProfile,
  TeamTimer,
} from "@/components/team/types";
import { dateRange, employeeAnalytics } from "@/components/team/utils";

const initialFilters: TeamFilterValue = {
  employeeId: "",
  status: "",
  department: "",
  period: "this_week",
  customFrom: "",
  customTo: "",
  search: "",
};
const EMPTY_ENTRIES: TeamEntry[] = [];

export default function TeamPage() {
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [employees, setEmployees] = useState<TeamEmployee[]>([]);
  const [entries, setEntries] = useState<TeamEntry[]>([]);
  const [timers, setTimers] = useState<TeamTimer[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [loadedRange, setLoadedRange] = useState("");
  const [error, setError] = useState("");
  const [employmentView, setEmploymentView] = useState<
    "active" | "inactive" | "all"
  >("active");
  const [now, setNow] = useState(0);
  const [showNewMember, setShowNewMember] = useState(false);
  const [employeeCode, setEmployeeCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [department, setDepartment] = useState("");
  const [hourlyCost, setHourlyCost] = useState("");
  const [accessRole, setAccessRole] = useState("Employee");
  const role = String(profile?.role || "")
    .trim()
    .toLowerCase();
  const isEmployee = role === "employee";
  const isAdmin = role === "admin";
  const range = useMemo(
    () => dateRange(filters.period, filters.customFrom, filters.customTo),
    [filters.customFrom, filters.customTo, filters.period],
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
        setError("Your team profile is not configured correctly.");
        setLoading(false);
        return;
      }
      let employeeQuery = supabase
        .from("employees")
        .select(
          "id,employee_code,name,email,role,department,status,hourly_cost",
        )
        .order("created_at", { ascending: true });
      let timerQuery = supabase
        .from("active_timers")
        .select(
          "id,employee_id,project_id,started_at,paused_at,total_paused_seconds,status,description,projects(id,name,project_code,clients(id,name))",
        )
        .in("status", ["running", "paused"]);
      if (currentRole === "employee" && current.employee_id) {
        employeeQuery = employeeQuery
          .eq("id", current.employee_id)
          .eq("status", "active");
        timerQuery = timerQuery.eq("employee_id", current.employee_id);
      } else if (currentRole === "manager") {
        employeeQuery = employeeQuery.eq("status", "active");
      }
      const [employeeResult, timerResult] = await Promise.all([
        employeeQuery,
        timerQuery,
      ]);
      const loadError = employeeResult.error || timerResult.error;
      if (loadError) setError(loadError.message);
      setEmployees((employeeResult.data || []) as TeamEmployee[]);
      setTimers((timerResult.data || []) as unknown as TeamTimer[]);
      setNow(Date.now());
      setLoading(false);
    }
    void loadBase();
  }, []);

  useEffect(() => {
    if (!profile || !range.from || !range.to) {
      return;
    }
    async function loadEntries() {
      setEntriesLoading(true);
      let query = supabase
        .from("time_entries")
        .select(
          "id,employee_id,project_id,entry_date,started_at,stopped_at,hours,description,projects(id,name,project_code,clients(id,name))",
        )
        .gte("entry_date", range.from)
        .lte("entry_date", range.to)
        .order("entry_date", { ascending: false });
      if (isEmployee && profile?.employee_id)
        query = query.eq("employee_id", profile.employee_id);
      const result = await query;
      if (result.error) setError(result.error.message);
      setEntries((result.data || []) as unknown as TeamEntry[]);
      setLoadedRange(`${range.from}:${range.to}`);
      setEntriesLoading(false);
    }
    void loadEntries();
  }, [isEmployee, profile, range.from, range.to]);

  const effectiveEntries =
    range.from && range.to && loadedRange === `${range.from}:${range.to}`
      ? entries
      : EMPTY_ENTRIES;
  const analytics = useMemo(
    () =>
      employees.map((employee) =>
        employeeAnalytics(
          employee,
          effectiveEntries.filter((entry) => entry.employee_id === employee.id),
          timers.find((timer) => timer.employee_id === employee.id) || null,
          range.from,
          range.to,
        ),
      ),
    [effectiveEntries, employees, range.from, range.to, timers],
  );
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
          !`${item.employee.name} ${item.employee.email} ${item.employee.employee_code} ${item.employee.role} ${item.employee.department}`
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

  async function addTeamMember() {
    if (!isAdmin || !name.trim() || !email.trim()) return;
    const { error: inviteError } = await supabase.functions.invoke(
      "invite-team-member",
      {
        body: {
          email: email.trim(),
          full_name: name.trim(),
          employee_code: employeeCode.trim() || null,
          designation: memberRole.trim() || null,
          department: department.trim() || null,
          hourly_cost: hourlyCost || 0,
          access_role: accessRole,
        },
      },
    );
    if (inviteError) {
      setError(inviteError.message);
      return;
    }
    setEmployeeCode("");
    setName("");
    setEmail("");
    setMemberRole("");
    setDepartment("");
    setHourlyCost("");
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
                Team
              </h1>
              <p className="mt-3 text-sm text-slate-300">
                Monitor employee utilisation and productivity.
              </p>
            </div>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setShowNewMember((value) => !value)}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-[#0F172A] shadow-lg"
              >
                {showNewMember ? "Close" : "+ New Team Member"}
              </button>
            ) : null}
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
        {showNewMember && isAdmin ? (
          <section className="relative z-10 -mt-4 rounded-3xl border border-blue-100 bg-white p-6 shadow-xl sm:mx-5">
            <h2 className="text-xl font-bold">Add team member</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Input
                value={employeeCode}
                onChange={setEmployeeCode}
                placeholder="Employee code"
              />
              <Input value={name} onChange={setName} placeholder="Full name" />
              <Input value={email} onChange={setEmail} placeholder="Email" />
              <Input
                value={memberRole}
                onChange={setMemberRole}
                placeholder="Role"
              />
              <Input
                value={department}
                onChange={setDepartment}
                placeholder="Department"
              />
              <Input
                value={hourlyCost}
                onChange={setHourlyCost}
                placeholder="Hourly cost"
                type="number"
              />
              <select
                value={accessRole}
                onChange={(event) => setAccessRole(event.target.value)}
                className="rounded-2xl border border-slate-200 px-4 py-3"
              >
                <option>Employee</option>
                <option>Manager</option>
                <option>Admin</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => void addTeamMember()}
              className="mt-5 rounded-2xl bg-[#153E90] px-6 py-3 font-bold text-white"
            >
              Send Invitation
            </button>
          </section>
        ) : null}
        <div className="mt-8 space-y-7">
          <TeamFilters
            value={filters}
            onChange={setFilters}
            employees={employees}
            departments={departments}
            showEmployee={!isEmployee}
          />
          {loading || entriesLoading ? (
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
                analytics={visibleAnalytics}
                personal={isEmployee}
              />
              {isAdmin ? (
                <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-bold text-slate-950">Employees</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Manage active and inactive team accounts.
                    </p>
                  </div>
                  <div className="inline-flex w-fit rounded-xl bg-slate-100 p-1">
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
                  </div>
                </section>
              ) : null}
              {visibleAnalytics.length ? (
                <section className="space-y-3">
                  {visibleAnalytics.map((item) => (
                    <EmployeeCard
                      key={item.employee.id}
                      analytics={item}
                      now={now}
                    />
                  ))}
                </section>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-500">
                  No employees match these filters.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400"
    />
  );
}
