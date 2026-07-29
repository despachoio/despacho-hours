import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("Time Off UI contract", () => {
  it("offers full-day and both half-day choices", () => {
    const request = source("src/components/time-off/RequestLeaveDialog.tsx");
    expect(request).toContain("Full Day");
    expect(request).toContain("First Half");
    expect(request).toContain("Second Half");
  });

  it("shows blocking, warning, and informational policy messages", () => {
    const request = source("src/components/time-off/RequestLeaveDialog.tsx");
    expect(request).toContain("blocking_errors");
    expect(request).toContain("warnings");
    expect(request).toContain("informational_messages");
  });

  it("requires comments for rejection paths", () => {
    const approval = source("src/components/time-off/ApprovalCentre.tsx");
    expect(approval).toContain("A rejection comment is required");
  });

  it("provides searchable direct-report balance filters", () => {
    const approval = source("src/components/time-off/ApprovalCentre.tsx");
    expect(approval).toContain("balance-search");
    expect(approval).toContain("All reporting employees");
    expect(approval).toContain("All leave types");
    expect(approval).toContain("filteredBalances");
  });

  it("provides request filters, pagination, cancellation, and export", () => {
    const requests = source("src/components/time-off/MyLeaveRequests.tsx");
    expect(requests).toContain("Export CSV");
    expect(requests).toContain("Previous");
    expect(requests).toContain("Request Cancellation");
  });

  it("provides calendar privacy filters and administration confirmations", () => {
    expect(source("src/components/time-off/LeaveCalendar.tsx")).toContain("Team Leave");
    expect(source("src/components/time-off/TimeOffAdmin.tsx")).toContain("Confirm Year Closure");
  });
});
