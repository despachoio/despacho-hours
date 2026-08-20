import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canResetAnnualReview } from "../src/lib/performance/review-workflow";

const source = (path: string) => readFileSync(path, "utf8");

describe("Annual Review reset workflow", () => {
  const server = source("src/lib/performance/server.ts");
  const route = source("src/app/api/performance/route.ts");
  const workspace = source("src/components/performance/ReviewsWorkspace.tsx");
  const migration = source(
    "supabase/migrations/202608200002_reset_annual_review.sql",
  );

  it("permits only Super Admin and Finance Admin to reset eligible reviews", () => {
    for (const role of ["super admin", "finance admin"]) {
      expect(canResetAnnualReview(role, "under_review")).toBe(true);
      expect(canResetAnnualReview(role, "reopened")).toBe(true);
    }
    for (const role of ["admin", "manager", "employee"]) {
      expect(canResetAnnualReview(role, "under_review")).toBe(false);
      expect(canResetAnnualReview(role, "reopened")).toBe(false);
    }
  });

  it("protects not-started and finalized reviews", () => {
    for (const status of [undefined, "draft", "finalized"] as const) {
      expect(canResetAnnualReview("finance admin", status)).toBe(false);
    }
    expect(migration).toContain(
      "v_previous.status not in ('under_review', 'reopened')",
    );
    expect(server).toContain(
      'if(!["under_review","reopened"].includes(expectedStatus))',
    );
  });

  it("enforces reset authorization server-side and routes it separately", () => {
    expect(server).toContain(
      "export async function resetAnnualReview(request:Request",
    );
    expect(server).toContain("performanceAdmin(actor.role)");
    expect(server).toContain('rpc("reset_annual_review"');
    expect(route).toContain('action==="reset_review"');
    expect(migration).toContain(
      "v_actor_role not in ('super admin', 'finance admin')",
    );
    expect(migration).toContain("to service_role");
  });

  it("requires confirmation and immediately reloads the annual review", () => {
    expect(workspace).toContain("Reset Annual Review?");
    expect(workspace).toContain("Reset Review");
    expect(workspace).toContain('role="dialog"');
    expect(workspace).toContain('action:"reset_review"');
    expect(workspace).toContain("await reload()");
    expect(workspace).toContain('review.status==="draft"');
  });

  it("clears only abandoned workflow state and review comments", () => {
    for (const field of [
      "snapshot = null",
      "started_at = null",
      "started_by = null",
      "finalized_at = null",
      "finalized_by = null",
      "reopened_at = null",
      "reopened_by = null",
      "reopen_reason = null",
      "manager_decision = null",
      "hr_decision = null",
    ]) {
      expect(migration).toContain(field);
    }
    expect(migration).toContain("delete from public.performance_comments");
    expect(migration).not.toMatch(/delete from public\.performance_events/i);
    expect(migration).not.toMatch(/delete from public\.time_entries/i);
    expect(migration).not.toMatch(/update public\.performance_events/i);
  });

  it("records an auditable, atomic, stale-safe reset", () => {
    expect(migration).toContain("for update");
    expect(migration).toContain("v_previous.status <> p_expected_status");
    expect(migration).toContain("'ANNUAL_REVIEW_RESET'");
    expect(migration).toContain(
      "jsonb_build_object('status', v_previous.status)",
    );
    expect(migration).toContain(
      "jsonb_build_object('status', v_updated.status)",
    );
  });

  it("tracks a fresh start and permits only valid lifecycle transitions", () => {
    expect(server).toContain("started_at:startedAt");
    expect(server).toContain("started_by:actor.userId");
    expect(server).toContain(
      'existing.data&&existing.data.status!=="draft"',
    );
    expect(server).toContain(
      '!["under_review","reopened"].includes(existing.data.status)',
    );
  });
});
