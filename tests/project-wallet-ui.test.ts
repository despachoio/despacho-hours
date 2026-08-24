import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  filterWalletActivity,
  walletActivityDateKey,
  withWalletBalances,
  type WalletActivityTransaction,
} from "../src/lib/project-wallet-activity";

const walletPage = readFileSync(
  "src/app/(app)/projects/[id]/wallet/page.tsx",
  "utf8",
);
const activityRoute = readFileSync(
  "src/app/api/projects/[id]/wallet-activity/route.ts",
  "utf8",
);

function transaction(overrides: Partial<WalletActivityTransaction> = {}): WalletActivityTransaction {
  return {
    id: "ledger-1", project_id: "project-1", invoice_id: null,
    invoice_item_id: null, payment_id: null, time_entry_id: "time-1",
    transaction_type: "time_debit", hours_delta: -1.5, notes: null,
    created_at: "2026-08-24T18:50:00.000Z", invoices: null,
    time_entries: {
      entry_date: "2026-08-24", started_at: "2026-08-24T18:15:00.000Z",
      stopped_at: "2026-08-24T19:45:00.000Z", description: "Monthly reporting",
      employee_id: "employee-1", employees: { id: "employee-1", name: "Aarthi J" },
    },
    ...overrides,
  };
}

describe("project service wallet experience", () => {
  it("keeps the existing wallet calculations and adjustment permissions", () => {
    expect(walletPage).toContain("(remaining / purchased) * 100");
    expect(walletPage).toContain("usageInLastThirtyDays / 30");
    expect(walletPage).toContain("Math.ceil(remaining / averageDailyUsage)");
    expect(walletPage).toContain("Math.ceil((averageDailyUsage * 30) / 5) * 5");
    expect(walletPage).toContain('"Finance Admin"');
    expect(walletPage).toContain('"Super Admin"');
    expect(walletPage).toContain('"Admin"');
  });

  it("uses a dark project hero followed by the light wallet hierarchy", () => {
    expect(walletPage).toContain("from-[#0F172A] via-[#172554] to-[#153E90]");
    expect(walletPage).toContain("Service Wallet");
    expect(walletPage).toContain("Available Hours");
    expect(walletPage).toContain("Purchased");
    expect(walletPage).toContain("Consumed");
    expect(walletPage).toContain("from-white via-blue-50/35 to-cyan-50/60");
  });

  it("runs wallet activity filters through an authenticated server route", () => {
    expect(walletPage).toContain("searchActivity");
    expect(walletPage).toContain("/wallet-activity?");
    expect(walletPage).toContain("Wallet activity is ready to search");
    expect(activityRoute).toContain("getProfileApiContext");
    expect(activityRoute).toContain("filterWalletActivity");
    expect(activityRoute).toContain('"manager"');
  });

  it("renders and exports the eight requested business columns", () => {
    for (const heading of ["Date", "Start Time", "Stop Time", "Type", "Employee", "Description", "Hours", "Balance After"]) {
      expect(walletPage).toContain(heading);
    }
    expect(walletPage).not.toContain(">Reference</th>");
    expect(walletPage).not.toContain(">Date / Time</th>");
    expect(walletPage).toContain('await import("xlsx")');
    expect(walletPage).toContain('"Summary"');
    expect(walletPage).toContain("activityTransactions.map");
  });
});

describe("wallet activity data semantics", () => {
  it("uses immutable entry_date when a timer crosses midnight", () => {
    expect(walletActivityDateKey(transaction())).toBe("2026-08-24");
  });

  it("filters by the time-entry business date and employee id", () => {
    const rows = withWalletBalances([transaction()], 24);
    expect(filterWalletActivity(rows, {
      type: "usage", employee: "employee-1", fromDate: "2026-08-24",
      toDate: "2026-08-24", search: "monthly",
    })).toHaveLength(1);
  });

  it("preserves ledger order while reconstructing balance after each row", () => {
    const rows = withWalletBalances([
      transaction({ id: "latest", hours_delta: -2 }),
      transaction({ id: "older", hours_delta: 5 }),
    ], 20);
    expect(rows.map((row) => [row.id, row.balance_after])).toEqual([
      ["latest", 20], ["older", 22],
    ]);
  });
});
