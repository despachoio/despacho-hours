import { dateRange } from "@/lib/metrics/date-ranges";
import {
  employeeAnalytics,
  employeeStatus,
} from "@/lib/metrics/team-metrics";
import type {
  EmployeeAnalytics,
  TeamTimer,
} from "./types";

export { dateRange, employeeAnalytics, employeeStatus };

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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
