"use client";

import type { ReactNode } from "react";
import {
  BLOOD_GROUPS,
  COUNTRY_CODES,
  EMPLOYEE_DEPARTMENTS,
  EMPLOYEE_GENDERS,
  EMPLOYEE_TITLES,
  MARITAL_STATUSES,
  type EmployeeProfileChanges,
} from "@/lib/employee-profile";

type ChangeHandler = <K extends keyof EmployeeProfileChanges>(
  key: K,
  value: EmployeeProfileChanges[K],
) => void;

export function EmployeeProfileFormSections({
  value,
  onChange,
  joiningExtras,
  joiningReadOnly = false,
  showFinanceDetails = true,
  statutoryFinanceReadOnly = false,
}: {
  value: EmployeeProfileChanges;
  onChange: ChangeHandler;
  joiningExtras?: ReactNode;
  joiningReadOnly?: boolean;
  showFinanceDetails?: boolean;
  statutoryFinanceReadOnly?: boolean;
}) {
  function resizeChildren(count: number) {
    const safeCount = Math.max(0, Math.min(20, count));
    const children = Array.from(
      { length: safeCount },
      (_, index) => value.children[index] || "",
    );
    onChange("children", children);
  }

  return (
    <div className="space-y-5">
      <FormSection
        eyebrow="Identity & wellbeing"
        title="Personal Details"
        accent="blue"
      >
        <SelectField
          label="Title"
          value={value.title || ""}
          onChange={(next) => onChange("title", next || null)}
          options={EMPLOYEE_TITLES}
        />
        <TextField
          label="Employee Name"
          value={value.name}
          onChange={(next) => onChange("name", next)}
          required
        />
        <SelectField
          label="Gender"
          value={value.gender || ""}
          onChange={(next) => onChange("gender", next || null)}
          options={EMPLOYEE_GENDERS}
        />
        <TextField
          label="Date of Birth"
          type="date"
          value={value.date_of_birth || ""}
          onChange={(next) => onChange("date_of_birth", next || null)}
        />
        <TextField
          label="PAN Number"
          value={value.pan_number || ""}
          maxLength={10}
          onChange={(next) =>
            onChange("pan_number", next.toUpperCase() || null)
          }
        />
        <TextField
          label="Aadhaar Number"
          value={value.aadhaar_number || ""}
          maxLength={12}
          inputMode="numeric"
          onChange={(next) =>
            onChange(
              "aadhaar_number",
              next.replace(/\D/g, "").slice(0, 12) || null,
            )
          }
        />
        <PhoneField
          countryCode={value.phone_country_code}
          number={value.phone_number || ""}
          onCountryCode={(next) => onChange("phone_country_code", next)}
          onNumber={(next) =>
            onChange(
              "phone_number",
              next.replace(/\D/g, "").slice(0, 15) || null,
            )
          }
        />
        <SelectField
          label="Marital Status"
          value={value.marital_status || ""}
          onChange={(next) => onChange("marital_status", next || null)}
          options={MARITAL_STATUSES}
          includeBlank
        />
        <SelectField
          label="Blood Group"
          value={value.blood_group || ""}
          onChange={(next) => onChange("blood_group", next || null)}
          options={BLOOD_GROUPS}
          includeBlank
        />
      </FormSection>

      <FormSection
        eyebrow="Organisation"
        title="Joining Details"
        accent="indigo"
      >
        <TextField
          label="Employee Code"
          value={value.employee_code}
          onChange={(next) => onChange("employee_code", next)}
          required
          disabled={joiningReadOnly}
        />
        <TextField
          label="Email Address"
          type="email"
          value={value.email}
          onChange={(next) => onChange("email", next)}
          required
          disabled={joiningReadOnly}
        />
        <TextField
          label="Role"
          value={value.role || ""}
          onChange={(next) => onChange("role", next || null)}
          disabled={joiningReadOnly}
        />
        <SelectField
          label="Department"
          value={value.department || ""}
          onChange={(next) => onChange("department", next || null)}
          options={EMPLOYEE_DEPARTMENTS}
          includeBlank
          disabled={joiningReadOnly}
        />
        <TextField
          label="Date of Joining"
          type="date"
          value={value.date_of_joining || ""}
          onChange={(next) => onChange("date_of_joining", next || null)}
          disabled={joiningReadOnly}
        />
        {joiningExtras}
      </FormSection>

      {showFinanceDetails ? (
        <FormSection
          eyebrow="Payroll & banking"
          title="Finance Details"
          accent="emerald"
        >
          <TextField
            label="EPF Number"
            value={value.epf_number || ""}
            onChange={(next) => onChange("epf_number", next || null)}
            disabled={statutoryFinanceReadOnly}
          />
          <TextField
            label="UAN Number"
            value={value.uan_number || ""}
            onChange={(next) => onChange("uan_number", next || null)}
            disabled={statutoryFinanceReadOnly}
          />
          <TextField
            label="Bank Account Number"
            value={value.bank_account_number || ""}
            onChange={(next) => onChange("bank_account_number", next || null)}
          />
          <TextField
            label="Bank Name"
            value={value.bank_name || ""}
            onChange={(next) => onChange("bank_name", next || null)}
          />
          <TextField
            label="IFSC Code"
            value={value.ifsc_code || ""}
            onChange={(next) =>
              onChange("ifsc_code", next.toUpperCase() || null)
            }
          />
          <TextField
            label="Branch Name"
            value={value.branch_name || ""}
            onChange={(next) => onChange("branch_name", next || null)}
          />
        </FormSection>
      ) : null}

      <FormSection
        eyebrow="Residential information"
        title="Address Details"
        accent="amber"
      >
        <TextField label="Address Line 1" value={value.address_line_1 || ""} onChange={(next) => onChange("address_line_1", next || null)} />
        <TextField label="Address Line 2" value={value.address_line_2 || ""} onChange={(next) => onChange("address_line_2", next || null)} />
        <TextField label="Address Line 3" value={value.address_line_3 || ""} onChange={(next) => onChange("address_line_3", next || null)} />
        <TextField label="City" value={value.city || ""} onChange={(next) => onChange("city", next || null)} />
        <TextField label="State" value={value.state || ""} onChange={(next) => onChange("state", next || null)} />
        <TextField label="Country" value={value.country || ""} onChange={(next) => onChange("country", next || null)} />
        <TextField label="Pincode" value={value.pincode || ""} onChange={(next) => onChange("pincode", next || null)} />
      </FormSection>

      <FormSection
        eyebrow="Dependants & emergency"
        title="Family Details"
        accent="rose"
      >
        <TextField label="Father's Name" value={value.father_name || ""} onChange={(next) => onChange("father_name", next || null)} />
        <TextField label="Mother's Name" value={value.mother_name || ""} onChange={(next) => onChange("mother_name", next || null)} />
        <TextField label="Spouse Name" value={value.spouse_name || ""} onChange={(next) => onChange("spouse_name", next || null)} />
        <TextField
          label="Number of Children"
          type="number"
          min={0}
          max={20}
          value={String(value.children.length)}
          onChange={(next) => resizeChildren(Number(next || 0))}
        />
        {value.children.map((child, index) => (
          <TextField
            key={index}
            label={`Child ${index + 1} Name`}
            value={child}
            onChange={(next) => {
              const children = [...value.children];
              children[index] = next;
              onChange("children", children);
            }}
          />
        ))}
        <TextField label="Emergency Contact Person" value={value.emergency_contact_person || ""} onChange={(next) => onChange("emergency_contact_person", next || null)} />
        <TextField label="Emergency Contact Number" value={value.emergency_contact_number || ""} inputMode="tel" onChange={(next) => onChange("emergency_contact_number", next.replace(/[^\d+]/g, "") || null)} />
      </FormSection>

      <FormSection
        eyebrow="Benefits & succession"
        title="Nominee Details"
        accent="violet"
      >
        <TextField label="Nominee Name" value={value.nominee_name || ""} onChange={(next) => onChange("nominee_name", next || null)} />
        <TextField label="Nominee Relationship" value={value.nominee_relationship || ""} onChange={(next) => onChange("nominee_relationship", next || null)} />
        <TextField label="Nominee DOB" type="date" value={value.nominee_date_of_birth || ""} onChange={(next) => onChange("nominee_date_of_birth", next || null)} />
      </FormSection>
    </div>
  );
}

