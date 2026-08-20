export const EXIT_NOTICE_POLICY = {
  employee: { initialTerm: 30, followingInitialTerm: 60 },
  company: { initialTerm: 5, followingInitialTerm: 5 },
} as const;

export type ExitSource = keyof typeof EXIT_NOTICE_POLICY;
export type NoticeTerm = "initialTerm" | "followingInitialTerm";
export type NoticeDayBasis = "calendar" | "working";

export function noticeDays(source: ExitSource, term: NoticeTerm) {
  return EXIT_NOTICE_POLICY[source][term];
}

export function calculateExpectedLastWorkingDate(
  startDate: string,
  days: number,
  basis: NoticeDayBasis,
) {
  const date = new Date(`${startDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  let remaining = Math.max(0, Math.floor(days));
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    if (basis === "calendar" || (date.getDay() !== 0 && date.getDay() !== 6)) {
      remaining -= 1;
    }
  }
  return date.toISOString().slice(0, 10);
}

export const EXIT_CLEARANCE_TYPES = [
  "manager",
  "project",
  "asset",
  "it",
  "hr",
  "finance",
  "payroll",
] as const;

