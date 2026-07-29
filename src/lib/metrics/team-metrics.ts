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
    status: employeeStatus(employee, timer),
  };
}

async function fetchTimeEntries(
  filters: TeamMetricFilters,
  visibleEmployeeIds: string[],
) {
  const entries: TeamEntry[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from("time_entries")
      .select(
        "id,employee_id,project_id,entry_date,started_at,stopped_at,hours,description,projects(id,name,project_code,is_billable,clients(id,name))",
      )
      .gte("entry_date", filters.startDate)
      .lte("entry_date", filters.endDate)
      .order("entry_date", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (filters.employeeId) query = query.eq("employee_id", filters.employeeId);
    else query = query.in("employee_id", visibleEmployeeIds);
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
  const entries = employees.flatMap((item) => item.entries);
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
  let employeeRows: Array<Omit<TeamEmployee, "reporting_manager">>;
  if (filters.reportingManagerId) {
    const employeeResult = await supabase.rpc("get_team_metric_employees");
    if (employeeResult.error) throw employeeResult.error;
    employeeRows = (employeeResult.data || []) as unknown as Array<
      Omit<TeamEmployee, "reporting_manager">
    >;
    if (
      filters.includeEmployeeId &&
      !employeeRows.some(
        (employee) => employee.id === filters.includeEmployeeId,
      )
    ) {
      const selfResult = await supabase
        .from("employees")
        .select(
          "id,employee_code,title,name,gender,email,role,department,date_of_joining,date_of_birth,epf_number,uan_number,reporting_manager_id,status,hourly_cost",
        )
        .eq("id", filters.includeEmployeeId)
        .maybeSingle();
      if (selfResult.error) throw selfResult.error;
      if (selfResult.data) {
        employeeRows.push(
          selfResult.data as unknown as Omit<
            TeamEmployee,
            "reporting_manager"
          >,
        );
      }
    }
  } else {
    let employeeQuery = supabase
      .from("employees")
      .select(
        "id,employee_code,title,name,gender,email,role,department,date_of_joining,date_of_birth,epf_number,uan_number,reporting_manager_id,status,hourly_cost",
      )
      .order("created_at", { ascending: true });

    if (filters.employeeId) {
      employeeQuery = employeeQuery.eq("id", filters.employeeId);
    }
    if (filters.employeeStatus) {
      employeeQuery = employeeQuery.eq("status", filters.employeeStatus);
    }

    const employeeResult = await employeeQuery;
    if (employeeResult.error) throw employeeResult.error;
    employeeRows = (employeeResult.data || []) as unknown as Array<
      Omit<TeamEmployee, "reporting_manager">
    >;
  }
  const managerIds = Array.from(
    new Set(
      employeeRows
        .map((employee) => employee.reporting_manager_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const managerMap = new Map<
    string,
    NonNullable<TeamEmployee["reporting_manager"]>
  >();
  if (managerIds.length) {
    const managerResult = await supabase
      .from("employees")
      .select("id,name,title")
      .in("id", managerIds);
    if (managerResult.error) {
      console.warn(
        "Unable to load reporting-manager names",
        managerResult.error,
      );
    } else {
      for (const manager of managerResult.data || []) {
        managerMap.set(manager.id, manager);
      }
    }
  }
  const teamEmployees: TeamEmployee[] = employeeRows.map((employee) => ({
    ...employee,
    reporting_manager: employee.reporting_manager_id
      ? managerMap.get(employee.reporting_manager_id) || null
      : null,
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

  const [timerResult, entries, holidayResult, leaveResult] = await Promise.all([
    timerQuery,
    fetchTimeEntries(filters, visibleEmployeeIds),
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
  const analytics = teamEmployees.map((employee) =>
    employeeAnalytics(
      employee,
      entries.filter((entry) => entry.employee_id === employee.id),
      timers.find((timer) => timer.employee_id === employee.id) || null,
      filters.startDate,
      filters.endDate,
      expectedCapacityHours({
        startDate: filters.startDate,
        endDate: filters.endDate,
        holidayParts,
        approvedLeaveParts: leavePartsByEmployee.get(employee.id),
      }),
    ),
  );
  return calculateTeamMetrics(analytics);
}
