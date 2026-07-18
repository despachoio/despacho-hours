import { supabase } from "@/lib/supabase";
import type {
  EmployeeAnalytics,
  TeamEmployee,
  TeamEntry,
  TeamTimer,
} from "@/components/team/types";
import { weekdays } from "./date-ranges";
import type { TeamMetricFilters, TeamMetrics } from "./types";

const PAGE_SIZE = 1000;

export function employeeStatus(
  employee: TeamEmployee,
  timer: TeamTimer | null,
): EmployeeAnalytics["status"] {
  if (
    ["on_leave", "leave"].includes(String(employee.status || "").toLowerCase())
  )
    return "on_leave";
  if (timer?.status === "running") return "working";
  if (timer?.status === "paused") return "paused";
  return "offline";
}

export function employeeAnalytics(
  employee: TeamEmployee,
  entries: TeamEntry[],
  timer: TeamTimer | null,
  from: string,
  to: string,
): EmployeeAnalytics {
  const hours = entries.reduce(
    (sum, entry) => sum + Number(entry.hours || 0),
    0,
  );
  const workdays = weekdays(from, to);
  const expectedHours = workdays * 8;
  return {
    employee,
    entries,
    timer,
    hours,
    expectedHours,
    utilisation: expectedHours ? (hours / expectedHours) * 100 : 0,
    projects: new Set(entries.map((entry) => entry.project_id)).size,
    clients: new Set(
      entries.map((entry) => entry.projects?.clients?.id).filter(Boolean),
    ).size,
    averageDailyHours: workdays ? hours / workdays : 0,
    averageSession: entries.length ? hours / entries.length : 0,
    longestSession: Math.max(
      0,
      ...entries.map((entry) => Number(entry.hours || 0)),
    ),
    status: employeeStatus(employee, timer),
  };
}

async function fetchTimeEntries(filters: TeamMetricFilters) {
  const entries: TeamEntry[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from("time_entries")
      .select(
        "id,employee_id,project_id,entry_date,started_at,stopped_at,hours,description,projects(id,name,project_code,clients(id,name))",
      )
      .gte("entry_date", filters.startDate)
      .lte("entry_date", filters.endDate)
      .order("entry_date", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (filters.employeeId) query = query.eq("employee_id", filters.employeeId);
    const result = await query;
    if (result.error) throw result.error;
    const page = (result.data || []) as unknown as TeamEntry[];
    entries.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return entries;
}

export function calculateTeamMetrics(
  employees: EmployeeAnalytics[],
): TeamMetrics {
  const totalHoursLogged = employees.reduce((sum, item) => sum + item.hours, 0);
  const totalExpectedHours = employees.reduce(
    (sum, item) => sum + item.expectedHours,
    0,
  );
  const entries = employees.flatMap((item) => item.entries);
  const aggregateUtilization = totalExpectedHours
    ? (totalHoursLogged / totalExpectedHours) * 100
    : 0;
  return {
    employeeCount: employees.length,
    currentlyWorkingCount: employees.filter(
      (item) => item.status === "working" || item.status === "paused",
    ).length,
    totalHoursLogged,
    totalExpectedHours,
    aggregateUtilization,
    averageEmployeeUtilization: employees.length
      ? employees.reduce((sum, item) => sum + item.utilisation, 0) /
        employees.length
      : 0,
    projectsWorked: new Set(entries.map((entry) => entry.project_id)).size,
    clientsServed: new Set(
      entries.map((entry) => entry.projects?.clients?.id).filter(Boolean),
    ).size,
    averageDailyHours: employees.length
      ? employees.reduce((sum, item) => sum + item.averageDailyHours, 0) /
        employees.length
      : 0,
    averageSessionHours: entries.length ? totalHoursLogged / entries.length : 0,
    employees,
  };
}

export async function getTeamMetrics(
  filters: TeamMetricFilters,
): Promise<TeamMetrics> {
  let employeeQuery = supabase
    .from("employees")
    .select("id,employee_code,name,email,role,department,status,hourly_cost")
    .order("created_at", { ascending: true });
  let timerQuery = supabase
    .from("active_timers")
    .select(
      "id,employee_id,project_id,started_at,paused_at,total_paused_seconds,status,description,projects(id,name,project_code,clients(id,name))",
    )
    .in("status", ["running", "paused"]);

  if (filters.employeeId) {
    employeeQuery = employeeQuery.eq("id", filters.employeeId);
    timerQuery = timerQuery.eq("employee_id", filters.employeeId);
  }
  if (filters.employeeStatus) {
    employeeQuery = employeeQuery.eq("status", filters.employeeStatus);
  }

  const [employeeResult, timerResult, entries] = await Promise.all([
    employeeQuery,
    timerQuery,
    fetchTimeEntries(filters),
  ]);
  const queryError = employeeResult.error || timerResult.error;
  if (queryError) throw queryError;

  const teamEmployees = (employeeResult.data || []) as TeamEmployee[];
  const timers = (timerResult.data || []) as unknown as TeamTimer[];
  const analytics = teamEmployees.map((employee) =>
    employeeAnalytics(
      employee,
      entries.filter((entry) => entry.employee_id === employee.id),
      timers.find((timer) => timer.employee_id === employee.id) || null,
      filters.startDate,
      filters.endDate,
    ),
  );
  return calculateTeamMetrics(analytics);
}