export function EmployeeProfileDetailsSections({
  value,
  reportingManager,
  accessRole,
  status,
  showFinanceDetails = true,
}: {
  value: EmployeeProfileChanges;
  reportingManager: string;
  accessRole: string;
  status?: string | null;
  showFinanceDetails?: boolean;
}) {
  const personal = [
    ["Title", value.title],
    ["Employee Name", value.name],
    ["Gender", value.gender],
    ["Date of Birth", formatDate(value.date_of_birth)],
    ["PAN Number", value.pan_number],
    ["Aadhaar Number", value.aadhaar_number],
    [
      "Phone Number",
      value.phone_number
        ? `${value.phone_country_code} ${value.phone_number}`
        : null,
    ],
    ["Marital Status", value.marital_status],
    ["Blood Group", value.blood_group],
  ];
  const joining = [
    ["Employee Code", value.employee_code],
    ["Email Address", value.email],
    ["Role", value.role],
    ["Department", value.department],
    ["Date of Joining", formatDate(value.date_of_joining)],
    ["Reporting Manager", reportingManager],
    ["Access Type", accessRole],
    ...(status ? [["Status", status]] : []),
  ];
  const finance = [
    ["EPF Number", value.epf_number],
    ["UAN Number", value.uan_number],
    ["Bank Account Number", value.bank_account_number],
    ["Bank Name", value.bank_name],
    ["IFSC Code", value.ifsc_code],
    ["Branch Name", value.branch_name],
  ];
  const address = [
    ["Address Line 1", value.address_line_1],
    ["Address Line 2", value.address_line_2],
    ["Address Line 3", value.address_line_3],
    ["City", value.city],
    ["State", value.state],
    ["Country", value.country],
    ["Pincode", value.pincode],
  ];
  const family = [
    ["Father's Name", value.father_name],
    ["Mother's Name", value.mother_name],
    ["Spouse Name", value.spouse_name],
    ["Number of Children", String(value.children.length)],
    ...value.children.map(
      (child, index) => [`Child ${index + 1} Name`, child] as [string, string],
    ),
    ["Emergency Contact Person", value.emergency_contact_person],
    ["Emergency Contact Number", value.emergency_contact_number],
  ];
  const nominee = [
    ["Nominee Name", value.nominee_name],
    ["Nominee Relationship", value.nominee_relationship],
    ["Nominee DOB", formatDate(value.nominee_date_of_birth)],
  ];

  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-2">
      <DetailSection title="Personal Details" eyebrow="Identity & wellbeing" accent="blue" details={personal} />
      <DetailSection title="Joining Details" eyebrow="Organisation" accent="indigo" details={joining} />
      {showFinanceDetails ? (
        <DetailSection title="Finance Details" eyebrow="Payroll & banking" accent="emerald" details={finance} />
      ) : null}
      <DetailSection title="Address Details" eyebrow="Residential information" accent="amber" details={address} />
      <DetailSection title="Family Details" eyebrow="Dependants & emergency" accent="rose" details={family} />
      <DetailSection title="Nominee Details" eyebrow="Benefits & succession" accent="violet" details={nominee} />
    </div>
  );
}

