export type EmployeePdfPasswordRule = "employee_code_dob" | "employee_code" | "dob";

export type EmployeePdfIdentity = {
  employeeCode: string | null | undefined;
  employeeName?: string | null | undefined;
  dateOfBirth: string | null | undefined;
};

function employeeReference(employeeName: string | null | undefined, employeeCode: string | null | undefined) {
  const name = String(employeeName || "").trim();
  const code = String(employeeCode || "").trim();
  return name ? ` for ${name}${code ? ` (${code})` : ""}` : " for this employee";
}

function dateOfBirthDigits(dateOfBirth: string | null | undefined, reference: string) {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    throw new Error(`Unable to generate the protected PDF because Date of Birth is missing${reference}. Please update the employee profile.`);
  }
  const [year, month, day] = dateOfBirth.split("-");
  const parsed = new Date(`${dateOfBirth}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateOfBirth) {
    throw new Error(`Unable to generate the protected PDF because Date of Birth is invalid${reference}. Please update the employee profile.`);
  }
  return `${day}${month}${year}`;
}

export function deriveEmployeePdfPassword({ employeeCode, employeeName, dateOfBirth, rule }: EmployeePdfIdentity & { rule: EmployeePdfPasswordRule }) {
  const code = String(employeeCode || "").trim();
  const reference = employeeReference(employeeName, employeeCode);
  if (rule !== "dob" && !code) {
    throw new Error(`Unable to generate the protected PDF because Employee Code is missing${reference}. Please update the employee profile.`);
  }
  if (rule === "employee_code") return code;
  const dob = dateOfBirthDigits(dateOfBirth, reference);
  return rule === "dob" ? dob : `${code}${dob}`;
}

export function employeePdfPasswordRuleDescription(rule: EmployeePdfPasswordRule) {
  if (rule === "employee_code") return "Employee Code";
  if (rule === "dob") return "DOB (DDMMYYYY)";
  return "Employee Code + DOB (DDMMYYYY)";
}
