export const BUSINESS_TIME_ZONE = "Asia/Kolkata";

export type DateRange = { from: string; to: string };

export function businessDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export const dateKey = businessDateKey;

export function addDateKeyDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dateRange(
  preset: string,
  customFrom = "",
  customTo = "",
  today = businessDateKey(),
): DateRange {
  if (preset === "custom") return { from: customFrom, to: customTo };

  const current = new Date(`${today}T00:00:00Z`);
  const day = current.getUTCDay();
  let from = today;
  let to = today;

  if (preset === "yesterday") {
    from = addDateKeyDays(today, -1);
    to = from;
  } else if (preset === "this_week" || preset === "last_week") {
    const mondayOffset = -((day + 6) % 7) - (preset === "last_week" ? 7 : 0);
    from = addDateKeyDays(today, mondayOffset);
    to = addDateKeyDays(from, 6);
  } else if (preset === "this_month" || preset === "last_month") {
    const monthOffset = preset === "last_month" ? -1 : 0;
    const start = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + monthOffset, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    from = start.toISOString().slice(0, 10);
    to = end.toISOString().slice(0, 10);
  } else if (preset === "this_quarter" || preset === "last_quarter") {
    const quarterStart = Math.floor(current.getUTCMonth() / 3) * 3;
    const month = quarterStart - (preset === "last_quarter" ? 3 : 0);
    const start = new Date(Date.UTC(current.getUTCFullYear(), month, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0));
    from = start.toISOString().slice(0, 10);
    to = end.toISOString().slice(0, 10);
  }

  return { from, to };
}

export function weekdays(from: string, to: string) {
  if (!from || !to || from > to) return 0;
  let current = from;
  let count = 0;
  while (current <= to) {
    const day = new Date(`${current}T00:00:00Z`).getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    current = addDateKeyDays(current, 1);
  }
  return count;
}

export function currentBusinessYear() {
  return Number(businessDateKey().slice(0, 4));
}
