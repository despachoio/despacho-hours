import type { ExitCase, ExitStatus } from "@/lib/exit-process/types";

export type ExitStatusFilter = "active" | "all" | ExitStatus;

export function exitMatchesStatus(status: ExitStatus, filter: ExitStatusFilter) {
  if (filter === "all") return true;
  if (filter === "active") return status !== "completed" && status !== "cancelled";
  return status === filter;
}

export function selectVisibleExitId(
  cases: ExitCase[],
  filter: ExitStatusFilter,
  preferredId?: string,
) {
  const visibleCases = cases.filter((item) => exitMatchesStatus(item.status, filter));
  if (preferredId && visibleCases.some((item) => item.id === preferredId)) return preferredId;
  return visibleCases[0]?.id ?? "";
}
