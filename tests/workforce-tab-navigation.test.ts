import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveWorkforceTab,
  workforceTabUrl,
  type WorkforceTab,
} from "../src/lib/workforce/tabs";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("Workforce URL-backed tab navigation", () => {
  const visibleTabs: WorkforceTab[] = [
    "overview",
    "approvals",
    "organization",
    "reviews",
    "assets",
    "exit",
    "policies",
  ];

  it("defaults missing and invalid tab parameters to Overview", () => {
    expect(resolveWorkforceTab(null, false)).toBe("overview");
    expect(resolveWorkforceTab("invalid", true)).toBe("overview");
  });

  it("resolves every authorized direct Workforce tab independently", () => {
    for (const tab of visibleTabs) {
      expect(resolveWorkforceTab(tab, true)).toBe(tab);
    }
  });

  it("falls unauthorized Profile Approvals back to Overview", () => {
    expect(resolveWorkforceTab("approvals", false)).toBe("overview");
    expect(resolveWorkforceTab("approvals", true)).toBe("approvals");
  });

  it("keeps Reviews sub-tab state only while Reviews is active", () => {
    const query = "tab=reviews&reviewTab=recognition";
    expect(workforceTabUrl("/team", query, "reviews")).toBe(
      "/team?tab=reviews&reviewTab=recognition",
    );
    expect(workforceTabUrl("/team", query, "assets")).toBe(
      "/team?tab=assets",
    );
    expect(workforceTabUrl("/team", query, "overview")).toBe("/team");
  });

  it("uses links for history navigation and mounts only the active tab", () => {
    const page = source("src/app/(app)/team/page.tsx");
    expect(page).toContain('import Link from "next/link"');
    expect(page).toContain("href={tabHref(item.value)}");
    expect(page).toContain('tab === "overview"');
    expect(page).toContain('tab === "approvals" && isAdmin');
    expect(page).toContain('tab === "organization"');
    expect(page).toContain('tab === "reviews"');
    expect(page).toContain('tab === "assets"');
    expect(page).toContain('tab === "exit"');
    expect(page).toContain('tab === "policies"');
    expect(page).toContain("isAdmin ?");
  });

  it("prevents Reviews sub-navigation from controlling another Workforce tab", () => {
    const reviews = source(
      "src/components/performance/ReviewsWorkspace.tsx",
    );
    expect(reviews).toContain('workforceTab!=="reviews"');
    expect(reviews).toContain('searchParams.get("reviewTab")');
    expect(reviews).toContain("REVIEWS_DASHBOARD_ENABLED");
  });
});
