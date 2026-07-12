import { dateRange, weekdays } from "@/components/reports/utils";
import type {
  EmployeeAnalytics,
  TeamEmployee,
  TeamEntry,
  TeamTimer,
} from "./types";

export { dateRange };

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function employeeStatus(
  employee: TeamEmployee,
  timer: TeamTimer | null,
): EmployeeAnalytics["status"] {
  if (
    ["on_leave", "leave"].includes(String(employee.status || "").toLowerCase())
  )
    return "on_leave";
  if (timer?.status === "running") return "working";
  if (timer?.status === "paused") return "paused";
  return "offline";
}

export function employeeAnalytics(
  employee: TeamEmployee,
  entries: TeamEntry[],
  timer: TeamTimer | null,
  from: string,
  to: string,
): EmployeeAnalytics {
  const hours = entries.reduce(
    (sum, entry) => sum + Number(entry.hours || 0),
    0,
  );
  const workdays = weekdays(from, to);
  const expectedHours = workdays * 8;
  return {
    employee,
    entries,
    timer,
    hours,
    expectedHours,
    utilisation: expectedHours ? (hours / expectedHours) * 100 : 0,
    projects: new Set(entries.map((entry) => entry.project_id)).size,
    clients: new Set(
      entries.map((entry) => entry.projects?.clients?.id).filter(Boolean),
    ).size,
    averageDailyHours: workdays ? hours / workdays : 0,
    averageSession: entries.length ? hours / entries.length : 0,
    longestSession: Math.max(
      0,
      ...entries.map((entry) => Number(entry.hours || 0)),
    ),
    status: employeeStatus(employee, timer),
  };
}

export const statusLabel = (status: EmployeeAnalytics["status"]) =>
  ({
    working: "Working",
    paused: "Paused",
    offline: "Offline",
    on_leave: "On Leave",
  })[status];

export function formatTimerDuration(timer: TeamTimer, now: number) {
  if (!now) return "00:00:00";
  const started = new Date(timer.started_at).getTime();
  const end =
    timer.status === "paused" && timer.paused_at
      ? new Date(timer.paused_at).getTime()
      : now;
  const seconds = Math.max(
    0,
    Math.floor((end - started) / 1000) - Number(timer.total_paused_seconds || 0),
  );
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}
