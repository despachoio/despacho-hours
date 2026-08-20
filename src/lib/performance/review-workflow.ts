import { hasSuperAdminAccess } from "@/lib/roles";
import type { PerformanceReviewStatus } from "./types";

export const RESETTABLE_REVIEW_STATUSES: ReadonlySet<PerformanceReviewStatus> =
  new Set(["under_review", "reopened"]);

export function canResetAnnualReview(
  role: unknown,
  status: PerformanceReviewStatus | null | undefined,
) {
  return Boolean(status && hasSuperAdminAccess(role) && RESETTABLE_REVIEW_STATUSES.has(status));
}
