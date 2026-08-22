import { NextResponse } from "next/server";
import { buildWorkforceActivity } from "@/lib/dashboard/workforce-activity";
import { businessDateKey, addDateKeyDays } from "@/lib/metrics/date-ranges";
import { getProfileApiContext } from "@/lib/server/profile-auth";
import { isAdminLevelRole, normalizeRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

type EmployeeRow = {
  id: string;
  employee_code: string | null;
  name: string;
  date_of_birth: string | null;
  date_of_joining: string | null;
  reporting_manager_id: string | null;
};

export async function GET(request: Request) {
  const context = await getProfileApiContext(request);
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  try {
    const businessDate = businessDateKey();
    const upcomingThrough = addDateKeyDays(businessDate, 7);
    const role = normalizeRole(context.profile.role);
    const isAdmin = isAdminLevelRole(role);
    const isManager = role === "manager";

    const [employeesResult, leavesResult, exitsResult] = await Promise.all([
      context.admin
        .from("employees")
        .select("id,employee_code,name,date_of_birth,date_of_joining,reporting_manager_id")
        .eq("status", "active")
        .order("employee_code"),
      context.admin
        .from("leave_requests")
        .select("id,employee_id,start_date,end_date,leave_types(name)")
        .eq("status", "approved")
        .gte("end_date", businessDate)
        .lte("start_date", upcomingThrough)
        .order("start_date"),
      isAdmin || isManager
        ? context.admin
            .from("employee_exits")
            .select("id,employee_id,approved_last_working_date,status")
            .not("approved_last_working_date", "is", null)
            .gte("approved_last_working_date", businessDate)
            .lte("approved_last_working_date", upcomingThrough)
            .not("status", "in", '("draft","submitted","cancelled")')
            .order("approved_last_working_date")
        : Promise.resolve({ data: [], error: null }),
    ]);

    const error = employeesResult.error || leavesResult.error || exitsResult.error;
    if (error) throw new Error(error.message);

    const employees = (employeesResult.data || []) as EmployeeRow[];
    const visibleEmployeeIds = new Set(employees.map((employee) => employee.id));
    const managedIds = new Set(
      employees
        .filter((employee) => employee.reporting_manager_id === context.profile.employee_id)
        .map((employee) => employee.id),
    );
    const exitEmployeeIds = isAdmin
      ? visibleEmployeeIds
      : isManager
        ? managedIds
        : new Set<string>();
    const routeEmployeeIds = isAdmin
      ? visibleEmployeeIds
      : isManager
        ? managedIds
        : new Set<string>();

    const leaves = (leavesResult.data || []).map((leave) => {
      const leaveType = leave.leave_types as unknown as { name: string } | null;
      return {
        id: leave.id,
        employee_id: leave.employee_id,
        start_date: leave.start_date,
        end_date: leave.end_date,
        leaveTypeName: leaveType?.name || "Leave",
      };
    });
    const exits = (exitsResult.data || [])
      .filter((exit) => Boolean(exit.approved_last_working_date))
      .map((exit) => ({
        id: exit.id,
        employee_id: exit.employee_id,
        approved_last_working_date: String(exit.approved_last_working_date),
      }));

    const payload = buildWorkforceActivity({
      businessDate,
      employees,
      leaves,
      exits,
      includeExitEmployeeIds: exitEmployeeIds,
      employeeRouteIds: routeEmployeeIds,
    });
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (cause) {
    console.error("Unable to load dashboard workforce activity", cause);
    return NextResponse.json(
      { error: "Unable to load workforce activity right now" },
      { status: 500 },
    );
  }
}

