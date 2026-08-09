export type PayrollNumberInput = string | number | null | undefined;

export function normalizePayrollNumber(value: PayrollNumberInput) {
  if (value === "" || value === null || value === undefined) return 0;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

