export type FinancialYear = {
  value: string;
  label: string;
  startYear: number;
  endYear: number;
  startDate: string;
  endDate: string;
  months: string[];
};

function buildFinancialYear(startYear: number): FinancialYear {
  const endYear = startYear + 1;
  const months = Array.from({ length: 12 }, (_, index) => {
    const monthIndex = index + 3;
    const year = startYear + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    return `${year}-${String(month).padStart(2, "0")}`;
  });
  return {
    value: `${startYear}-${String(endYear).slice(-2)}`,
    label: `${startYear}\u2013${String(endYear).slice(-2)}`,
    startYear,
    endYear,
    startDate: `${startYear}-04-01`,
    endDate: `${endYear}-03-31`,
    months,
  };
}

export function financialYearFromValue(value: string): FinancialYear | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const startYear = Number(match[1]);
  if (startYear < 2000 || startYear > 2100 || Number(match[2]) !== (startYear + 1) % 100) return null;
  return buildFinancialYear(startYear);
}

export function currentFinancialYear(date = new Date()): FinancialYear {
  const year = date.getFullYear();
  return buildFinancialYear(date.getMonth() >= 3 ? year : year - 1);
}

export function financialYearForPayrollMonth(payrollMonth: string): FinancialYear {
  const [yearText, monthText] = payrollMonth.slice(0, 7).split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  return buildFinancialYear(month >= 4 ? year : year - 1);
}

export function isInFinancialYear(payrollMonth: string, financialYearValue: string) {
  const financialYear = financialYearFromValue(financialYearValue);
  if (!financialYear) return false;
  const month = payrollMonth.slice(0, 7);
  return month >= financialYear.startDate.slice(0, 7) && month <= financialYear.endDate.slice(0, 7);
}

export function financialYearOptions(payrollMonths: string[], current = currentFinancialYear()) {
  const historicalStartYears = payrollMonths
    .map((month) => financialYearForPayrollMonth(month).startYear)
    .filter((startYear) => startYear <= current.startYear);
  const oldestStartYear = historicalStartYears.length ? Math.min(...historicalStartYears) : current.startYear;
  return Array.from(
    { length: current.startYear - oldestStartYear + 1 },
    (_, index) => buildFinancialYear(current.startYear - index),
  );
}
