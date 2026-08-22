import { businessDateKey } from "@/lib/metrics/date-ranges";

export type TimerWithWorkDate = {
  started_at: string;
  work_date?: string | null;
};

/**
 * Returns the immutable work date assigned when the timer started.
 *
 * The started_at fallback supports clients during the short deployment window
 * before the work_date database migration has reached every environment. It is
 * deliberately derived in Kairo's business timezone, never from stop time or
 * the browser's local timezone.
 */
export function getTimerWorkDate(timer: TimerWithWorkDate) {
  if (timer.work_date) return timer.work_date;
  return businessDateKey(new Date(timer.started_at));
}
