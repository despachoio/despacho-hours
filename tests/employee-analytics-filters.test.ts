import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { dateRange } from "@/lib/metrics/date-ranges";
import { buildEmployeeAnalyticsCsv } from "@/lib/employee-analytics-export";

const root = process.cwd();
const page = readFileSync(resolve(root, "src/app/(app)/team/[id]/page.tsx"), "utf8");
const filter = readFileSync(
  resolve(root, "src/components/team/EmployeePeriodFilter.tsx"),
  "utf8",
);

describe("Employee Analytics date presets", () => {
  const today = "2026-08-25";
  it("resolves Today", () =>
    expect(dateRange("today", "", "", today)).toEqual({ from: today, to: today }));
  it("resolves Yesterday", () =>
    expect(dateRange("yesterday", "", "", today)).toEqual({
      from: "2026-08-24",
      to: "2026-08-24",
    }));
  it("resolves This Week", () =>
    expect(dateRange("this_week", "", "", today)).toEqual({
      from: "2026-08-24",
      to: "2026-08-30",
    }));
  it("resolves Last Week", () =>
    expect(dateRange("last_week", "", "", today)).toEqual({
      from: "2026-08-17",
      to: "2026-08-23",
    }));
  it("resolves This Month", () =>
    expect(dateRange("this_month", "", "", today)).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    }));
  it("resolves Last Month", () =>
    expect(dateRange("last_month", "", "", today)).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
    }));
  it("resolves This Quarter", () =>
    expect(dateRange("this_quarter", "", "", today)).toEqual({
      from: "2026-07-01",
      to: "2026-09-30",
    }));
  it("resolves Last Quarter", () =>
    expect(dateRange("last_quarter", "", "", today)).toEqual({
      from: "2026-04-01",
      to: "2026-06-30",
    }));
});

describe("Employee Analytics filter workflow", () => {
  it("uses and applies This Week by default", () => {
    expect(page).toContain('period: "this_week"');
    expect(page).toContain("appliedAnalyticsFilters.period");
    expect(page).toContain("dateRange(");
  });
  it("shows custom dates only for Custom Range", () => {
    expect(filter).toContain('const custom = value.period === "custom"');
    expect(filter).toContain('aria-label="From Date"');
    expect(filter).toContain('aria-label="To Date"');
    expect(filter).toContain("{custom ? (");
  });
  it("blocks missing and reversed custom ranges", () => {
    expect(page).toContain("Select both From Date and To Date.");
    expect(page).toContain("From Date cannot be later than To Date.");
    expect(page).toContain("analyticsFilters.customFrom > analyticsFilters.customTo");
  });
  it("reset restores This Week and clears all dependent filters", () => {
    expect(page).toContain("resetAnalyticsSearch");
    expect(page).toContain("setAnalyticsFilters(defaults)");
    expect(page).toContain("setAppliedAnalyticsFilters(defaults)");
    expect(page).toContain('clientId: ""');
    expect(page).toContain('projectId: ""');
  });
  it("keeps client and project filtering dependent and applies both", () => {
    expect(filter).toContain('projectId: ""');
    expect(page).toContain("entry.projects?.clients?.id === appliedAnalyticsFilters.clientId");
    expect(page).toContain("entry.project_id === appliedAnalyticsFilters.projectId");
  });
  it("uses filtered entries for KPIs, timeline, summaries, and charts", () => {
    expect(page).toContain("employeeAnalytics(member, filteredEntries");
    expect(page).toContain("<EmployeeTimeline entries={filteredEntries}");
    expect(page).toContain("<ProjectSummary entries={filteredEntries}");
    expect(page).toContain("<ClientSummary entries={filteredEntries}");
    expect(page).toContain("entries={filteredEntries}");
  });
  it("exports only the applied resolved period", () => {
    expect(page).toContain("periodLabel: appliedPeriodLabel");
    expect(page).toContain("from: range.from");
    expect(page).toContain("to: range.to");
    expect(page).toContain("entries: filteredEntries");
    expect(filter).toContain("Download CSV");
    expect(filter).toContain("Download PDF");
  });
  it("renders an applied-filter context line", () => {
    expect(page).toContain("{appliedPeriodLabel} · {formatDate(range.from)}");
    expect(page).toContain("{appliedClientLabel}");
    expect(page).toContain("{appliedProjectLabel}");
  });
});

describe("Employee Analytics CSV", () => {
  it("includes the human-readable and resolved period", () => {
    const csv = buildEmployeeAnalyticsCsv({
      employeeName: "Aarthi J",
      employeeCode: "10007",
      periodLabel: "Custom Range",
      from: "2026-08-01",
      to: "2026-08-15",
      clientLabel: "RapidSoS",
      projectLabel: "Adhoc Task",
      analytics: {
        employee: {} as never,
        entries: [],
        timer: null,
        hours: 0,
        expectedHours: 80,
        utilisation: 0,
        billableHours: 0,
        nonBillableHours: 0,
        billableUtilisation: 0,
        nonBillableUtilisation: 0,
        projects: 0,
        clients: 0,
        averageDailyHours: 0,
        averageSession: 0,
        longestSession: 0,
        status: "offline",
      },
      entries: [],
    });
    expect(csv).toContain('"Period","Custom Range"');
    expect(csv).toContain('"Resolved Range","2026-08-01 to 2026-08-15"');
    expect(csv).toContain('"Client","RapidSoS"');
    expect(csv).toContain('"Project","Adhoc Task"');
  });
});
