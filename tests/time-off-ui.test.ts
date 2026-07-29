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
    expect(approval).not.toContain("balance-search\"");
    expect(approval).toContain("All reporting employees");
    expect(approval).toContain("All leave types");
    expect(approval).toContain("searchBalances");
    expect(approval).toContain("then click Search to view balances");
    expect(approval).toContain("filteredBalances");
  });

  it("shows service as years and months, parental eligibility, and the full holiday year", () => {
    const dashboard = source("src/components/time-off/TimeOffDashboard.tsx");
    expect(dashboard).toContain("formatService");
    expect(dashboard).toContain("parental_leave_eligible");
    expect(dashboard).toContain("holidays.map");
    expect(dashboard).not.toContain("holidays.slice(0, 6)");
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

  it("limits Time Off administration to Super Admin and Finance Admin", () => {
    const workspace = source("src/components/time-off/TimeOffWorkspace.tsx");
    expect(workspace).toContain('const canAdminister = ["super admin", "finance admin"].includes(role)');
    expect(workspace).toContain("canAdminister ? [[\"admin\", \"Administration\"");
    expect(workspace).toContain('tab === "admin" && canAdminister');
  });

  it("filters gender-specific leave types in the request form", () => {
    const request = source("src/components/time-off/RequestLeaveDialog.tsx");
    expect(request).toContain("employeeGender");
    expect(request).toContain("eligibleLeaveTypes");
    expect(request).toContain("gender_eligibility");
    expect(request).toContain('eligibility === "all" || eligibility === gender');
  });

  it("requires a balance search and exports the applied result set", () => {
    const administration = source("src/components/time-off/TimeOffAdmin.tsx");
    const exports = source("src/components/time-off/TimeOffBalanceExportButtons.tsx");
    expect(administration).toContain("All active employees");
    expect(administration).toContain("All leave types");
    expect(administration).toContain("click Search to view employee leave balances");
    expect(administration).toContain("TimeOffBalanceExportButtons rows={filteredBalances}");
    expect(exports).toContain(">CSV<");
    expect(exports).toContain(">Excel<");
    expect(exports).toContain(">PDF<");
  });

  it("uses active employees and includes the current year in year-end review", () => {
    const administration = source("src/components/time-off/TimeOffAdmin.tsx");
    expect(administration).toContain('data.employees.filter((employee) => employee.status === "active")');
    expect(administration).toContain("const [year, setYear] = useState(currentYear)");
    expect(administration).toContain('id="review-year"');
  });

  it("orders employee dropdowns by code and separates result columns", () => {
    const approvals = source("src/components/time-off/ApprovalCentre.tsx");
    const administration = source("src/components/time-off/TimeOffAdmin.tsx");
    const calendar = source("src/components/time-off/LeaveCalendar.tsx");
    const exports = source("src/components/time-off/TimeOffBalanceExportButtons.tsx");
    for (const content of [approvals, administration, calendar]) {
      expect(content).toContain("compareEmployeeCodes");
      expect(content).toContain("employeeOptionLabel");
    }
    for (const content of [approvals, administration, exports]) {
      expect(content).toContain("Employee Code");
      expect(content).toContain("Employee Name");
    }
  });
});
