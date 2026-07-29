import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrations = fs.readdirSync(path.join(process.cwd(), "supabase/migrations"))
  .filter((file) => file.startsWith("20260729000") && file.endsWith(".sql"))
  .map((file) =>
  fs.readFileSync(path.join(process.cwd(), "supabase/migrations", file), "utf8"),
).join("\n");

describe("Time Off database security contract", () => {
  it("enables RLS on every private Time Off table", () => {
    for (const table of [
      "employee_leave_balances",
      "leave_requests",
      "leave_request_days",
      "leave_request_actions",
      "leave_balance_adjustments",
      "leave_year_closures",
      "leave_attachments",
      "time_off_audit_log",
    ]) {
      expect(migrations).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("scopes managers through the existing reporting hierarchy", () => {
    expect(migrations).toContain("employee.reporting_manager_id = public.get_my_employee_id()");
  });

  it("prevents managers approving themselves", () => {
    expect(migrations).toContain("You cannot approve or reject your own leave request");
  });

  it("requires administrative authority for balance adjustments and year close", () => {
    expect(migrations.match(/if not public\.time_off_is_admin\(\)/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("uses row locks and advisory transaction locks for race protection", () => {
    expect(migrations).toContain("for update");
    expect(migrations).toContain("pg_advisory_xact_lock");
  });

  it("prevents duplicate active half-day slots", () => {
    expect(migrations).toContain("leave_request_days_active_slot_unique");
    expect(migrations).toContain("cancellation_requested");
  });

  it("keeps request history immutable through RPC-only writes", () => {
    expect(migrations).not.toMatch(/create policy leave_requests_.*write/);
    expect(migrations).toContain("leave_request_actions");
    expect(migrations).toContain("time_off_audit_log");
  });

  it("protects attachment storage with a private bucket", () => {
    expect(migrations).toContain("'leave-attachments', 'leave-attachments', false");
    expect(migrations).toContain("leave_attachments_storage_read");
  });

  it("blocks full-day timers at the database boundary", () => {
    expect(migrations).toContain("prevent_timer_during_full_day_leave");
    expect(migrations).toContain("Asia/Kolkata");
  });

  it("keeps historical holidays immutable", () => {
    expect(migrations).toContain("Past or current holidays cannot be deleted");
  });

  it("requires reasons for overrides, reversals, and manual changes", () => {
    expect(migrations).toContain("An administrative override reason is required");
    expect(migrations).toContain("A reversal reason is required");
    expect(migrations).toContain("An adjustment reason is required");
  });
});
