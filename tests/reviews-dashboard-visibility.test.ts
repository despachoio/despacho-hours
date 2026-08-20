import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  REVIEWS_DASHBOARD_ENABLED,
  resolveReviewsTab,
  reviewsTabsForRole,
} from "../src/lib/performance/features";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("Reviews Dashboard feature visibility", () => {
  const roles = [
    "employee",
    "manager",
    "admin",
    "super admin",
    "finance admin",
    "unexpected role",
  ];

  it("disables Dashboard centrally for every role", () => {
    expect(REVIEWS_DASHBOARD_ENABLED).toBe(false);
    for (const role of roles) {
      expect(reviewsTabsForRole(role).map(([tab]) => tab)).not.toContain(
        "dashboard",
      );
    }
  });

  it("defaults and redirects every role to its first visible tab", () => {
    for (const role of roles) {
      expect(resolveReviewsTab(role, null)).toBe(
        reviewsTabsForRole(role)[0][0],
      );
      expect(resolveReviewsTab(role, "dashboard")).toBe(
        reviewsTabsForRole(role)[0][0],
      );
    }
  });

  it("keeps existing non-Dashboard role permissions unchanged", () => {
    expect(reviewsTabsForRole("employee")).toEqual([
      ["my_review", "My Review"],
      ["recognition", "Recognition"],
    ]);
    expect(reviewsTabsForRole("manager")).toEqual([
      ["my_review", "My Review"],
      ["reviews", "Team Reviews"],
      ["recognition", "Recognition"],
    ]);
    expect(reviewsTabsForRole("finance admin")).toEqual([
      ["my_review", "My Review"],
      ["reviews", "Annual Reviews"],
      ["recognition", "Recognition & Penalties"],
      ["settings", "Settings"],
    ]);
  });

  it("does not mount Dashboard while disabled and preserves its code", () => {
    const workspace = source(
      "src/components/performance/ReviewsWorkspace.tsx",
    );
    expect(workspace).toContain(
      'REVIEWS_DASHBOARD_ENABLED&&tab==="dashboard"?<Dashboard',
    );
    expect(workspace).toContain("function Dashboard({data}");
    expect(workspace).toContain('searchParams.get("reviewTab")');
    expect(workspace).toContain("resolveReviewsTab(data.role,requestedTab)");
    expect(workspace).not.toContain('useState<Tab>("dashboard")');
  });
});
