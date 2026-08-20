export const REVIEWS_DASHBOARD_ENABLED = false;

export type ReviewsTab =
  | "dashboard"
  | "my_review"
  | "reviews"
  | "recognition"
  | "settings";

export type ReviewsTabDefinition = readonly [ReviewsTab, string];

const employeeTabs: ReviewsTabDefinition[] = [
  ["my_review", "My Review"],
  ["recognition", "Recognition"],
];

const managerTabs: ReviewsTabDefinition[] = [
  ["dashboard", "Dashboard"],
  ["my_review", "My Review"],
  ["reviews", "Team Reviews"],
  ["recognition", "Recognition"],
];

const administrationTabs: ReviewsTabDefinition[] = [
  ["dashboard", "Dashboard"],
  ["my_review", "My Review"],
  ["reviews", "Annual Reviews"],
  ["recognition", "Recognition & Penalties"],
  ["settings", "Settings"],
];

export function reviewsTabsForRole(role: string): ReviewsTabDefinition[] {
  const configuredTabs =
    role === "employee"
      ? employeeTabs
      : role === "manager"
        ? managerTabs
        : administrationTabs;

  return configuredTabs.filter(
    ([tab]) => tab !== "dashboard" || REVIEWS_DASHBOARD_ENABLED,
  );
}

export function resolveReviewsTab(
  role: string,
  requestedTab: string | null | undefined,
): ReviewsTab {
  const visibleTabs = reviewsTabsForRole(role);
  const requested = visibleTabs.find(([tab]) => tab === requestedTab);
  return requested?.[0] ?? visibleTabs[0]?.[0] ?? "my_review";
}
