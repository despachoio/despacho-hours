import type {
  AggregateRow,
  ChartDatum,
  DailyDatum,
  ReportEntry,
} from "./types";

export function dateKey(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function dateRange(preset: string, customFrom = "", customTo = "") {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  const end = new Date(today);
  if (preset === "custom") return { from: customFrom, to: customTo };
  if (preset === "yesterday") {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (["this_week", "last_week"].includes(preset)) {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    if (preset === "last_week") start.setDate(start.getDate() - 7);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 6);
  } else if (["this_month", "last_month"].includes(preset)) {
    start.setDate(1);
    if (preset === "last_month") start.setMonth(start.getMonth() - 1);
    end.setTime(start.getTime());
    end.setMonth(end.getMonth() + 1, 0);
  } else if (["this_quarter", "last_quarter"].includes(preset)) {
    const quarterStart = Math.floor(start.getMonth() / 3) * 3;
    start.setMonth(quarterStart, 1);
    if (preset === "last_quarter") start.setMonth(start.getMonth() - 3);
    end.setTime(start.getTime());
    end.setMonth(end.getMonth() + 3, 0);
  }
  return { from: dateKey(start), to: dateKey(end) };
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

export function formatTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function timerSeconds(
  timer: {
    started_at: string;
    paused_at: string | null;
    total_paused_seconds: number;
    status: string;
  },
  now = Date.now(),
) {
  const end =
    timer.status === "paused" && timer.paused_at
      ? new Date(timer.paused_at).getTime()
      : now;
  return Math.max(
    Math.floor((end - new Date(timer.started_at).getTime()) / 1000) -
      Number(timer.total_paused_seconds || 0),
    0,
  );
}

export function formatDuration(seconds: number) {
  return [
    Math.floor(seconds / 3600),
    Math.floor((seconds % 3600) / 60),
    seconds % 60,
  ]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function weekdays(from: string, to: string) {
  if (!from || !to || from > to) return 0;
  const current = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  let count = 0;
  while (current <= end) {
    const day = current.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return count;
}

export function aggregateEntries(
  entries: ReportEntry[],
  expectedHoursPerEmployee: number,
) {
  const groups = new Map<string, ReportEntry[]>();
  for (const entry of entries) {
    const key = `${entry.employee_id}:${entry.project_id}`;
    groups.set(key, [...(groups.get(key) || []), entry]);
  }
  return Array.from(groups.entries()).map(([id, sourceEntries]) => {
    const first = sourceEntries[0];
    const totalHours = sourceEntries.reduce(
      (sum, entry) => sum + Number(entry.hours || 0),
      0,
    );
    const longestSession = Math.max(
      0,
      ...sourceEntries.map((entry) => Number(entry.hours || 0)),
    );
    return {
      id,
      employeeId: first.employee_id,
      employeeName: first.employees?.name || "Unknown employee",
      clientId: first.projects?.clients?.id || "",
      clientName: first.projects?.clients?.name || "Unassigned client",
      projectId: first.project_id,
      projectName: first.projects?.name || "Unassigned project",
      projectCode: first.projects?.project_code || null,
      totalHours,
      entries: sourceEntries.length,
      averageSession: sourceEntries.length
        ? totalHours / sourceEntries.length
        : 0,
      longestSession,
      utilisation: expectedHoursPerEmployee
        ? (totalHours / expectedHoursPerEmployee) * 100
        : 0,
      sourceEntries: [...sourceEntries].sort((a, b) =>
        a.entry_date === b.entry_date
          ? String(a.started_at).localeCompare(String(b.started_at))
          : b.entry_date.localeCompare(a.entry_date),
      ),
    } satisfies AggregateRow;
  });
}

export function groupedHours(
  entries: ReportEntry[],
  field: "employee" | "client" | "project",
) {
  const groups = new Map<string, number>();
  for (const entry of entries) {
    const name =
      field === "employee"
        ? entry.employees?.name
        : field === "client"
          ? entry.projects?.clients?.name
          : entry.projects?.project_code
            ? `[${entry.projects.project_code}] ${entry.projects.name}`
            : entry.projects?.name;
    if (name)
      groups.set(name, (groups.get(name) || 0) + Number(entry.hours || 0));
  }
  return Array.from(groups, ([name, hours]) => ({ name, hours }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 10) satisfies ChartDatum[];
}

export function dailyHours(entries: ReportEntry[], from: string, to: string) {
  const totals = new Map<string, number>();
  for (const entry of entries)
    totals.set(
      entry.entry_date,
      (totals.get(entry.entry_date) || 0) + Number(entry.hours || 0),
    );
  if (!from || !to) return [];
  const rows: DailyDatum[] = [];
  const current = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (current <= end) {
    const key = current.toISOString().slice(0, 10);
    rows.push({ date: key, hours: totals.get(key) || 0 });
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return rows;
}

export function comparison(current: number, previous: number, label: string) {
  if (previous <= 0) return undefined;
  const percentage = ((current - previous) / previous) * 100;
  return {
    text: `${percentage >= 0 ? "▲" : "▼"} ${Math.abs(percentage).toFixed(0)}% ${label}`,
    tone:
      percentage > 0
        ? ("positive" as const)
        : percentage < 0
          ? ("negative" as const)
          : ("neutral" as const),
  };
}
