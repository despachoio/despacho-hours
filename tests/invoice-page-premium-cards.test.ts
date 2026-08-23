import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const invoices = readFileSync("src/app/(app)/invoices/page.tsx", "utf8");

describe("invoice overview premium cards", () => {
  it("uses distinct premium tones while retaining the existing filters", () => {
    for (const tone of [
      "from-[#153E90] to-cyan-400",
      "from-emerald-600 to-teal-300",
      "from-violet-600 to-fuchsia-300",
      "from-rose-600 to-orange-300",
    ]) {
      expect(invoices).toContain(tone);
    }

    expect(invoices).toContain('showFilteredInvoices("open")');
    expect(invoices).toContain('showFilteredInvoices("paid")');
    expect(invoices).toContain('showFilteredInvoices("overdue")');
    expect(invoices).toContain("hover:-translate-y-1");
  });
});
