"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  EMPLOYEE_DEPARTMENTS,
  EMPLOYEE_GENDERS,
  EMPLOYEE_TITLES,
  type EmployeeProfileChanges,
} from "@/lib/employee-profile";

type EmployeeRecord = Omit<
  EmployeeProfileChanges,
  "pan_number" | "aadhaar_number"
> & {
  id: string;
  reporting_manager_id: string | null;
  status: string | null;
};

type ChangeRequest = {
  id: string;
  status: "pending" | "approved" | "rejected";
  proposed_changes: EmployeeProfileChanges;
  review_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
};

type ProfileResponse = {
  employee: EmployeeRecord;
  statutory: {
    pan_number: string | null;
    aadhaar_number: string | null;
  };
  reportingManager: {
    id: string;
    name: string;
    title: string | null;
  } | null;
  accessRole: string;
  requests: ChangeRequest[];
};

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export default function MyProfilePage() {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [form, setForm] = useState<EmployeeProfileChanges | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadProfile() {
    setLoading(true);
    setError("");
    const token = await accessToken();
    if (!token) {
      setError("Your session has expired.");
      setLoading(false);
      return;
    }
    const response = await fetch("/api/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = (await response.json()) as ProfileResponse & {
      error?: string;
    };
    if (!response.ok) {
      setError(result.error || "Unable to load your profile.");
      setLoading(false);
      return;
    }
    setData(result);
    setForm({
      employee_code: result.employee.employee_code,
      title: result.employee.title,
      name: result.employee.name,
      gender: result.employee.gender,
      email: result.employee.email,
      role: result.employee.role,
      department: result.employee.department,
      date_of_joining: result.employee.date_of_joining,
      date_of_birth: result.employee.date_of_birth,
      epf_number: result.employee.epf_number,
      uan_number: result.employee.uan_number,
      pan_number: result.statutory.pan_number,
      aadhaar_number: result.statutory.aadhaar_number,
    });
    setLoading(false);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadProfile(), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const pendingRequest = useMemo(
    () => data?.requests.find((request) => request.status === "pending") || null,
    [data],
  );

  function update<K extends keyof EmployeeProfileChanges>(
    key: K,
    value: EmployeeProfileChanges[K],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function submitRequest() {
    if (!form || pendingRequest || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    const token = await accessToken();
    if (!token) {
      setError("Your session has expired.");
      setSaving(false);
      return;
    }
    const response = await fetch("/api/profile/change-requests", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error || "Unable to submit your profile changes.");
      setSaving(false);
      return;
    }
    setEditing(false);
    setMessage("Your changes were submitted for approval.");
    await loadProfile();
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-sm font-semibold text-slate-500">
        Loading your profile...
      </main>
    );
  }

  if (!data || !form) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6">
        <div className="rounded-3xl border border-red-100 bg-white p-8 text-center text-red-700 shadow-xl">
          {error || "Your employee profile could not be loaded."}
        </div>
      </main>
    );
  }

  const employee = data.employee;
  const details: Array<[string, string]> = [
    ["Employee Code", employee.employee_code || "—"],
    ["Title", employee.title || "—"],
    ["Employee Name", employee.name],
    ["Gender", employee.gender || "—"],
    ["Email Address", employee.email],
    ["Role", employee.role || "—"],
    ["Department", employee.department || "—"],
    ["Date of Joining", profileDate(employee.date_of_joining)],
    ["Date of Birth", profileDate(employee.date_of_birth)],
    ["EPF Number", employee.epf_number || "—"],
    ["UAN Number", employee.uan_number || "—"],
    ["PAN Number", data.statutory.pan_number || "—"],
    ["Aadhaar Number", data.statutory.aadhaar_number || "—"],
    [
      "Reporting Manager",
      data.reportingManager
        ? `${data.reportingManager.title ? `${data.reportingManager.title} ` : ""}${data.reportingManager.name}`
        : "—",
    ],
    ["Access Type", data.accessRole],
    ["Status", employee.status || "—"],
  ];

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-5 py-7 sm:px-8">
      <div className="mx-auto max-w-[1320px]">
        <header className="relative overflow-hidden rounded-[2rem] bg-[#0F172A] px-8 py-10 text-white shadow-xl shadow-slate-300/50 lg:px-11">
          <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#153E90]/70 blur-3xl" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">
                Personal workspace
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight lg:text-5xl">
                My Profile
              </h1>
              <p className="mt-3 text-sm text-slate-300">
                Review your employment information and request corrections.
              </p>
            </div>
            <button
              type="button"
              disabled={Boolean(pendingRequest)}
              onClick={() => setEditing((value) => !value)}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-[#0F172A] shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editing ? "Cancel Editing" : "Request a Change"}
            </button>
          </div>
        </header>

        {error ? (
          <Notice tone="error">{error}</Notice>
        ) : message ? (
          <Notice tone="success">{message}</Notice>
        ) : null}

        {pendingRequest ? (
          <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
              Awaiting approval
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-950">
              Your profile change request is pending
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Submitted {dateTime(pendingRequest.created_at)}. You can submit
              another request after this one is approved or rejected.
            </p>
          </section>
        ) : null}

        {!editing ? (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">
              Employee details
            </h2>
            <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {details.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    {label}
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-800">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="mt-6 rounded-3xl border border-blue-100 bg-white p-6 shadow-lg">
            <h2 className="text-xl font-bold text-slate-950">
              Request profile corrections
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Your current profile remains unchanged until an Admin or Super
              Admin approves this request.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Employee Code" value={form.employee_code} onChange={(value) => update("employee_code", value)} />
              <SelectField label="Title" value={form.title || ""} onChange={(value) => update("title", value || null)} options={EMPLOYEE_TITLES} />
              <Field label="Employee Name" value={form.name} onChange={(value) => update("name", value)} />
              <SelectField label="Gender" value={form.gender || ""} onChange={(value) => update("gender", value || null)} options={EMPLOYEE_GENDERS} />
              <Field label="Email Address" value={form.email} type="email" onChange={(value) => update("email", value)} />
              <Field label="Role" value={form.role || ""} onChange={(value) => update("role", value || null)} />
              <SelectField label="Department" value={form.department || ""} onChange={(value) => update("department", value || null)} options={EMPLOYEE_DEPARTMENTS} includeBlank />
              <Field label="Date of Joining" value={form.date_of_joining || ""} type="date" onChange={(value) => update("date_of_joining", value || null)} />
              <Field label="Date of Birth" value={form.date_of_birth || ""} type="date" onChange={(value) => update("date_of_birth", value || null)} />
              <Field label="EPF Number" value={form.epf_number || ""} onChange={(value) => update("epf_number", value || null)} />
              <Field label="UAN Number" value={form.uan_number || ""} onChange={(value) => update("uan_number", value || null)} />
              <Field label="PAN Number" value={form.pan_number || ""} maxLength={10} onChange={(value) => update("pan_number", value.toUpperCase() || null)} />
              <Field label="Aadhaar Number" value={form.aadhaar_number || ""} maxLength={12} inputMode="numeric" onChange={(value) => update("aadhaar_number", value.replace(/\D/g, "").slice(0, 12) || null)} />
              <ReadOnly label="Reporting Manager" value={details.find(([label]) => label === "Reporting Manager")?.[1] || "—"} />
              <ReadOnly label="Access Type" value={data.accessRole} />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitRequest()}
                className="rounded-xl bg-[#153E90] px-5 py-2.5 font-bold text-white disabled:opacity-60"
              >
                {saving ? "Submitting..." : "Submit for Approval"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-xl border border-slate-200 px-5 py-2.5 font-bold text-slate-700"
              >
                Cancel
              </button>
            </div>
          </section>
        )}

        {data.requests.length ? (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">Request history</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {data.requests.map((request) => (
                <div key={request.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold capitalize text-slate-900">
                      {request.status}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Submitted {dateTime(request.created_at)}
                    </p>
                    {request.review_notes ? (
                      <p className="mt-2 text-sm text-slate-600">
                        Reviewer note: {request.review_notes}
                      </p>
                    ) : null}
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${requestTone(request.status)}`}>
                    {request.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  maxLength,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  maxLength?: number;
  inputMode?: "numeric";
}) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        maxLength={maxLength}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  includeBlank?: boolean;
}) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
      >
        {includeBlank ? <option value="">Select department</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
      {children}
    </div>
  );
}

function profileDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function requestTone(status: ChangeRequest["status"]) {
  if (status === "approved") return "bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}
