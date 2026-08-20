import { supabase } from "@/lib/supabase";
import type {
  EmployeeAnalytics,
  TeamEmployee,
  TeamEntry,
  TeamTimer,
} from "@/components/team/types";
import { weekdays } from "./date-ranges";
import { expectedCapacityHours } from "@/lib/time-off/policy";
import type { TeamMetricFilters, TeamMetrics } from "./types";

type WorkforceEmployeeRow = {
  id: string;
  employee_code: string | null;
  title: string | null;
  name: string;
  email: string;
  role: string | null;
  department: string | null;
  reporting_manager_id: string | null;
  reporting_manager_name: string | null;
  reporting_manager_title: string | null;
  status: string | null;
};

type WorkforceTimeSummary = {
  employee_id: string;
  total_hours: number | string | null;
  billable_hours: number | string | null;
  entry_count: number | string | null;
  longest_session: number | string | null;
  project_ids: string[] | null;
  client_ids: string[] | null;
};

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
  expectedHoursOverride?: number,
): EmployeeAnalytics {
  const hours = entries.reduce(
    (sum, entry) => sum + Number(entry.hours || 0),
    0,
  );
  const workdays = weekdays(from, to);
  const expectedHours = expectedHoursOverride ?? workdays * 8;
  const isOperationsEmployee =
    String(employee.department || "").trim().toLowerCase() === "operations";
  const billableHours = entries.reduce(
    (sum, entry) =>
      sum + (entry.projects?.is_billable !== false ? Number(entry.hours || 0) : 0),
    0,
  );
  const nonBillableHours = Math.max(0, hours - billableHours);
  const utilisation =
    isOperationsEmployee && expectedHours
      ? (billableHours / expectedHours) * 100
      : 0;
  return {
    employee,
    entries,
    timer,
    hours,
    expectedHours,
    utilisation,
    billableHours,
    nonBillableHours,
    billableUtilisation: utilisation,
    nonBillableUtilisation: 0,
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
    entryCount: entries.length,
    projectIds: Array.from(new Set(entries.map((entry) => entry.project_id))),
    clientIds: Array.from(
      new Set(
        entries
          .map((entry) => entry.projects?.clients?.id)
          .filter((value): value is string => Boolean(value)),
      ),
    ),
    status: employeeStatus(employee, timer),
  };
}

export function calculateTeamMetrics(
  employees: EmployeeAnalytics[],
): TeamMetrics {
  const totalHoursLogged = employees.reduce((sum, item) => sum + item.hours, 0);
  const totalBillableHours = employees.reduce(
    (sum, item) => sum + item.billableHours,
    0,
  );
  const operationsEmployees = employees.filter(
    (item) =>
      String(item.employee.department || "").trim().toLowerCase() ===
      "operations",
  );
  const totalExpectedHours = operationsEmployees.reduce(
    (sum, item) => sum + item.expectedHours,
    0,
  );
  const operationsBillableHours = operationsEmployees.reduce(
    (sum, item) => sum + item.billableHours,
    0,
  );
  const entryCount = employees.reduce(
    (sum, item) => sum + (item.entryCount ?? item.entries.length),
    0,
  );
  const aggregateUtilization = totalExpectedHours
    ? (operationsBillableHours / totalExpectedHours) * 100
    : 0;
  return {
    employeeCount: employees.length,
    currentlyWorkingCount: employees.filter(
      (item) => item.status === "working" || item.status === "paused",
    ).length,
    totalHoursLogged,
    totalBillableHours,
    totalExpectedHours,
    aggregateUtilization,
    averageEmployeeUtilization: operationsEmployees.length
      ? operationsEmployees.reduce((sum, item) => sum + item.utilisation, 0) /
        operationsEmployees.length
      : 0,
    projectsWorked: new Set(
      employees.flatMap(
        (item) => item.projectIds ?? item.entries.map((entry) => entry.project_id),
      ),
    ).size,
    clientsServed: new Set(
      employees.flatMap(
        (item) =>
          item.clientIds ??
          item.entries
            .map((entry) => entry.projects?.clients?.id)
            .filter((value): value is string => Boolean(value)),
      ),
    ).size,
    averageDailyHours: employees.length
      ? employees.reduce((sum, item) => sum + item.averageDailyHours, 0) /
        employees.length
      : 0,
    averageSessionHours: entryCount ? totalHoursLogged / entryCount : 0,
    employees,
  };
}

