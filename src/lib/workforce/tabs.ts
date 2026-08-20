export type WorkforceTab =
  | "overview"
  | "approvals"
  | "organization"
  | "reviews"
  | "assets"
  | "exit"
  | "policies";

export const WORKFORCE_TABS = new Set<WorkforceTab>([
  "overview",
  "approvals",
  "organization",
  "reviews",
  "assets",
  "exit",
  "policies",
]);

export function resolveWorkforceTab(
  requestedTab: string | null,
  canApproveProfiles: boolean,
): WorkforceTab {
  if (!requestedTab || !WORKFORCE_TABS.has(requestedTab as WorkforceTab)) {
    return "overview";
  }
  if (requestedTab === "approvals" && !canApproveProfiles) {
    return "overview";
  }
  return requestedTab as WorkforceTab;
}

export function workforceTabUrl(
  pathname: string,
  currentQuery: string,
  nextTab: WorkforceTab,
): string {
  const next = new URLSearchParams(currentQuery);
  if (nextTab === "overview") next.delete("tab");
  else next.set("tab", nextTab);

  // Reviews owns this parameter only while its parent Workforce tab is active.
  if (nextTab !== "reviews") next.delete("reviewTab");

  return `${pathname}${next.size ? `?${next.toString()}` : ""}`;
}
