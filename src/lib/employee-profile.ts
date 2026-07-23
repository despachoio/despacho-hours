export const EMPLOYEE_DEPARTMENTS = [
  "Operations",
  "HR",
  "Finance",
  "Management",
] as const;

export const EMPLOYEE_TITLES = ["Mr", "Miss", "Mrs.", "Dr"] as const;
export const EMPLOYEE_GENDERS = ["Male", "Female", "Others"] as const;
export const MARITAL_STATUSES = [
  "Single",
  "Married",
  "Divorced",
  "Widow",
  "Widower",
] as const;
export const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
] as const;
export const COUNTRY_CODES = [
  { code: "+91", country: "India" },
  { code: "+1", country: "USA / Canada" },
  { code: "+44", country: "United Kingdom" },
  { code: "+971", country: "UAE" },
  { code: "+61", country: "Australia" },
  { code: "+65", country: "Singapore" },
  { code: "+60", country: "Malaysia" },
  { code: "+94", country: "Sri Lanka" },
  { code: "+974", country: "Qatar" },
  { code: "+966", country: "Saudi Arabia" },
] as const;

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
  phone_country_code: string;
  phone_number: string | null;
  marital_status: string | null;
  blood_group: string | null;
  bank_account_number: string | null;
  bank_name: string | null;
  ifsc_code: string | null;
  branch_name: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  address_line_3: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  father_name: string | null;
  mother_name: string | null;
  spouse_name: string | null;
  children: string[];
  emergency_contact_person: string | null;
  emergency_contact_number: string | null;
  nominee_name: string | null;
  nominee_relationship: string | null;
  nominee_date_of_birth: string | null;
};

export function emptyEmployeeProfileChanges(): EmployeeProfileChanges {
  return {
    employee_code: "",
    title: "Mr",
    name: "",
    gender: "Male",
    email: "",
    role: null,
    department: null,
    date_of_joining: null,
    date_of_birth: null,
    epf_number: null,
    uan_number: null,
    pan_number: null,
    aadhaar_number: null,
    phone_country_code: "+91",
    phone_number: null,
    marital_status: "Single",
    blood_group: null,
    bank_account_number: null,
    bank_name: null,
    ifsc_code: null,
    branch_name: null,
    address_line_1: null,
    address_line_2: null,
    address_line_3: null,
    city: null,
    state: null,
    country: "India",
    pincode: null,
    father_name: null,
    mother_name: null,
    spouse_name: null,
    children: [],
    emergency_contact_person: null,
    emergency_contact_number: null,
    nominee_name: null,
    nominee_relationship: null,
    nominee_date_of_birth: null,
  };
}

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function optionalText(value: unknown) {
  if (typeof value !== "string") return null;
  return value.trim() || null;
}

function optionalDate(value: unknown) {
  const normalized = optionalText(value);
  return normalized && DATE_PATTERN.test(normalized) ? normalized : null;
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
  const nomineeDateOfBirth = optionalText(body.nominee_date_of_birth);
  const panNumber = optionalText(body.pan_number)?.toUpperCase() || null;
  const aadhaarNumber =
    optionalText(body.aadhaar_number)?.replace(/\D/g, "") || null;
  const phoneCountryCode =
    optionalText(body.phone_country_code) || "+91";
  const phoneNumber =
    optionalText(body.phone_number)?.replace(/[^\d]/g, "") || null;
  const emergencyContactNumber =
    optionalText(body.emergency_contact_number)?.replace(/[^\d+]/g, "") ||
    null;
  const maritalStatus = optionalText(body.marital_status);
  const bloodGroup = optionalText(body.blood_group);
  const rawChildren = Array.isArray(body.children)
    ? body.children.slice(0, 20)
    : [];
  const children = rawChildren.map((child) => String(child || "").trim());

  if (!employeeCode || !name || !email) {
    return {
      error: "Employee code, employee name, and email address are required.",
    };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (children.some((child) => !child)) {
    return { error: "Enter a name for each child, or reduce the number of children." };
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
  if (maritalStatus && !MARITAL_STATUSES.includes(maritalStatus as never)) {
    return { error: "Select a valid marital status." };
  }
  if (bloodGroup && !BLOOD_GROUPS.includes(bloodGroup as never)) {
    return { error: "Select a valid blood group." };
  }
  if (!COUNTRY_CODES.some((item) => item.code === phoneCountryCode)) {
    return { error: "Select a valid phone country code." };
  }
  if (phoneNumber && !/^\d{6,15}$/.test(phoneNumber)) {
    return { error: "Phone number must contain 6 to 15 digits." };
  }
  if (dateOfJoining && !DATE_PATTERN.test(dateOfJoining)) {
    return { error: "Enter a valid date of joining." };
  }
  if (dateOfBirth && !DATE_PATTERN.test(dateOfBirth)) {
    return { error: "Enter a valid date of birth." };
  }
  if (nomineeDateOfBirth && !DATE_PATTERN.test(nomineeDateOfBirth)) {
    return { error: "Enter a valid nominee date of birth." };
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
      date_of_joining: optionalDate(dateOfJoining),
      date_of_birth: optionalDate(dateOfBirth),
      epf_number: optionalText(body.epf_number),
      uan_number: optionalText(body.uan_number),
      pan_number: panNumber,
      aadhaar_number: aadhaarNumber,
      phone_country_code: phoneCountryCode,
      phone_number: phoneNumber,
      marital_status: maritalStatus,
      blood_group: bloodGroup,
      bank_account_number: optionalText(body.bank_account_number),
      bank_name: optionalText(body.bank_name),
      ifsc_code: optionalText(body.ifsc_code)?.toUpperCase() || null,
      branch_name: optionalText(body.branch_name),
      address_line_1: optionalText(body.address_line_1),
      address_line_2: optionalText(body.address_line_2),
      address_line_3: optionalText(body.address_line_3),
      city: optionalText(body.city),
      state: optionalText(body.state),
      country: optionalText(body.country),
      pincode: optionalText(body.pincode),
      father_name: optionalText(body.father_name),
      mother_name: optionalText(body.mother_name),
      spouse_name: optionalText(body.spouse_name),
      children,
      emergency_contact_person: optionalText(body.emergency_contact_person),
      emergency_contact_number: emergencyContactNumber,
      nominee_name: optionalText(body.nominee_name),
      nominee_relationship: optionalText(body.nominee_relationship),
      nominee_date_of_birth: optionalDate(nomineeDateOfBirth),
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
  phone_country_code: "Phone Country Code",
  phone_number: "Phone Number",
  marital_status: "Marital Status",
  blood_group: "Blood Group",
  bank_account_number: "Bank Account Number",
  bank_name: "Bank Name",
  ifsc_code: "IFSC Code",
  branch_name: "Branch Name",
  address_line_1: "Address Line 1",
  address_line_2: "Address Line 2",
  address_line_3: "Address Line 3",
  city: "City",
  state: "State",
  country: "Country",
  pincode: "Pincode",
  father_name: "Father's Name",
  mother_name: "Mother's Name",
  spouse_name: "Spouse Name",
  children: "Children",
  emergency_contact_person: "Emergency Contact Person",
  emergency_contact_number: "Emergency Contact Number",
  nominee_name: "Nominee Name",
  nominee_relationship: "Nominee Relationship",
  nominee_date_of_birth: "Nominee DOB",
};
