import type { DayPart, LeaveDuration, PolicyTier } from "./types";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function assertDateKey(value: string) {
  if (!DATE_KEY.test(value)) throw new Error("Expected a YYYY-MM-DD date.");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Expected a valid calendar date.");
  }
}

export function addDateDays(value: string, days: number) {
  assertDateKey(value);
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addCalendarMonths(value: string, months: number) {
  assertDateKey(value);
  const [year, month, day] = value.split("-").map(Number);
  const targetMonth = month - 1 + months;
  const first = new Date(Date.UTC(year, targetMonth, 1));
  const finalDay = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(
      first.getUTCFullYear(),
      first.getUTCMonth(),
      Math.min(day, finalDay),
    ),
  )
    .toISOString()
    .slice(0, 10);
}

export function completedServiceMonths(joiningDate: string, asOf: string) {
  assertDateKey(joiningDate);
  assertDateKey(asOf);
  if (asOf < joiningDate) return 0;
  const [joinYear, joinMonth, joinDay] = joiningDate.split("-").map(Number);
  const [year, month, day] = asOf.split("-").map(Number);
  let months = (year - joinYear) * 12 + month - joinMonth;
  if (day < joinDay) months -= 1;
  return Math.max(months, 0);
}

export function firstAnniversary(joiningDate: string) {
  return addCalendarMonths(joiningDate, 12);
}

export function policyTier(
  joiningDate: string,
  asOf: string,
): PolicyTier {
  return completedServiceMonths(joiningDate, asOf) >= 12
    ? "post_first_year"
    : "first_year";
}

export function paidEntitlement(joiningDate: string, asOf: string) {
  if (asOf < joiningDate) return 0;
  if (policyTier(joiningDate, asOf) === "post_first_year") return 12;
  const yearStart = `${asOf.slice(0, 4)}-01-01`;
  const beforeYear = addDateDays(yearStart, -1);
  return Math.min(
    12,
    Math.max(
      completedServiceMonths(joiningDate, asOf) -
        completedServiceMonths(joiningDate, beforeYear),
      0,
    ),
  );
}

export type ContractorPolicyStage = "waiting_period" | "first_year" | "standard";

export function contractorPolicyStage(
  employmentRole: string | null,
  joiningDate: string,
  asOf: string,
): ContractorPolicyStage | null {
  if (String(employmentRole || "").trim().toLowerCase() !== "contractor") return null;
  const months = completedServiceMonths(joiningDate, asOf);
  if (months < 6) return "waiting_period";
  return months < 12 ? "first_year" : "standard";
}

export function employeePaidEntitlement(
  employmentRole: string | null,
  joiningDate: string,
  asOf: string,
) {
  const stage = contractorPolicyStage(employmentRole, joiningDate, asOf);
  if (!stage || stage === "standard") return paidEntitlement(joiningDate, asOf);
  if (stage === "waiting_period") return 0;
  const beforeYear = addDateDays(`${asOf.slice(0, 4)}-01-01`, -1);
  const completed = completedServiceMonths(joiningDate, asOf);
  const completedBeforeYear = completedServiceMonths(joiningDate, beforeYear);
  return Math.min(12, Math.max(completed - Math.max(completedBeforeYear, 5), 0));
}

export function employeeLopSalaryMultiplier(
  employmentRole: string | null,
  joiningDate: string,
  asOf: string,
) {
  return contractorPolicyStage(employmentRole, joiningDate, asOf) === "waiting_period"
    ? 1
    : 1.5;
}

export function employeeAnnualLopReference(
  employmentRole: string | null,
  joiningDate: string,
  asOf: string,
) {
  return contractorPolicyStage(employmentRole, joiningDate, asOf) === "waiting_period"
    ? null
    : 3;
}

function partsForDate(
  date: string,
  startDate: string,
  endDate: string,
  startPart: DayPart,
  endPart: DayPart,
) {
  if (startDate === endDate) {
    if (startPart === "first_half") return ["first_half"] as const;
    if (startPart === "second_half") return ["second_half"] as const;
    return ["first_half", "second_half"] as const;
  }
  if (date === startDate) {
    return startPart === "second_half"
      ? (["second_half"] as const)
      : (["first_half", "second_half"] as const);
  }
  if (date === endDate) {
    return endPart === "first_half"
      ? (["first_half"] as const)
      : (["first_half", "second_half"] as const);
  }
  return ["first_half", "second_half"] as const;
}

