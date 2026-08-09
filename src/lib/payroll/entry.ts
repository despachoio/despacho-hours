import { normalizePayrollNumber } from "./numbers";
import type { PayrollEntry } from "./types";

// This is the only application reference to the legacy persistence column. It
// is removed from the DTO without changing or writing the database value.
const LEGACY_REIMBURSEMENTS_COLUMN = "reimbursements";

const money = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const persistedNumber = (value: unknown) =>
  normalizePayrollNumber(
    typeof value === "string" || typeof value === "number" ? value : null,
  );

export function toPayrollEntryDto(row: Record<string, unknown>): PayrollEntry {
  const { [LEGACY_REIMBURSEMENTS_COLUMN]: _ignored, ...dto } = row;
  void _ignored;

  const totalEarnings = money(
    persistedNumber(dto.gross_salary) +
      persistedNumber(dto.bonus) +
      persistedNumber(dto.leave_encashment),
  );
  const totalDeductions = money(persistedNumber(dto.total_deductions));

  return {
    ...dto,
    total_earnings: totalEarnings,
    total_deductions: totalDeductions,
    net_salary: money(Math.max(totalEarnings - totalDeductions, 0)),
  } as PayrollEntry;
}
