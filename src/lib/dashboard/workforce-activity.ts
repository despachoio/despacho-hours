import { addDateKeyDays } from "@/lib/metrics/date-ranges";

export type WorkforceEventType =
  | "birthday"
  | "anniversary"
  | "new_joiner"
  | "leave"
  | "last_working_day";

export type WorkforceEvent = {
  id: string;
  type: WorkforceEventType;
  date: string;
  endDate?: string;
  employee: { id: string; name: string; employeeCode: string | null };
  title: string;
  detail: string;
  targetRoute?: string;
};

export type WorkforceActivityPayload = {
  businessDate: string;
  upcomingThrough: string;
  today: WorkforceEvent[];
  upcoming: WorkforceEvent[];
};

export type ActivityEmployee = {
  id: string;
  employee_code: string | null;
  name: string;
  date_of_birth: string | null;
  date_of_joining: string | null;
};

export type ActivityLeave = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  leaveTypeName: string;
};

export type ActivityExit = {
  id: string;
  employee_id: string;
  approved_last_working_date: string;
};

function validDateKey(year: number, monthDay: string) {
  const candidate = `${year}-${monthDay}`;
  const date = new Date(`${candidate}T00:00:00Z`);
  return date.toISOString().slice(0, 10) === candidate ? candidate : null;
}

function recurringDateInWindow(sourceDate: string, from: string, to: string) {
  const monthDay = sourceDate.slice(5);
  const fromYear = Number(from.slice(0, 4));
  for (const year of [fromYear, fromYear + 1]) {
    const candidate = validDateKey(year, monthDay);
    if (candidate && candidate >= from && candidate <= to) return candidate;
  }
  return null;
}

function employeeRef(employee: ActivityEmployee) {
  return {
    id: employee.id,
    name: employee.name,
    employeeCode: employee.employee_code,
  };
}

export function buildWorkforceActivity(input: {
  businessDate: string;
  employees: ActivityEmployee[];
  leaves: ActivityLeave[];
  exits: ActivityExit[];
  includeExitEmployeeIds: Set<string>;
  employeeRouteIds?: Set<string>;
}): WorkforceActivityPayload {
  const { businessDate, employees, leaves, exits, includeExitEmployeeIds } = input;
  const upcomingFrom = addDateKeyDays(businessDate, 1);
  const upcomingThrough = addDateKeyDays(businessDate, 7);
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const events: WorkforceEvent[] = [];
  const routeFor = (employeeId: string) =>
    input.employeeRouteIds?.has(employeeId) ? `/team/${employeeId}` : undefined;

  for (const employee of employees) {
    if (employee.date_of_birth) {
      const date = recurringDateInWindow(
        employee.date_of_birth,
        businessDate,
        upcomingThrough,
      );
      if (date) {
        events.push({
          id: `birthday:${employee.id}:${date}`,
          type: "birthday",
          date,
          employee: employeeRef(employee),
          title: `${employee.name}'s birthday`,
          detail: "Birthday",
          targetRoute: routeFor(employee.id),
        });
      }
    }

    if (employee.date_of_joining) {
      if (
        employee.date_of_joining >= businessDate &&
        employee.date_of_joining <= upcomingThrough
      ) {
        events.push({
          id: `new_joiner:${employee.id}:${employee.date_of_joining}`,
          type: "new_joiner",
          date: employee.date_of_joining,
          employee: employeeRef(employee),
          title: employee.date_of_joining === businessDate
            ? `${employee.name} joins today`
            : `${employee.name} joins Despacho`,
          detail: "New joiner",
          targetRoute: routeFor(employee.id),
        });
      } else {
        const date = recurringDateInWindow(
          employee.date_of_joining,
          businessDate,
          upcomingThrough,
        );
        if (date) {
          const years = Number(date.slice(0, 4)) - Number(employee.date_of_joining.slice(0, 4));
          if (years >= 1) {
            events.push({
              id: `anniversary:${employee.id}:${date}`,
              type: "anniversary",
              date,
              employee: employeeRef(employee),
              title: `${employee.name}'s work anniversary`,
              detail: `${years} ${years === 1 ? "year" : "years"} at Despacho`,
              targetRoute: routeFor(employee.id),
            });
          }
        }
      }
    }
  }

  for (const leave of leaves) {
    const employee = employeeById.get(leave.employee_id);
    if (!employee) continue;
    const occursToday = leave.start_date <= businessDate && leave.end_date >= businessDate;
    const startsUpcoming = leave.start_date >= upcomingFrom && leave.start_date <= upcomingThrough;
    if (!occursToday && !startsUpcoming) continue;
    events.push({
      id: `leave:${leave.id}`,
      type: "leave",
      date: occursToday ? businessDate : leave.start_date,
      endDate: leave.end_date,
      employee: employeeRef(employee),
      title: `${employee.name} · ${leave.leaveTypeName}`,
      detail: occursToday ? "On approved leave today" : "Approved leave",
      targetRoute: routeFor(employee.id),
    });
  }

  for (const exit of exits) {
    if (!includeExitEmployeeIds.has(exit.employee_id)) continue;
    const employee = employeeById.get(exit.employee_id);
    if (!employee) continue;
    events.push({
      id: `last_working_day:${exit.id}`,
      type: "last_working_day",
      date: exit.approved_last_working_date,
      employee: employeeRef(employee),
      title: `${employee.name}'s last working day`,
      detail: "Approved last working day",
      targetRoute: routeFor(employee.id),
    });
  }

  const ordered = events.sort((left, right) =>
    left.date.localeCompare(right.date) || left.type.localeCompare(right.type) ||
    left.employee.name.localeCompare(right.employee.name),
  );
  return {
    businessDate,
    upcomingThrough,
    today: ordered.filter((event) => event.date === businessDate),
    upcoming: ordered.filter(
      (event) => event.date >= upcomingFrom && event.date <= upcomingThrough,
    ),
  };
}