export function calculateLeaveDuration({
  startDate,
  endDate,
  startPart = "full_day",
  endPart = "full_day",
  holidays = new Map<string, DayPart>(),
  excludeHolidays = true,
  excludeWeekends = true,
}: {
  startDate: string;
  endDate: string;
  startPart?: DayPart;
  endPart?: DayPart;
  holidays?: Map<string, DayPart>;
  excludeHolidays?: boolean;
  excludeWeekends?: boolean;
}): LeaveDuration {
  assertDateKey(startDate);
  assertDateKey(endDate);
  if (endDate < startDate) throw new Error("End date cannot be before start date.");
  if (startDate < endDate && startPart === "first_half") {
    throw new Error("A multi-day request cannot start with First Half.");
  }
  if (startDate < endDate && endPart === "second_half") {
    throw new Error("A multi-day request cannot end with Second Half.");
  }

  const days: LeaveDuration["days"] = [];
  let date = startDate;
  while (date <= endDate) {
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();
    const weeklyOff = day === 0 || day === 6;
    const holidayPart = holidays.get(date);
    for (const part of partsForDate(
      date,
      startDate,
      endDate,
      startPart,
      endPart,
    )) {
      const holiday =
        holidayPart === "full_day" || holidayPart === part;
      days.push({
        leaveDate: date,
        dayPart: part,
        duration: 0.5,
        isWorkingDay:
          !((excludeWeekends && weeklyOff) || (excludeHolidays && holiday)),
        isHoliday: holiday,
        isWeeklyOff: weeklyOff,
      });
    }
    date = addDateDays(date, 1);
  }

  return {
    requestedDays: days.length * 0.5,
    workingDays:
      days.filter((day) => day.isWorkingDay).length * 0.5,
    calendarSpanDays:
      Math.round(
        (Date.parse(`${endDate}T00:00:00Z`) -
          Date.parse(`${startDate}T00:00:00Z`)) /
          86_400_000,
      ) + 1,
    holidaysExcluded:
      days.filter(
        (day) => !day.isWorkingDay && excludeHolidays && day.isHoliday,
      ).length * 0.5,
    weeklyOffsExcluded:
      days.filter(
        (day) =>
          !day.isWorkingDay &&
          excludeWeekends &&
          day.isWeeklyOff &&
          !(excludeHolidays && day.isHoliday),
      ).length * 0.5,
    days,
  };
}

export function lopSalaryDeductionDays(lopDays: number) {
  return lopDays * 1.5;
}

export function encashableLeaveDays(
  remainingPaidLeaveDays: number,
  lopLeaveDays: number,
) {
  return Math.max(remainingPaidLeaveDays - lopLeaveDays, 0);
}

export function maternityExpectedEndDate(startDate: string) {
  return addDateDays(addCalendarMonths(startDate, 6), -1);
}

export function expectedCapacityHours({
  startDate,
  endDate,
  holidayParts = new Map<string, Set<string>>(),
  approvedLeaveParts = new Map<string, Set<string>>(),
  hoursPerDay = 8,
}: {
  startDate: string;
  endDate: string;
  holidayParts?: Map<string, Set<string>>;
  approvedLeaveParts?: Map<string, Set<string>>;
  hoursPerDay?: number;
}) {
  assertDateKey(startDate);
  assertDateKey(endDate);
  if (endDate < startDate) return 0;
  let capacityDays = 0;
  for (let date = startDate; date <= endDate; date = addDateDays(date, 1)) {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const unavailableParts = new Set([
      ...(holidayParts.get(date) || []),
      ...(approvedLeaveParts.get(date) || []),
    ]);
    const unavailable = Math.min(1, unavailableParts.size * 0.5);
    capacityDays += 1 - unavailable;
  }
  return capacityDays * hoursPerDay;
}

export function monthlyPaidLeaveApplicationLimit(joiningDate: string, onDate: string) {
  return completedServiceMonths(joiningDate, onDate) >= 12 ? 2 : 1;
}

export function remainingAnnualUnplannedLeave(usedDays: number, pendingDays = 0) {
  return Math.max(6 - usedDays - pendingDays, 0);
}

export function extendedPlannedLeaveEligibility({
  completedMonths,
  alreadyUsed,
  disqualifyingLop,
  workingDays,
  calendarSpanDays,
}: {
  completedMonths: number;
  alreadyUsed: boolean;
  disqualifyingLop: boolean;
  workingDays: number;
  calendarSpanDays: number;
}) {
  if (completedMonths < 12) return { eligible: false, reason: "Requires one completed year of service." };
  if (alreadyUsed) return { eligible: false, reason: "Annual exception already used." };
  if (disqualifyingLop) return { eligible: false, reason: "Unavailable because of qualifying LOP." };
  if (workingDays > 5) return { eligible: false, reason: "Maximum five working days." };
  if (calendarSpanDays > 9) return { eligible: false, reason: "Maximum nine calendar days." };
  return { eligible: true, reason: null };
}

export function maternityEligibility(gender: string | null, completedMonths: number) {
  return gender === "Female" && completedMonths >= 24;
}

export function paternityEligibility(gender: string | null, completedMonths: number) {
  return gender === "Male" && completedMonths >= 24;
}