type Accent = "blue" | "indigo" | "emerald" | "amber" | "rose" | "violet";
const accentClasses: Record<Accent, string> = {
  blue: "from-blue-500 to-cyan-400",
  indigo: "from-indigo-600 to-blue-500",
  emerald: "from-emerald-600 to-teal-400",
  amber: "from-amber-500 to-orange-400",
  rose: "from-rose-500 to-pink-400",
  violet: "from-violet-600 to-fuchsia-400",
};

function FormSection({
  eyebrow,
  title,
  accent,
  children,
}: {
  eyebrow: string;
  title: string;
  accent: Accent;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative border-b border-slate-100 px-6 py-5">
        <div className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${accentClasses[accent]}`} />
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
        <h3 className="mt-1 text-lg font-bold text-slate-950">{title}</h3>
      </div>
      <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </section>
  );
}

function DetailSection({
  eyebrow,
  title,
  accent,
  details,
}: {
  eyebrow: string;
  title: string;
  accent: Accent;
  details: Array<Array<string | null | undefined>>;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="relative border-b border-slate-100 px-6 py-5">
        <div className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${accentClasses[accent]}`} />
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-bold text-slate-950">{title}</h2>
      </div>
      <div className="grid gap-x-8 gap-y-5 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {details.map(([label, rawValue]) => (
          <div key={label} className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">{label}</p>
            <p className="mt-1 break-words text-sm font-semibold text-slate-800">{rawValue || "—"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  maxLength,
  inputMode,
  min,
  max,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
  inputMode?: "numeric" | "tel";
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      {required ? <span className="ml-1 text-red-500">*</span> : null}
      <input
        type={type}
        value={value}
        required={required}
        maxLength={maxLength}
        inputMode={inputMode}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  includeBlank = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  includeBlank?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
      >
        {includeBlank ? <option value="">Select</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function PhoneField({
  countryCode,
  number,
  onCountryCode,
  onNumber,
}: {
  countryCode: string;
  number: string;
  onCountryCode: (value: string) => void;
  onNumber: (value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      Phone Number
      <div className="mt-2 grid grid-cols-[145px_1fr]">
        <select
          aria-label="Phone country code"
          value={countryCode}
          onChange={(event) => onCountryCode(event.target.value)}
          className="rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 px-3 py-3 outline-none focus:border-blue-400"
        >
          {COUNTRY_CODES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.code} · {item.country}
            </option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="numeric"
          value={number}
          onChange={(event) => onNumber(event.target.value)}
          className="min-w-0 rounded-r-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
        />
      </div>
    </label>
  );
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
