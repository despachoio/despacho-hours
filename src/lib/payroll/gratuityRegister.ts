import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateGratuityEstimate } from "./gratuity";
import { selectEffectiveSalaryStructures } from "./salaryStructures";

export type GratuityRegisterRow = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  employeeStatus: string;
  employmentRole: string | null;
  dateOfJoining: string | null;
  asOfDate: string;
  basicSalary: number;
  grossSalary: number;
  completedYears: number;
  remainingMonths: number;
  countedServiceYears: number;
  eligible: boolean;
  available: boolean;
  coveredEmployment: boolean;
  eligibilityDate: string | null;
  estimatedGratuity: number;
  currentlyPayableEstimate: number;
};

type StructureRow = {
  employee_id: string;
  effective_from: string;
  version: number;
  basic_pay: number;
  gross_salary: number;
};

export async function loadGratuityRegister(admin: SupabaseClient, asOfDate: string): Promise<GratuityRegisterRow[]> {
  const [employees, structures, entries] = await Promise.all([
    admin.from("employees").select("id,employee_code,name,status,role,date_of_joining").order("employee_code"),
    admin.from("salary_structures").select("employee_id,effective_from,version,basic_pay,gross_salary").lte("effective_from", asOfDate).order("effective_from", { ascending: false }).order("version", { ascending: false }),
    admin.from("payroll_entries").select("employee_id,basic_pay,gross_salary,payroll_month").eq("status", "published").not("published_at", "is", null).order("payroll_month", { ascending: false }),
  ]);
  const failure = employees.error || structures.error || entries.error;
  if (failure) throw new Error(failure.message);

  const effectiveStructures = new Map(
    selectEffectiveSalaryStructures((structures.data || []) as StructureRow[], asOfDate)
      .map((structure) => [structure.employee_id, structure]),
  );
  const latestEntries = new Map<string, { basic_pay: number; gross_salary: number }>();
  for (const entry of entries.data || []) {
    if (!latestEntries.has(entry.employee_id)) latestEntries.set(entry.employee_id, entry);
  }

  return (employees.data || []).map((employee) => {
    const structure = effectiveStructures.get(employee.id);
    const fallback = latestEntries.get(employee.id);
    const basicSalary = Number(structure?.basic_pay ?? fallback?.basic_pay ?? 0);
    const grossSalary = Number(structure?.gross_salary ?? fallback?.gross_salary ?? 0);
    const estimate = calculateGratuityEstimate({
      dateOfJoining: employee.date_of_joining,
      employmentRole: employee.role,
      basicPay: basicSalary,
      grossSalary,
      asOfDate,
    });
    return {
      employeeId: employee.id,
      employeeCode: employee.employee_code,
      employeeName: String(employee.name || "").replace(/^(?:mr|mrs|ms|miss|dr)\.?\s+/i, "").trim(),
      employeeStatus: employee.status,
      employmentRole: employee.role,
      dateOfJoining: employee.date_of_joining,
      asOfDate,
      basicSalary: estimate.wageBasis,
      grossSalary,
      completedYears: estimate.completedYears,
      remainingMonths: estimate.remainingMonths,
      countedServiceYears: estimate.countedServiceYears,
      eligible: estimate.eligible,
      available: estimate.available,
      coveredEmployment: estimate.coveredEmployment,
      eligibilityDate: estimate.eligibilityDate,
      estimatedGratuity: estimate.available && estimate.coveredEmployment ? estimate.accruedEstimate : 0,
      currentlyPayableEstimate: estimate.payableEstimate,
    };
  });
}

export function filterGratuityRegister(rows: GratuityRegisterRow[], filters: { search?: string; status?: string; eligibility?: string }) {
  const search = String(filters.search || "").trim().toLowerCase();
  const status = String(filters.status || "all").toLowerCase();
  const eligibility = String(filters.eligibility || "all").toLowerCase();
  return rows.filter((row) => {
    if (search && !`${row.employeeCode} ${row.employeeName}`.toLowerCase().includes(search)) return false;
    if (status !== "all" && row.employeeStatus.toLowerCase() !== status) return false;
    if (eligibility === "eligible" && !row.eligible) return false;
    if (eligibility === "not_eligible" && (row.eligible || !row.available || !row.coveredEmployment)) return false;
    if (eligibility === "unavailable" && row.available && row.coveredEmployment) return false;
    return true;
  });
}
