import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const transactions = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/202607290003_time_off_transactions.sql"), "utf8");

describe("Time Off transactional contract", () => {
  it("serializes submissions, approvals, and adjustments per employee and year", () => {
    expect(transactions.match(/'time-off:' \|\|/g)?.length).toBeGreaterThanOrEqual(3);
    expect(transactions).toContain("pg_advisory_xact_lock");
  });

  it("locks a request before approval or cancellation", () => {
    expect(transactions.match(/for update/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("revalidates the authoritative policy during approval", () => {
    expect(transactions).toContain("time_off_evaluate_leave_request(");
    expect(transactions).toContain("This request no longer satisfies the leave policy");
  });

  it("makes year closure idempotent and supports audited reversal", () => {
    expect(transactions).toContain("on conflict (employee_id, leave_year) do update");
    expect(transactions).toContain("This employee leave year is already closed");
  });
});
