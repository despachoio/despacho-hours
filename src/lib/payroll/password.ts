import { deriveEmployeePdfPassword, employeePdfPasswordRuleDescription } from "@/lib/pdf/employeePdfPassword";
import type { PayslipPasswordRule } from "./types";

export function payslipPassword(rule: PayslipPasswordRule, employeeCode: string, dateOfBirth: string | null) {
  return deriveEmployeePdfPassword({ employeeCode, dateOfBirth, rule });
}

export function payslipPasswordDescription(rule: PayslipPasswordRule) {
  return employeePdfPasswordRuleDescription(rule);
}
