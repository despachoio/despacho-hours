export const GRATUITY_CEILING = 2_000_000;
export const REGULAR_GRATUITY_ELIGIBILITY_MONTHS = 60;

export type GratuityProfile = {
  dateOfJoining: string | null;
  employmentRole: string | null;
  basicPay: number;
  grossSalary: number;
  asOfDate: string;
};

export type GratuityEstimate = {
  available: boolean;
  coveredEmployment: boolean;
  eligible: boolean;
  completedYears: number;
  remainingMonths: number;
  completedMonths: number;
  countedServiceYears: number;
  monthsUntilEligibility: number;
  eligibilityDate: string | null;
  wageBasis: number;
  accruedEstimate: number;
  payableEstimate: number;
  capped: boolean;
};

type DateParts = { year: number; month: number; day: number };

function parseDate(value: string | null): DateParts | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) return null;
  return { year, month, day };
}

function completedCalendarMonths(joining: DateParts, asOf: DateParts) {
  const monthDifference = (asOf.year - joining.year) * 12 + asOf.month - joining.month;
  return monthDifference - (asOf.day < joining.day ? 1 : 0);
}

function anniversaryDate(joining: DateParts, years: number) {
  const lastDay = new Date(Date.UTC(joining.year + years, joining.month, 0)).getUTCDate();
  const day = Math.min(joining.day, lastDay);
  return `${joining.year + years}-${String(joining.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function calculateGratuityEstimate(profile: GratuityProfile): GratuityEstimate {
  const joining = parseDate(profile.dateOfJoining);
  const asOf = parseDate(profile.asOfDate);
  const employmentRole = String(profile.employmentRole || "").trim().toLowerCase();
  const coveredEmployment = employmentRole !== "contractor";
  const basicPay = Math.max(0, Number(profile.basicPay) || 0);
  const grossSalary = Math.max(0, Number(profile.grossSalary) || 0);
  const wageBasis = Math.round(Math.max(basicPay, grossSalary * 0.5));

  if (!joining || !asOf || completedCalendarMonths(joining, asOf) < 0 || wageBasis <= 0) {
    return {
      available: false,
      coveredEmployment,
      eligible: false,
      completedYears: 0,
      remainingMonths: 0,
      completedMonths: 0,
      countedServiceYears: 0,
      monthsUntilEligibility: REGULAR_GRATUITY_ELIGIBILITY_MONTHS,
      eligibilityDate: joining ? anniversaryDate(joining, 5) : null,
      wageBasis,
      accruedEstimate: 0,
      payableEstimate: 0,
      capped: false,
    };
  }

  const completedMonths = completedCalendarMonths(joining, asOf);
  const completedYears = Math.floor(completedMonths / 12);
  const remainingMonths = completedMonths % 12;
  const countedServiceYears = completedYears + (remainingMonths > 6 ? 1 : 0);
  const uncappedEstimate = Math.round((wageBasis * 15 * countedServiceYears) / 26);
  const accruedEstimate = Math.min(uncappedEstimate, GRATUITY_CEILING);
  const eligible = coveredEmployment && completedMonths >= REGULAR_GRATUITY_ELIGIBILITY_MONTHS;

  return {
    available: true,
    coveredEmployment,
    eligible,
    completedYears,
    remainingMonths,
    completedMonths,
    countedServiceYears,
    monthsUntilEligibility: Math.max(REGULAR_GRATUITY_ELIGIBILITY_MONTHS - completedMonths, 0),
    eligibilityDate: anniversaryDate(joining, 5),
    wageBasis,
    accruedEstimate,
    payableEstimate: eligible ? accruedEstimate : 0,
    capped: uncappedEstimate > GRATUITY_CEILING,
  };
}
