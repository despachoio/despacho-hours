import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildWorkforceActivity } from "../src/lib/dashboard/workforce-activity";

const employee = (overrides: Partial<Parameters<typeof buildWorkforceActivity>[0]["employees"][number]> = {}) => ({
  id: "employee-1",
  employee_code: "90001",
  name: "Aarthi J",
  date_of_birth: null,
  date_of_joining: null,
  ...overrides,
});

describe("dashboard workforce activity", () => {
  it("builds today's approved leave, birthday, anniversary, joiner and approved LWD", () => {
    const result = buildWorkforceActivity({
      businessDate: "2026-08-23",
      employees: [employee({ date_of_birth: "1996-08-23", date_of_joining: "2020-08-23" })],
      leaves: [{ id: "leave-1", employee_id: "employee-1", start_date: "2026-08-22", end_date: "2026-08-24", leaveTypeName: "Planned Leave" }],
      exits: [{ id: "exit-1", employee_id: "employee-1", approved_last_working_date: "2026-08-23" }],
      includeExitEmployeeIds: new Set(["employee-1"]),
    });
    expect(result.today.map((event) => event.type)).toEqual([
      "anniversary", "birthday", "last_working_day", "leave",
    ]);
    expect(result.today.find((event) => event.type === "anniversary")?.detail).toBe("6 years at Despacho");
  });

  it("uses the next seven calendar days across a year boundary and shows leave ranges once", () => {
    const result = buildWorkforceActivity({
      businessDate: "2026-12-29",
      employees: [employee({ date_of_birth: "1996-01-02" })],
      leaves: [{ id: "leave-1", employee_id: "employee-1", start_date: "2027-01-01", end_date: "2027-01-03", leaveTypeName: "Planned Leave" }],
      exits: [],
      includeExitEmployeeIds: new Set(),
    });
    expect(result.upcomingThrough).toBe("2027-01-05");
    expect(result.upcoming.map((event) => event.type)).toEqual(["leave", "birthday"]);
    expect(result.upcoming[0].endDate).toBe("2027-01-03");
  });

  it("does not invent a non-leap-year date for a February 29 birthday", () => {
    const result = buildWorkforceActivity({
      businessDate: "2027-02-25",
      employees: [employee({ date_of_birth: "1996-02-29" })],
      leaves: [], exits: [], includeExitEmployeeIds: new Set(),
    });
    expect(result.today).toHaveLength(0);
    expect(result.upcoming).toHaveLength(0);
  });

  it("keeps exit events out when the employee is outside the authorized set", () => {
    const result = buildWorkforceActivity({
      businessDate: "2026-08-23",
      employees: [employee()], leaves: [],
      exits: [{ id: "exit-1", employee_id: "employee-1", approved_last_working_date: "2026-08-24" }],
      includeExitEmployeeIds: new Set(),
    });
    expect(result.upcoming).toHaveLength(0);
  });

  it("uses a server route, excludes sensitive fields, and isolates component failure", () => {
    const route = readFileSync("src/app/api/dashboard/workforce-activity/route.ts", "utf8");
    const component = readFileSync("src/components/dashboard/WorkforceActivity.tsx", "utf8");
    const dashboard = readFileSync("src/app/(app)/dashboard/page.tsx", "utf8");
    expect(route).toContain('businessDateKey()');
    expect(route).toContain('.eq("status", "approved")');
    expect(route).not.toContain("reason,");
    expect(route).not.toContain("date_of_birth:");
    expect(component).toContain("The rest of your dashboard is unaffected");
    expect(component).toContain("Retry");
    expect(dashboard).toContain("<WorkforceActivity />");
  });
});

