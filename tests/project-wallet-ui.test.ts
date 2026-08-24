import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const walletPage = readFileSync(
  "src/app/(app)/projects/[id]/wallet/page.tsx",
  "utf8",
);

describe("project service wallet experience", () => {
  it("keeps the existing wallet calculations and adjustment permissions", () => {
    expect(walletPage).toContain("(remaining / purchased) * 100");
    expect(walletPage).toContain("usageInLastThirtyDays / 30");
    expect(walletPage).toContain("Math.ceil(remaining / averageDailyUsage)");
    expect(walletPage).toContain(
      "Math.ceil((averageDailyUsage * 30) / 5) * 5",
    );
    expect(walletPage).toContain('"Finance Admin"');
    expect(walletPage).toContain('"Super Admin"');
    expect(walletPage).toContain('"Admin"');
  });

  it("uses the premium light wallet hierarchy", () => {
    expect(walletPage).toContain("Service Wallet");
    expect(walletPage).toContain("Available Hours");
    expect(walletPage).toContain("Purchased");
    expect(walletPage).toContain("Consumed");
    expect(walletPage).toContain("from-white via-blue-50/35 to-cyan-50/60");
    expect(walletPage).toContain("from-[#153E90] to-cyan-400");
    expect(walletPage).not.toContain(
      'bg-gradient-to-br from-[#153E90] to-[#0F172A] text-white',
    );
  });

  it("requires Search before rendering wallet activity results", () => {
    expect(walletPage).toContain("appliedActivityFilters");
    expect(walletPage).toContain("setAppliedActivityFilters");
    expect(walletPage).toContain("Wallet activity is ready to search");
    expect(walletPage).toContain("Activity Type");
    expect(walletPage).toContain("Employee");
    expect(walletPage).toContain("From Date");
    expect(walletPage).toContain("To Date");
    expect(walletPage).toContain("Search Activity");
  });

  it("renders the requested table and filtered Excel export", () => {
    for (const heading of [
      "Date / Time",
      "Type",
      "Employee",
      "Description",
      "Hours",
      "Balance After",
      "Reference",
    ]) {
      expect(walletPage).toContain(heading);
    }
    expect(walletPage).toContain('await import("xlsx")');
    expect(walletPage).toContain("Download Excel");
    expect(walletPage).toContain("filteredTransactions.map");
    expect(walletPage).toContain("Wallet_Activity_");
  });
});
