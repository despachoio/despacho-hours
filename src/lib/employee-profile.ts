export const EMPLOYEE_DEPARTMENTS = [
  "Operations",
  "HR",
  "Finance",
  "Management",
] as const;

export const EMPLOYEE_TITLES = ["Mr", "Miss", "Mrs.", "Dr"] as const;
export const EMPLOYEE_GENDERS = ["Male", "Female", "Others"] as const;

export type EmployeeProfileChanges = {
  employee_code: string;
  title: string | null;
  name: string;
  gender: string | null;
  email: string;
  role: string | null;
  department: string | null;
  date_of_joining: string | null;
  date_of_birth: string | null;
  epf_number: string | null;
  uan_number: string | null;
  pan_number: string | null;
  aadhaar_number: string | null;
};

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function optionalText(value: unknown) {
  if (typeof value !== "string") return null;
  return value.trim() || null;
}

export function validateEmployeeProfileChanges(input: unknown):
  | { value: EmployeeProfileChanges; error?: never }
  | { value?: never; error: string } {
  const body =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  const employeeCode = String(body.employee_code || "").trim();
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const title = optionalText(body.title);
  const gender = optionalText(body.gender);
  const department = optionalText(body.department);
  const dateOfJoining = optionalText(body.date_of_joining);
  const dateOfBirth = optionalText(body.date_of_birth);
  const panNumber = optionalText(body.pan_number)?.toUpperCase() || null;
  const aadhaarNumber =
    optionalText(body.aadhaar_number)?.replace(/\D/g, "") || null;

  if (!employeeCode || !name || !email) {
    return {
      error: "Employee code, employee name, and email address are required.",
    };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (title && !EMPLOYEE_TITLES.includes(title as never)) {
    return { error: "Select a valid title." };
  }
  if (gender && !EMPLOYEE_GENDERS.includes(gender as never)) {
    return { error: "Select a valid gender." };
  }
  if (department && !EMPLOYEE_DEPARTMENTS.includes(department as never)) {
    return { error: "Select a valid department." };
  }
  if (dateOfJoining && !DATE_PATTERN.test(dateOfJoining)) {
    return { error: "Enter a valid date of joining." };
  }
  if (dateOfBirth && !DATE_PATTERN.test(dateOfBirth)) {
    return { error: "Enter a valid date of birth." };
  }
  if (panNumber && !PAN_PATTERN.test(panNumber)) {
    return { error: "PAN must contain 5 letters, 4 digits, and 1 final letter." };
  }
  if (aadhaarNumber && !/^\d{12}$/.test(aadhaarNumber)) {
    return { error: "Aadhaar must contain exactly 12 digits." };
  }

  return {
    value: {
      employee_code: employeeCode,
      title,
      name,
      gender,
      email,
      role: optionalText(body.role),
      department,
      date_of_joining: dateOfJoining,
      date_of_birth: dateOfBirth,
      epf_number: optionalText(body.epf_number),
      uan_number: optionalText(body.uan_number),
      pan_number: panNumber,
      aadhaar_number: aadhaarNumber,
    },
  };
}

export const PROFILE_FIELD_LABELS: Record<keyof EmployeeProfileChanges, string> = {
  employee_code: "Employee Code",
  title: "Title",
  name: "Employee Name",
  gender: "Gender",
  email: "Email Address",
  role: "Role",
  department: "Department",
  date_of_joining: "Date of Joining",
  date_of_birth: "Date of Birth",
  epf_number: "EPF Number",
  uan_number: "UAN Number",
  pan_number: "PAN Number",
  aadhaar_number: "Aadhaar Number",
};
