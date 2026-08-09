import { calculatePayroll } from "./calculation";
import type { SalaryStructure } from "./types";

export type SalaryStructureComponents = Pick<
  SalaryStructure,
  | "gross_salary"
  | "basic_pay"
  | "hra"
  | "conveyance_allowance"
  | "other_allowance"
  | "epf_salary"
  | "employee_pf"
  | "employer_pf"
  | "employer_eps"
>;

export function calculateSalaryStructure(grossSalary: number, conveyanceAllowance = 1_600): SalaryStructureComponents {
  const calculated = calculatePayroll({ grossSalary, conveyanceAllowance });
  return {
    gross_salary: calculated.grossSalary,
    basic_pay: calculated.basicPay,
    hra: calculated.hra,
    conveyance_allowance: calculated.conveyanceAllowance,
    other_allowance: calculated.otherAllowance,
    epf_salary: calculated.epfSalary,
    employee_pf: calculated.employeePf,
    employer_pf: calculated.employerPf,
    employer_eps: calculated.employerEps,
  };
}

export function selectEffectiveSalaryStructures<T extends Pick<SalaryStructure, "employee_id" | "effective_from" | "version">>(structures: T[], applicabilityDate: string) {
  const selected = new Map<string, T>();
  for (const structure of structures) {
    if (structure.effective_from > applicabilityDate) continue;
    const current = selected.get(structure.employee_id);
    if (!current || structure.effective_from > current.effective_from || (structure.effective_from === current.effective_from && structure.version > current.version)) {
      selected.set(structure.employee_id, structure);
    }
  }
  return [...selected.values()];
}

export type SalaryStructureDisplayStatus = "active" | "scheduled" | "historical";

export function salaryStructureDisplayStatus(structure: SalaryStructure, structures: SalaryStructure[], today: string): SalaryStructureDisplayStatus {
  if (structure.effective_from > today) return "scheduled";
  const active = selectEffectiveSalaryStructures(structures, today).find((item) => item.employee_id === structure.employee_id);
  return active?.id === structure.id ? "active" : "historical";
}

export function latestSalaryStructure(structures: SalaryStructure[]) {
  return [...structures].sort((left, right) => right.effective_from.localeCompare(left.effective_from) || right.version - left.version)[0] || null;
}
