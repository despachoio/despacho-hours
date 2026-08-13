import type { PayslipPasswordRule } from "./types";

function dobDigits(dateOfBirth: string | null) {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) throw new Error("Employee date of birth is required by the configured payslip password rule");
  const [year, month, day] = dateOfBirth.split("-");
  return `${day}${month}${year}`;
}

export function payslipPassword(rule: PayslipPasswordRule, employeeCode: string, dateOfBirth: string | null) {
  const code = employeeCode.trim();
  if (!code) throw new Error("Employee code is required for payslip protection");
  if (rule === "employee_code") return code;
  if (rule === "dob") return dobDigits(dateOfBirth);
  return `${code}${dobDigits(dateOfBirth)}`;
}

export function payslipPasswordDescription(rule: PayslipPasswordRule) {
  if (rule === "employee_code") return "Employee Code";
  if (rule === "dob") return "DOB (DDMMYYYY)";
  return "Employee Code + DOB (DDMMYYYY)";
}
