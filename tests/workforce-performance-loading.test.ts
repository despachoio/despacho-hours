import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("Workforce lazy loading and query performance", () => {
  it("loads tab modules dynamically and only loads Overview metrics on Overview", () => {
    const page = source("src/app/(app)/team/page.tsx");
    expect(page).toContain('import dynamic from "next/dynamic"');
    expect(page).toContain('searchParams.get("tab")');
    expect(page).toContain('if (tab !== "overview"');
    expect(page).toContain('tab !== "overview" || !showNewMember');
    expect(page).toContain('import("@/components/performance/ReviewsWorkspace")');
    expect(page).toContain('import("@/components/team/OrganizationChartLoader")');
  });

  it("does not download raw time-entry pages for Workforce or Reviews", () => {
    const metrics = source("src/lib/metrics/team-metrics.ts");
    const performance = source("src/lib/performance/server.ts");
    expect(metrics).not.toContain('from("time_entries")');
    expect(metrics).toContain('rpc("get_workforce_overview_time_summary"');
    expect(performance).not.toContain("loadAllBillableTimeEntries");
    expect(performance).toContain(
      'rpc("get_performance_billable_monthly_summary"',
    );
  });

  it("adds focused indexes and keeps profile approvals bounded", () => {
    const migration = source(
      "supabase/migrations/202608200001_workforce_query_performance.sql",
    );
    const approvals = source("src/app/api/profile/change-requests/route.ts");
    expect(migration).toContain(
      "time_entries(employee_id, entry_date)",
    );
    expect(migration).toContain("p_start_date");
    expect(migration).toContain("p_end_date");
    expect(approvals).toContain("Math.min(");
    expect(approvals).toContain(".range(from, from + pageSize - 1)");
  });
});
