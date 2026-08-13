import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const timerPage = readFileSync("src/app/(app)/timer/page.tsx", "utf8");

describe("manager live timer employee identity", () => {
  it("hydrates direct-report timer names from the manager-safe metrics RPC", () => {
    expect(timerPage).toContain('supabase.rpc("get_team_metric_employees")');
    expect(timerPage).toContain("setDirectReporteeNames(managerReporteeNames)");
    expect(timerPage).toContain("hydrateLiveTimerEmployeeNames(timers, managerReporteeNames)");
    expect(timerPage).toContain("hydrateLiveTimerEmployeeNames(timers, directReporteeNames)");
    expect(timerPage).toContain('employeeNames[timer.employee_id] || ""');
  });

  it("continues restricting manager timers to direct reportees", () => {
    expect(timerPage).toContain('liveTimerQuery.in("employee_id", managerReporteeIds)');
    expect(timerPage).toContain("directReporteeIds.includes(timer.employee_id)");
  });
});
