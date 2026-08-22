import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync("src/app/(app)/dashboard/page.tsx", "utf8");

describe("dashboard invoice overview", () => {
  it("presents invoice intelligence as a premium, cohesive financial panel", () => {
    expect(dashboard).toContain("A live view of receivables, collections, and payment health.");
    expect(dashboard).toContain("bg-gradient-to-r from-blue-50/80 via-white to-emerald-50/60");
    expect(dashboard).toContain("rounded-[2rem]");
    expect(dashboard).toContain("View invoices");
  });

  it("preserves the existing metrics, destinations, and whole-number formatting", () => {
    for (const label of ["Total Open", "Total Paid", "Invoices Paid in", "Overdue"]) {
      expect(dashboard).toContain(label);
    }
    expect(dashboard).toContain('maximumFractionDigits: 0');
    expect(dashboard).toContain('/invoices?tab=all&status=open');
    expect(dashboard).toContain('/invoices?tab=all&status=paid');
    expect(dashboard).toContain('/invoices?tab=all&status=overdue');
  });
});
