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
    expect(dashboard).toContain("[...holidays]");
    expect(dashboard).not.toContain("holidays.slice(0, 6)");
  });

  it("provides request filters, pagination, cancellation, and export", () => {
    const requests = source("src/components/time-off/MyLeaveRequests.tsx");
    expect(requests).not.toContain("Search leave requests");
    expect(requests).not.toContain("Search requests\"");
    expect(requests).toContain("searchRequests");
    expect(requests).toContain("appliedType");
    expect(requests.indexOf(">Search<")).toBeLessThan(requests.indexOf(">Reset<"));
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
    const exports = source("src/components/time-off/TimeOffBalanceExportButtons.tsx");
    for (const content of [approvals, administration]) {
      expect(content).toContain("compareEmployeeCodes");
      expect(content).toContain("employeeOptionLabel");
    }
    for (const content of [approvals, administration, exports]) {
      expect(content).toContain("Employee Code");
      expect(content).toContain("Employee Name");
    }
  });

  it("shows the next holiday name and date on separate lines", () => {
    const dashboard = source("src/components/time-off/TimeOffDashboard.tsx");
    expect(dashboard).toContain('dashboard.next_holiday.name}</span>');
    expect(dashboard).toContain('formatDate(dashboard.next_holiday.date)}</span>');
  });

  it("shows holidays as a chronological premium list and highlights the next holiday", () => {
    const dashboard = source("src/components/time-off/TimeOffDashboard.tsx");
    expect(dashboard).toContain("formatWeekday");
    expect(dashboard).toContain("Next holiday");
    expect(dashboard).toContain("left.holiday_date.localeCompare(right.holiday_date)");
    expect(dashboard).not.toContain("TimeOffIcon");
  });

  it("keeps the Time Off hero header free of a decorative icon", () => {
    const workspace = source("src/components/time-off/TimeOffWorkspace.tsx");
    expect(workspace).not.toContain('name="calendar" className="h-7 w-7 text-cyan-200"');
  });

  it("keeps hero actions out of the header and loads the current leave year", () => {
    const workspace = source("src/components/time-off/TimeOffWorkspace.tsx");
    expect(workspace).toContain("const year = currentYear");
    expect(workspace).not.toContain('aria-label="Leave year"');
    expect(workspace).not.toContain("+ Request Leave");
  });

  it("uses only checkboxes to filter the leave calendar", () => {
    const calendar = source("src/components/time-off/LeaveCalendar.tsx");
    expect(calendar).toContain("My Leave");
    expect(calendar).toContain("Team Leave");
    expect(calendar).not.toContain("Filter calendar by leave type");
    expect(calendar).not.toContain("Filter calendar by department");
    expect(calendar).not.toContain("Filter calendar by manager");
    expect(calendar).not.toContain("Filter calendar by employee");
  });

  it("uses premium colour treatments across the overview and leave calendar", () => {
    const dashboard = source("src/components/time-off/TimeOffDashboard.tsx");
    const calendar = source("src/components/time-off/LeaveCalendar.tsx");
    expect(dashboard).toContain("from-white via-slate-50/90 to-blue-50/90");
    expect(dashboard).toContain("from-[#153E90] via-blue-500 to-cyan-400");
    expect(dashboard).toContain("from-emerald-50 via-white to-teal-50/70");
    expect(dashboard).toContain("from-sky-50 via-white to-blue-50/70");
    expect(calendar).toContain("from-slate-950 via-indigo-950 to-blue-950");
    expect(calendar).toContain("calendarCellTones[index % 7]");
    expect(calendar).toContain("weekdayTones[index]");
    expect(calendar).toContain("Today");
    expect(calendar).toContain("Company holiday");
    expect(calendar).toContain("Colours reflect each leave type.");
  });

  it("shares the premium card treatment across requests, approvals, and administration", () => {
    for (const file of [
      "src/components/time-off/MyLeaveRequests.tsx",
      "src/components/time-off/ApprovalCentre.tsx",
      "src/components/time-off/TimeOffAdmin.tsx",
    ]) expect(source(file)).toContain('KairoCard from "./TimeOffPremiumCard"');
    const premiumCard = source("src/components/time-off/TimeOffPremiumCard.tsx");
    expect(premiumCard).toContain("from-blue-700");
    expect(premiumCard).toContain("[&_tbody_tr:hover]:bg-blue-50/55");
  });

  it("provides an applied-filter reporting employee request search before balances", () => {
    const workspace = source("src/components/time-off/TimeOffWorkspace.tsx");
    const approval = source("src/components/time-off/ApprovalCentre.tsx");
    const client = source("src/lib/time-off/client.ts");
    expect(client).toContain("managedRequests");
    expect(workspace).toContain("managedRequests={data.managedRequests}");
    expect(approval).toContain("Reporting Employee Requests");
    expect(approval).toContain("ManagedRequestSearch");
    expect(approval).toContain("requests={managedRequests} balances={balances}");
    expect(approval).toContain("...balances.map");
    expect(approval).toContain("Awaiting search");
    expect(approval.indexOf("<ManagedRequestSearch")).toBeLessThan(approval.indexOf("Direct-Report Balances"));
  });

  it("uses the premium icon system across role-specific Time Off surfaces", () => {
    for (const file of [
      "src/components/time-off/TimeOffWorkspace.tsx",
      "src/components/time-off/MyLeaveRequests.tsx",
      "src/components/time-off/ApprovalCentre.tsx",
      "src/components/time-off/LeaveCalendar.tsx",
      "src/components/time-off/TimeOffAdmin.tsx",
      "src/components/time-off/RequestLeaveDialog.tsx",
    ]) expect(source(file)).toContain("TimeOffIcon");
  });
});
