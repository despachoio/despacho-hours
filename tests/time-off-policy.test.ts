import { describe, expect, it } from "vitest";
import {
  addCalendarMonths,
  calculateLeaveDuration,
  completedServiceMonths,
  encashableLeaveDays,
  contractorPolicyStage,
  employeeAnnualLopReference,
  employeeLopSalaryMultiplier,
  employeePaidEntitlement,
  expectedCapacityHours,
  extendedPlannedLeaveEligibility,
  firstAnniversary,
  lopSalaryDeductionDays,
  maternityExpectedEndDate,
  maternityEligibility,
  monthlyPaidLeaveApplicationLimit,
  paidEntitlement,
  policyTier,
  paternityEligibility,
  remainingAnnualUnplannedLeave,
} from "@/lib/time-off/policy";

describe("Time Off policy engine", () => {
  it("accrues one day per completed first-year service month", () => {
    expect(paidEntitlement("2026-01-15", "2026-04-15")).toBe(3);
  });

  it("does not accrue an incomplete month", () => {
    expect(paidEntitlement("2026-01-15", "2026-04-14")).toBe(2);
  });

  it("switches to 12 days on the first anniversary without double credit", () => {
    expect(firstAnniversary("2025-07-29")).toBe("2026-07-29");
    expect(policyTier("2025-07-29", "2026-07-28")).toBe("first_year");
    expect(paidEntitlement("2025-07-29", "2026-07-29")).toBe(12);
  });

  it("resets first-year accrual at the calendar-year boundary", () => {
    expect(paidEntitlement("2025-10-10", "2025-12-10")).toBe(2);
    expect(paidEntitlement("2025-10-10", "2026-01-10")).toBe(1);
  });

  it("calculates full and half days", () => {
    expect(calculateLeaveDuration({ startDate: "2026-07-29", endDate: "2026-07-29" }).workingDays).toBe(1);
    expect(calculateLeaveDuration({ startDate: "2026-07-29", endDate: "2026-07-29", startPart: "first_half" }).workingDays).toBe(0.5);
  });

  it("allows valid multi-day boundary halves", () => {
    expect(calculateLeaveDuration({
      startDate: "2026-07-29",
      endDate: "2026-07-30",
      startPart: "second_half",
      endPart: "first_half",
    }).workingDays).toBe(1);
  });

  it("rejects invalid multi-day boundary halves", () => {
    expect(() => calculateLeaveDuration({
      startDate: "2026-07-29",
      endDate: "2026-07-30",
      startPart: "first_half",
    })).toThrow(/cannot start/i);
  });

  it("excludes Saturday and Sunday", () => {
    const duration = calculateLeaveDuration({
      startDate: "2026-07-31",
      endDate: "2026-08-03",
    });
    expect(duration.calendarSpanDays).toBe(4);
    expect(duration.workingDays).toBe(2);
    expect(duration.weeklyOffsExcluded).toBe(2);
  });

  it("excludes full and partial holidays", () => {
    const holidays = new Map([
      ["2026-07-29", "full_day"],
      ["2026-07-30", "first_half"],
    ] as const);
    const duration = calculateLeaveDuration({
      startDate: "2026-07-29",
      endDate: "2026-07-30",
      holidays,
    });
    expect(duration.workingDays).toBe(0.5);
    expect(duration.holidaysExcluded).toBe(1.5);
  });

  it("counts maternity leave as calendar time", () => {
    expect(maternityExpectedEndDate("2026-01-31")).toBe("2026-07-30");
    expect(addCalendarMonths("2024-02-29", 12)).toBe("2025-02-28");
  });

  it("applies the 1.5 LOP payroll multiplier", () => {
    expect(lopSalaryDeductionDays(2)).toBe(3);
    expect(lopSalaryDeductionDays(0.5)).toBe(0.75);
  });

  it("blocks contractor paid entitlement during the first six completed months", () => {
    expect(contractorPolicyStage("Contractor", "2026-01-15", "2026-07-14")).toBe("waiting_period");
    expect(employeePaidEntitlement("Contractor", "2026-01-15", "2026-07-14")).toBe(0);
  });

  it("accrues contractor paid leave monthly from six months until the first anniversary", () => {
    expect(contractorPolicyStage("Contractor", "2026-01-15", "2026-07-15")).toBe("first_year");
    expect(employeePaidEntitlement("Contractor", "2026-01-15", "2026-07-15")).toBe(1);
    expect(employeePaidEntitlement("Contractor", "2026-01-15", "2026-11-15")).toBe(5);
  });

  it("moves contractors to the standard entitlement after one year", () => {
    expect(contractorPolicyStage("Contractor", "2025-07-29", "2026-07-29")).toBe("standard");
    expect(employeePaidEntitlement("Contractor", "2025-07-29", "2026-07-29")).toBe(12);
  });

  it("uses unlimited 1x LOP before six months and the standard rule afterwards", () => {
    expect(employeeAnnualLopReference("Contractor", "2026-01-15", "2026-07-14")).toBeNull();
    expect(employeeLopSalaryMultiplier("Contractor", "2026-01-15", "2026-07-14")).toBe(1);
    expect(employeeAnnualLopReference("Contractor", "2026-01-15", "2026-07-15")).toBe(3);
    expect(employeeLopSalaryMultiplier("Contractor", "2026-01-15", "2026-07-15")).toBe(1.5);
  });

  it("leaves the standard employee policy unchanged", () => {
    expect(contractorPolicyStage("Employee", "2026-01-15", "2026-07-15")).toBeNull();
    expect(employeePaidEntitlement("Employee", "2026-01-15", "2026-07-15")).toBe(6);
    expect(employeeAnnualLopReference("Employee", "2026-01-15", "2026-07-15")).toBe(3);
  });

  it("uses actual LOP days 1:1 for encashment and never goes negative", () => {
    expect(encashableLeaveDays(8, 2)).toBe(6);
    expect(encashableLeaveDays(1, 2)).toBe(0);
  });

  it("handles service month calculations around month ends", () => {
    expect(completedServiceMonths("2026-01-31", "2026-02-28")).toBe(0);
    expect(completedServiceMonths("2026-01-31", "2026-03-31")).toBe(2);
  });

  it("removes approved leave and holidays from expected capacity", () => {
    expect(expectedCapacityHours({
      startDate: "2026-07-27",
      endDate: "2026-07-31",
      holidayParts: new Map([["2026-07-29", new Set(["first_half", "second_half"])]]),
      approvedLeaveParts: new Map([["2026-07-30", new Set(["first_half"])]]),
    })).toBe(28);
  });

  it("does not double-subtract leave that falls on a holiday", () => {
    expect(expectedCapacityHours({
      startDate: "2026-07-29",
      endDate: "2026-07-29",
      holidayParts: new Map([["2026-07-29", new Set(["first_half"])]]),
      approvedLeaveParts: new Map([["2026-07-29", new Set(["first_half", "second_half"])]]),
    })).toBe(0);
  });

  it("combines complementary holiday and leave halves into zero capacity", () => {
    expect(expectedCapacityHours({
      startDate: "2026-07-29",
      endDate: "2026-07-29",
      holidayParts: new Map([["2026-07-29", new Set(["first_half"])]]),
      approvedLeaveParts: new Map([["2026-07-29", new Set(["second_half"])]]),
    })).toBe(0);
  });

  it("permits one paid-leave application per month in the first year", () => {
    expect(monthlyPaidLeaveApplicationLimit("2026-01-15", "2026-12-15")).toBe(1);
  });

  it("permits two paid-leave applications after the first year", () => {
    expect(monthlyPaidLeaveApplicationLimit("2025-01-15", "2026-01-15")).toBe(2);
  });

  it("reserves pending Unplanned Leave against the six-day limit", () => {
    expect(remainingAnnualUnplannedLeave(4, 1.5)).toBe(0.5);
  });

  it("releases rejected or cancelled Unplanned Leave when not supplied as pending", () => {
    expect(remainingAnnualUnplannedLeave(4)).toBe(2);
  });

  it("checks maternity gender and two-year service eligibility", () => {
    expect(maternityEligibility("Female", 24)).toBe(true);
    expect(maternityEligibility("Male", 30)).toBe(false);
    expect(maternityEligibility("Female", 23)).toBe(false);
  });

  it("checks paternity gender and two-year service eligibility", () => {
    expect(paternityEligibility("Male", 24)).toBe(true);
    expect(paternityEligibility("Female", 30)).toBe(false);
    expect(paternityEligibility("Male", 23)).toBe(false);
  });

  it("allows a valid extended planned-leave exception", () => {
    expect(extendedPlannedLeaveEligibility({ completedMonths: 24, alreadyUsed: false, disqualifyingLop: false, workingDays: 5, calendarSpanDays: 9 }).eligible).toBe(true);
  });

  it("allows the extended exception only once", () => {
    expect(extendedPlannedLeaveEligibility({ completedMonths: 24, alreadyUsed: true, disqualifyingLop: false, workingDays: 5, calendarSpanDays: 9 }).eligible).toBe(false);
  });

  it("enforces five working days for the extended exception", () => {
    expect(extendedPlannedLeaveEligibility({ completedMonths: 24, alreadyUsed: false, disqualifyingLop: false, workingDays: 5.5, calendarSpanDays: 8 }).reason).toMatch(/five/i);
  });

  it("enforces nine calendar days for the extended exception", () => {
    expect(extendedPlannedLeaveEligibility({ completedMonths: 24, alreadyUsed: false, disqualifyingLop: false, workingDays: 5, calendarSpanDays: 10 }).reason).toMatch(/nine/i);
  });

  it("blocks the extended exception after qualifying LOP", () => {
    expect(extendedPlannedLeaveEligibility({ completedMonths: 24, alreadyUsed: false, disqualifyingLop: true, workingDays: 5, calendarSpanDays: 9 }).eligible).toBe(false);
  });

  it("calculates cross-month requests per date without timezone shifts", () => {
    const duration = calculateLeaveDuration({ startDate: "2026-01-30", endDate: "2026-02-02" });
    expect(duration.calendarSpanDays).toBe(4);
    expect(duration.workingDays).toBe(2);
  });

  it("calculates cross-year requests without timezone shifts", () => {
    const duration = calculateLeaveDuration({ startDate: "2026-12-31", endDate: "2027-01-04" });
    expect(duration.calendarSpanDays).toBe(5);
    expect(duration.workingDays).toBe(3);
  });

  it("supports complementary half-day calculations", () => {
    expect(calculateLeaveDuration({ startDate: "2026-07-29", endDate: "2026-07-29", startPart: "first_half" }).workingDays).toBe(0.5);
    expect(calculateLeaveDuration({ startDate: "2026-07-29", endDate: "2026-07-29", startPart: "second_half" }).workingDays).toBe(0.5);
  });
});
