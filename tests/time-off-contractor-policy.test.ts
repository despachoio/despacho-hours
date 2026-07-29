import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/202607290012_contractor_time_off_policy.sql",
  ),
  "utf8",
);

describe("contractor Time Off database policy", () => {
  it("enforces the six-completed-month paid-leave waiting period", () => {
    expect(migration).toContain("contractor_paid_leave_wait_months");
    expect(migration).toContain("v_type.code in ('PL', 'UL')");
    expect(migration).toContain(
      "Contractors become eligible for Planned and Unplanned Leave after six completed months",
    );
  });

  it("makes waiting-period LOP unlimited and deducts salary at 1x", () => {
    expect(migration).toContain("contractor_waiting_lop_salary_multiplier");
    expect(migration).toContain("not ilike '%permits at most%working days per request%'");
    expect(migration).toContain("'override_required', case when v_stage = 'waiting_period'");
  });

  it("uses role-aware rules in evaluation, balances, dashboards, and year close", () => {
    expect(migration).toContain("time_off_employee_paid_entitlement");
    expect(migration).toContain("time_off_employee_lop_multiplier");
    expect(migration).toContain("get_time_off_dashboard_pre_contractor");
    expect(migration).toContain("close_employee_leave_year_pre_contractor");
  });

  it("only reconciles pending historical LOP requests", () => {
    expect(migration).toContain("request.status = 'pending'");
    expect(migration).not.toMatch(/request\.status\s*=\s*'approved'[\s\S]*update public\.leave_requests/);
  });
});
