import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/202608120001_reconcile_project_wallet_hours.sql",
  "utf8",
);
const timerPage = readFileSync("src/app/(app)/timer/page.tsx", "utf8");

describe("project wallet reconciliation", () => {
  it("backfills one canonical wallet debit for every non-zero time entry", () => {
    expect(migration).toContain("from public.time_entries as entry_row");
    expect(migration).toContain("'time-entry:' || entry_row.id::text");
    expect(migration).toContain("on conflict (source_key)");
    expect(migration).toContain("-round(entry_row.hours::numeric, 2)");
  });

  it("keeps project-card totals synchronized from the wallet ledger", () => {
    expect(migration).toContain(
      "create or replace function public.sync_project_wallet",
    );
    expect(migration).toContain("purchased_hours = round(credited, 2)");
    expect(migration).toContain("used_hours = round(consumed, 2)");
    expect(migration).toContain("remaining_hours = round(available, 2)");
    expect(migration).toContain(
      "perform public.sync_project_wallet(project_row.id)",
    );
  });

  it("synchronizes changes made through time entries and wallet adjustments", () => {
    expect(migration).toContain("maintain_wallet_from_time_entries");
    expect(migration).toContain("sync_project_wallet_after_transaction");
    expect(migration).toContain("after insert or delete or update");
  });

  it("does not overwrite ledger-derived balances from the Timer client", () => {
    expect(timerPage).not.toContain("function recalculateProjectHours");
    expect(timerPage).not.toContain("await recalculateProjectHours");
  });
});
