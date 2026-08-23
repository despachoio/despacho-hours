import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync("src/app/(app)/layout.tsx", "utf8");
const globals = readFileSync("src/app/globals.css", "utf8");

describe("Stone Grey sidebar theme", () => {
  it("defines semantic sidebar design tokens", () => {
    for (const token of [
      "--sidebar-bg: #f6f3f3",
      "--sidebar-border: #e1e4e8",
      "--sidebar-text: #3f4a59",
      "--sidebar-icon-bg: #e9ecef",
      "--sidebar-active-bg: #d7dbe2",
      "--sidebar-hover-bg: #e6e9ee",
      "--sidebar-profile-bg: #f8f8f7",
    ]) {
      expect(globals).toContain(token);
    }
  });

  it("uses the neutral theme for desktop and mobile navigation", () => {
    expect(layout).toContain("bg-[var(--sidebar-bg)]");
    expect(layout).toContain("bg-[var(--sidebar-active-bg)]");
    expect(layout).toContain("bg-[var(--sidebar-active-icon-bg)]");
    expect(layout).toContain("bg-[var(--sidebar-profile-bg)]");
    expect(layout.match(/bg-\[var\(--sidebar-bg\)\]/g)?.length).toBeGreaterThanOrEqual(2);
    expect(layout).not.toContain('? "bg-[#153E90] text-white shadow-sm"');
  });

  it("preserves navigation order, permissions, and route detection", () => {
    for (const path of [
      "/dashboard",
      "/timer",
      "/team",
      "/time-off",
      "/payroll",
      "/invoices",
      "/accounts",
      "/settings",
    ]) {
      expect(layout).toContain(`path: "${path}"`);
    }
    expect(layout).toContain("const active = isActive(item.path)");
    expect(layout).toContain("item.roles.includes(userRole)");
  });
});