export async function getTeamMetrics(
  filters: TeamMetricFilters,
): Promise<TeamMetrics> {
  const employeeResult = await supabase.rpc(
    "get_workforce_overview_employees",
  );
  if (employeeResult.error) throw employeeResult.error;
  const employeeRows = (employeeResult.data || []) as WorkforceEmployeeRow[];
  const teamEmployees: TeamEmployee[] = employeeRows
    .filter(
      (employee) =>
        (!filters.employeeId || employee.id === filters.employeeId) &&
        (!filters.employeeStatus || employee.status === filters.employeeStatus),
    )
    .map((employee) => ({
      id: employee.id,
      employee_code: employee.employee_code,
      title: employee.title,
      name: employee.name,
      gender: null,
      email: employee.email,
      role: employee.role,
      level: null,
      department: employee.department,
      date_of_joining: null,
      date_of_birth: null,
      epf_number: null,
      uan_number: null,
      reporting_manager_id: employee.reporting_manager_id,
      reporting_manager: employee.reporting_manager_id
        ? {
            id: employee.reporting_manager_id,
            name: employee.reporting_manager_name || "Reporting manager",
            title: employee.reporting_manager_title,
          }
        : null,
      status: employee.status,
      hourly_cost: null,
    }));
  const visibleEmployeeIds = teamEmployees.map((employee) => employee.id);
  if (!visibleEmployeeIds.length) return calculateTeamMetrics([]);

  const timerQuery = supabase
    .from("active_timers")
    .select(
      "id,employee_id,project_id,started_at,paused_at,total_paused_seconds,status,description,projects(id,name,project_code,clients(id,name))",
    )
    .in("status", ["running", "paused"])
    .in("employee_id", visibleEmployeeIds);

  const [timerResult, summaryResult, holidayResult, leaveResult] = await Promise.all([
    timerQuery,
    supabase.rpc("get_workforce_overview_time_summary", {
      p_start_date: filters.startDate,
      p_end_date: filters.endDate,
    }),
    supabase
      .from("holidays")
      .select("holiday_date,day_part")
      .eq("is_active", true)
      .gte("holiday_date", filters.startDate)
      .lte("holiday_date", filters.endDate),
    supabase
      .from("leave_request_days")
      .select("employee_id,leave_date,day_part,duration,status,is_working_day")
      .in("employee_id", visibleEmployeeIds)
      .in("status", ["approved", "cancellation_requested"])
      .eq("is_working_day", true)
      .gte("leave_date", filters.startDate)
      .lte("leave_date", filters.endDate),
  ]);
  if (timerResult.error) throw timerResult.error;
  if (summaryResult.error) throw summaryResult.error;
  if (holidayResult.error) throw holidayResult.error;
  if (leaveResult.error) throw leaveResult.error;

  const holidayParts = new Map<string, Set<string>>();
  for (const holiday of holidayResult.data || []) {
    const parts = holidayParts.get(holiday.holiday_date) || new Set<string>();
    if (holiday.day_part === "full_day") { parts.add("first_half"); parts.add("second_half"); }
    else parts.add(holiday.day_part);
    holidayParts.set(holiday.holiday_date, parts);
  }
  const leavePartsByEmployee = new Map<string, Map<string, Set<string>>>();
  for (const day of leaveResult.data || []) {
    const employeeDays = leavePartsByEmployee.get(day.employee_id) || new Map<string, Set<string>>();
    const parts = employeeDays.get(day.leave_date) || new Set<string>();
    parts.add(day.day_part);
    employeeDays.set(day.leave_date, parts);
    leavePartsByEmployee.set(day.employee_id, employeeDays);
  }

  const timers = (timerResult.data || []) as unknown as TeamTimer[];
  const summaryMap = new Map(
    ((summaryResult.data || []) as WorkforceTimeSummary[]).map((row) => [
      row.employee_id,
      row,
    ]),
  );
  const workdays = weekdays(filters.startDate, filters.endDate);
  const analytics = teamEmployees.map((employee) => {
    const summary = summaryMap.get(employee.id);
    const hours = Number(summary?.total_hours || 0);
    const billableHours = Number(summary?.billable_hours || 0);
    const expectedHours = expectedCapacityHours({
        startDate: filters.startDate,
        endDate: filters.endDate,
        holidayParts,
        approvedLeaveParts: leavePartsByEmployee.get(employee.id),
      });
    const isOperationsEmployee =
      String(employee.department || "").trim().toLowerCase() === "operations";
    const utilisation =
      isOperationsEmployee && expectedHours
        ? (billableHours / expectedHours) * 100
        : 0;
    const timer = timers.find((item) => item.employee_id === employee.id) || null;
    const entryCount = Number(summary?.entry_count || 0);
    return {
      employee,
      entries: [],
      timer,
      hours,
      expectedHours,
      utilisation,
      billableHours,
      nonBillableHours: Math.max(0, hours - billableHours),
      billableUtilisation: utilisation,
      nonBillableUtilisation: 0,
      projects: summary?.project_ids?.length || 0,
      clients: summary?.client_ids?.length || 0,
      averageDailyHours: workdays ? hours / workdays : 0,
      averageSession: entryCount ? hours / entryCount : 0,
      longestSession: Number(summary?.longest_session || 0),
      entryCount,
      projectIds: summary?.project_ids || [],
      clientIds: summary?.client_ids || [],
      status: employeeStatus(employee, timer),
    } satisfies EmployeeAnalytics;
  });
  return calculateTeamMetrics(analytics);
}
