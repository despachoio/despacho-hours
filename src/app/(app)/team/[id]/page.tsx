"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import EmployeeHeader from "@/components/team/EmployeeHeader";
import EmployeePeriodFilter from "@/components/team/EmployeePeriodFilter";
import EmployeeTimeline from "@/components/team/EmployeeTimeline";
import {
  ClientSummary,
  ProjectSummary,
} from "@/components/team/AllocationSummary";
import EmployeeStats from "@/components/team/EmployeeStats";
import EmployeeCharts from "@/components/team/EmployeeCharts";
import type {
  ReportingManagerOption,
  TeamEmployee,
  TeamEntry,
  TeamProfile,
  TeamTimer,
} from "@/components/team/types";
import { dateRange, employeeAnalytics } from "@/components/team/utils";
import { EMPLOYEE_DEPARTMENTS } from "@/lib/employee-profile";

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function TeamDetailPageContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const action = useSearchParams().get("action");
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [member, setMember] = useState<TeamEmployee | null>(null);
  const [entries, setEntries] = useState<TeamEntry[]>([]);
  const [timer, setTimer] = useState<TeamTimer | null>(null);
  const [period, setPeriod] = useState("this_week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const [passwordResetBusy, setPasswordResetBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [employeeCode, setEmployeeCode] = useState("");
  const [title, setTitle] = useState("Mr");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("Male");
  const [email, setEmail] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [department, setDepartment] = useState("");
  const [dateOfJoining, setDateOfJoining] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [epfNumber, setEpfNumber] = useState("");
  const [uanNumber, setUanNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [reportingManagerId, setReportingManagerId] = useState("");
  const [reportingManagers, setReportingManagers] = useState<
    ReportingManagerOption[]
  >([]);
  const [accessRole, setAccessRole] = useState("Employee");
  const role = String(profile?.role || "")
    .trim()
    .toLowerCase();
  const isSuperAdmin = role === "super admin";
  const isAdmin = isSuperAdmin || role === "admin";
  const canManageMember =
    isAdmin && (isSuperAdmin || accessRole !== "Super Admin");
  const range = useMemo(
    () => dateRange(period, customFrom, customTo),
    [customFrom, customTo, period],
  );

  useEffect(() => {
    async function loadMember() {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role,employee_id")
        .eq("user_id", userData.user.id)
        .single();
      const current = profileData as TeamProfile | null;
      setProfile(current);
      const currentRole = String(current?.role || "")
        .trim()
        .toLowerCase();
      if (
        !current ||
        (!["admin", "super admin"].includes(currentRole) &&
          current.employee_id !== id)
      ) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      const memberResult = await supabase
        .from("employees")
        .select(
          "id,employee_code,title,name,gender,email,role,department,date_of_joining,date_of_birth,epf_number,uan_number,reporting_manager_id,status,hourly_cost",
        )
        .eq("id", id)
        .single();
      if (memberResult.error || !memberResult.data) {
        if (currentRole === "manager") setAccessDenied(true);
        else setError(memberResult.error?.message || "Employee not found.");
        setLoading(false);
        return;
      }
      const rawMember = memberResult.data as unknown as Omit<
        TeamEmployee,
        "reporting_manager"
      >;
      const loaded: TeamEmployee = {
        ...rawMember,
        reporting_manager: null,
      };
      if (
        (!["super admin", "admin"].includes(currentRole) &&
          String(loaded.status || "").trim().toLowerCase() !== "active")
      ) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      if (loaded.reporting_manager_id) {
        const managerResult = await supabase
          .from("employees")
          .select("id,name,title")
          .eq("id", loaded.reporting_manager_id)
          .maybeSingle();
        if (!managerResult.error && managerResult.data) {
          loaded.reporting_manager = managerResult.data;
        }
      }

      const [timerResult, accessResult] = await Promise.all([
        supabase
          .from("active_timers")
          .select(
            "id,employee_id,project_id,started_at,paused_at,total_paused_seconds,status,description,projects(id,name,project_code,clients(id,name))",
          )
          .eq("employee_id", id)
          .in("status", ["running", "paused"])
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("role")
          .eq("employee_id", id)
          .maybeSingle(),
      ]);
      setMember(loaded);
      setTimer((timerResult.data || null) as unknown as TeamTimer | null);
      setAccessRole(accessResult.data?.role || "Employee");
      setEmployeeCode(loaded.employee_code || "");
      setTitle(loaded.title || "Mr");
      setName(loaded.name);
      setGender(loaded.gender || "Male");
      setEmail(loaded.email);
      setMemberRole(loaded.role || "");
      setDepartment(loaded.department || "");
      setDateOfJoining(loaded.date_of_joining || "");
      setDateOfBirth(loaded.date_of_birth || "");
      setEpfNumber(loaded.epf_number || "");
      setUanNumber(loaded.uan_number || "");
      setReportingManagerId(loaded.reporting_manager_id || "");
      if (["admin", "super admin"].includes(currentRole)) {
        const [managerResult, statutoryResult] = await Promise.all([
          supabase.rpc("get_reporting_manager_options"),
          supabase
            .from("employee_statutory_details")
            .select("pan_number,aadhaar_number")
            .eq("employee_id", id)
            .maybeSingle(),
        ]);
        const { data: managerData, error: managerError } = managerResult;
        if (managerError) setError(managerError.message);
        else
          setReportingManagers(
            ((managerData || []) as ReportingManagerOption[]).filter(
              (manager) => manager.id !== id,
            ),
          );
        if (statutoryResult.error) {
          setError(statutoryResult.error.message);
        } else {
          setPanNumber(statutoryResult.data?.pan_number || "");
          setAadhaarNumber(statutoryResult.data?.aadhaar_number || "");
        }
      }
      setLoading(false);
    }
    void loadMember();
  }, [id]);

  useEffect(() => {
    if (!member || !range.from || !range.to || accessDenied) return;
    async function loadEntries() {
      const result = await supabase
        .from("time_entries")
        .select(
          "id,employee_id,project_id,entry_date,started_at,stopped_at,hours,description,projects(id,name,project_code,is_billable,clients(id,name))",
        )
        .eq("employee_id", id)
        .gte("entry_date", range.from)
        .lte("entry_date", range.to)
        .order("entry_date", { ascending: false })
        .order("started_at");
      if (result.error) setError(result.error.message);
      setEntries((result.data || []) as unknown as TeamEntry[]);
    }
    void loadEntries();
  }, [accessDenied, id, member, range.from, range.to]);

  const analytics = useMemo(
    () =>
      member
        ? employeeAnalytics(member, entries, timer, range.from, range.to)
        : null,
    [entries, member, range.from, range.to, timer],
  );

  async function saveMember() {
    if (!canManageMember) return;
    if (!employeeCode.trim() || !name.trim() || !email.trim()) {
      setError("Employee code, employee name, and email address are required.");
      return;
    }
    const normalizedPan = panNumber.trim().toUpperCase();
    const normalizedAadhaar = aadhaarNumber.replace(/\s+/g, "");
    if (normalizedPan && !PAN_PATTERN.test(normalizedPan)) {
      setError("PAN must contain 5 letters, 4 digits, and 1 final letter.");
      return;
    }
    if (normalizedAadhaar && !/^[0-9]{12}$/.test(normalizedAadhaar)) {
      setError("Aadhaar must contain exactly 12 digits.");
      return;
    }
    setError("");
    const { error: employeeError } = await supabase
      .from("employees")
      .update({
        employee_code: employeeCode.trim(),
        title,
        name: name.trim(),
        gender,
        email: email.trim().toLowerCase(),
        role: memberRole || null,
        department: department || null,
        date_of_joining: dateOfJoining || null,
        date_of_birth: dateOfBirth || null,
        epf_number: epfNumber.trim() || null,
        uan_number: uanNumber.trim() || null,
        reporting_manager_id: reportingManagerId || null,
      })
      .eq("id", id);
    if (employeeError) {
      setError(employeeError.message);
      return;
    }
    const { error: statutoryError } = await supabase
      .from("employee_statutory_details")
      .upsert(
        {
          employee_id: id,
          pan_number: normalizedPan || null,
          aadhaar_number: normalizedAadhaar || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "employee_id" },
      );
    if (statutoryError) {
      setError(statutoryError.message);
      return;
    }
    const { data: employeeRecord, error: employeeLookupError } = await supabase
  .from("employees")
  .select("user_id")
  .eq("id", id)
  .single();

if (employeeLookupError) {
  setError(employeeLookupError.message);
  return;
}

if (!employeeRecord?.user_id) {
  setError(
    "This employee does not have login access yet. Create a Supabase Auth user before assigning Admin or Manager access."
  );
  return;
}

const { error: profileError } = await supabase
  .from("profiles")
  .upsert(
    {
      user_id: employeeRecord.user_id,
      employee_id: id,
      role: accessRole,
      full_name: name.trim(),
    },
    {
      onConflict: "user_id",
    }
  );

if (profileError) {
  setError(profileError.message);
  return;
}
    router.push(`/team/${id}`);
    router.refresh();
  }

  async function updateStatus(status: "active" | "inactive") {
    if (!canManageMember || statusBusy) return;
    setStatusBusy(true);
    setError("");
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setError("Your session has expired.");
      setStatusBusy(false);
      return;
    }
    try {
      const response = await fetch(`/api/team/${id}/status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      const result = (await response.json()) as {
        error?: string;
        employee?: { status: string };
      };
      if (!response.ok || !result.employee) {
        setError(result.error || "Unable to update employee status.");
        return;
      }
      setMember((current) =>
        current
          ? { ...current, status: result.employee?.status || status }
          : current,
      );
      router.push(`/team/${id}`);
    } catch {
      setError("Unable to update employee status.");
    } finally {
      setStatusBusy(false);
    }
  }

  async function sendPasswordReset() {
    if (!canManageMember || !member?.email || passwordResetBusy) return;
    setPasswordResetBusy(true);
    setError("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setError("Your session has expired.");
        return;
      }

      const response = await fetch(`/api/team/${id}/password-reset`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = (await response.json()) as {
        error?: string;
        success?: boolean;
      };
      if (!response.ok || !result.success) {
        setError(result.error || "Unable to send password reset email.");
        return;
      }
      setError("Password reset email sent.");
    } catch {
      setError("Unable to send password reset email.");
    } finally {
      setPasswordResetBusy(false);
    }
  }

  async function deleteMember() {
    if (!canManageMember || deleteBusy) return;
    setDeleteBusy(true);
    setError("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setError("Your session has expired.");
        return;
      }

      const response = await fetch(`/api/team/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = (await response.json()) as {
        error?: string;
        success?: boolean;
      };
      if (!response.ok || !result.success) {
        setError(result.error || "Unable to delete this employee.");
        return;
      }
      router.push("/team");
      router.refresh();
    } catch {
      setError("Unable to delete this employee.");
    } finally {
      setDeleteBusy(false);
    }
  }

  if (loading)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-sm font-semibold text-slate-500">
        Loading employee analytics...
      </main>
    );
  if (accessDenied)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6">
        <div className="rounded-3xl border border-red-100 bg-white p-8 text-center shadow-xl">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="mt-2 text-sm text-slate-500">
            You cannot view this employee’s analytics.
          </p>
        </div>
      </main>
    );
  if (!analytics || !member)
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-red-600">
        Employee not found.
      </main>
    );

  const adminActions = canManageMember ? (
    <div className="flex flex-wrap gap-2">
      <Link
        href={`/team/${id}?action=edit`}
        className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-center text-xs font-bold text-slate-950"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={() => void sendPasswordReset()}
        disabled={passwordResetBusy}
        className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {passwordResetBusy ? "Sending..." : "Reset Password"}
      </button>
      <button
        type="button"
        onClick={() =>
          router.push(
            `/team/${id}?action=${member.status === "active" ? "deactivate" : "activate"}`,
          )
        }
        className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold"
      >
        {member.status === "active" ? "Deactivate Employee" : "Activate Employee"}
      </button>
      <button
        type="button"
        onClick={() => router.push(`/team/${id}?action=delete`)}
        className="rounded-xl border border-red-300/40 bg-red-500/15 px-4 py-2 text-xs font-bold text-red-100"
      >
        Delete Employee
      </button>
    </div>
  ) : null;

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-5 py-7 sm:px-8">
      <div className="mx-auto max-w-[1450px]">
        <Link
          href="/team"
          className="mb-5 text-sm font-bold text-slate-500 hover:text-[#153E90]"
        >
          ← Back to Team
        </Link>
        <EmployeeHeader analytics={analytics} actions={adminActions} />
        <EmployeeProfileDetails
          employee={member}
          accessRole={accessRole}
          panNumber={panNumber}
          aadhaarNumber={aadhaarNumber}
          showStatutoryDetails={isAdmin}
        />
        {error ? (
          <div
            role="status"
            className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${error.includes("sent") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}
          >
            {error}
          </div>
        ) : null}
        {action === "edit" && canManageMember ? (
          <AdminEditForm
            employeeCode={employeeCode}
            setEmployeeCode={setEmployeeCode}
            title={title}
            setTitle={setTitle}
            name={name}
            setName={setName}
            gender={gender}
            setGender={setGender}
            email={email}
            setEmail={setEmail}
            memberRole={memberRole}
            setMemberRole={setMemberRole}
            department={department}
            setDepartment={setDepartment}
            dateOfJoining={dateOfJoining}
            setDateOfJoining={setDateOfJoining}
            dateOfBirth={dateOfBirth}
            setDateOfBirth={setDateOfBirth}
            epfNumber={epfNumber}
            setEpfNumber={setEpfNumber}
            uanNumber={uanNumber}
            setUanNumber={setUanNumber}
            panNumber={panNumber}
            setPanNumber={setPanNumber}
            aadhaarNumber={aadhaarNumber}
            setAadhaarNumber={setAadhaarNumber}
            reportingManagerId={reportingManagerId}
            setReportingManagerId={setReportingManagerId}
            reportingManagers={reportingManagers}
            accessRole={accessRole}
            setAccessRole={setAccessRole}
            canAssignSuperAdmin={isSuperAdmin}
            onSave={() => void saveMember()}
            onCancel={() => router.push(`/team/${id}`)}
          />
        ) : null}
        {action === "deactivate" && canManageMember ? (
          <Confirmation
            text="Deactivate this team member?"
            confirm="Deactivate"
            tone="red"
            busy={statusBusy}
            onConfirm={() => void updateStatus("inactive")}
            onCancel={() => router.push(`/team/${id}`)}
          />
        ) : null}
        {action === "activate" && canManageMember ? (
          <Confirmation
            text="Activate this team member?"
            confirm="Activate"
            tone="green"
            busy={statusBusy}
            onConfirm={() => void updateStatus("active")}
            onCancel={() => router.push(`/team/${id}`)}
          />
        ) : null}
        {action === "delete" && canManageMember ? (
          <Confirmation
            text="Permanently delete this team member? Employees with time history must be deactivated instead so payroll and audit records remain intact."
            confirm="Delete Employee"
            tone="red"
            busy={deleteBusy}
            onConfirm={() => void deleteMember()}
            onCancel={() => router.push(`/team/${id}`)}
          />
        ) : null}
        <div className="mt-6 flex justify-end">
          <EmployeePeriodFilter
            period={period}
            from={customFrom}
            to={customTo}
            onPeriod={setPeriod}
            onFrom={setCustomFrom}
            onTo={setCustomTo}
          />
        </div>
        <div className="mt-7 space-y-7">
          <EmployeeStats analytics={analytics} />
          <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
            <EmployeeTimeline entries={entries} />
            <div className="space-y-6">
              <ProjectSummary entries={entries} />
              <ClientSummary entries={entries} />
            </div>
          </section>
          <EmployeeCharts entries={entries} from={range.from} to={range.to} />
        </div>
      </div>
    </main>
  );
}

function EmployeeProfileDetails({
  employee,
  accessRole,
  panNumber,
  aadhaarNumber,
  showStatutoryDetails,
}: {
  employee: TeamEmployee;
  accessRole: string;
  panNumber: string;
  aadhaarNumber: string;
  showStatutoryDetails: boolean;
}) {
  const details = [
    ["Employee Code", employee.employee_code || "—"],
    ["Title", employee.title || "—"],
    ["Employee Name", employee.name],
    ["Gender", employee.gender || "—"],
    ["Email Address", employee.email],
    ["Role", employee.role || "—"],
    ["Department", employee.department || "—"],
    ["Date of Joining", formatProfileDate(employee.date_of_joining)],
    ["Date of Birth", formatProfileDate(employee.date_of_birth)],
    ["EPF Number", employee.epf_number || "—"],
    ["UAN Number", employee.uan_number || "—"],
    ...(showStatutoryDetails
      ? [
          ["PAN Number", panNumber || "—"],
          ["Aadhaar Number", maskAadhaar(aadhaarNumber)],
        ]
      : []),
    [
      "Reporting Manager",
      employee.reporting_manager
        ? `${employee.reporting_manager.title ? `${employee.reporting_manager.title} ` : ""}${employee.reporting_manager.name}`
        : "—",
    ],
    ["Access Type", accessRole],
  ];

  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">Employee details</h2>
      <div className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
  );
}

function maskAadhaar(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "—";
  return `•••• •••• ${digits.slice(-4)}`;
}

function formatProfileDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default function TeamDetailPage() {
  return (
    <Suspense fallback={null}>
      <TeamDetailPageContent />
    </Suspense>
  );
}

type Setter = (value: string) => void;
function AdminEditForm(props: {
  employeeCode: string;
  setEmployeeCode: Setter;
  title: string;
  setTitle: Setter;
  name: string;
  setName: Setter;
  gender: string;
  setGender: Setter;
  email: string;
  setEmail: Setter;
  memberRole: string;
  setMemberRole: Setter;
  department: string;
  setDepartment: Setter;
  dateOfJoining: string;
  setDateOfJoining: Setter;
  dateOfBirth: string;
  setDateOfBirth: Setter;
  epfNumber: string;
  setEpfNumber: Setter;
  uanNumber: string;
  setUanNumber: Setter;
  panNumber: string;
  setPanNumber: Setter;
  aadhaarNumber: string;
  setAadhaarNumber: Setter;
  reportingManagerId: string;
  setReportingManagerId: Setter;
  reportingManagers: ReportingManagerOption[];
  accessRole: string;
  setAccessRole: Setter;
  canAssignSuperAdmin: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="mt-6 rounded-3xl border border-blue-100 bg-white p-6 shadow-lg">
      <h2 className="text-xl font-bold">Edit employee</h2>
      <p className="mt-1 text-sm text-slate-500">
        Employment details are retained for future time-off and payroll
        modules.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Input
          label="Employee Code"
          value={props.employeeCode}
          onChange={props.setEmployeeCode}
          required
        />
        <SelectField
          label="Title"
          value={props.title}
          onChange={props.setTitle}
        >
          <option value="Mr">Mr</option>
          <option value="Miss">Miss</option>
          <option value="Mrs.">Mrs.</option>
          <option value="Dr">Dr</option>
        </SelectField>
        <Input
          label="Employee Name"
          value={props.name}
          onChange={props.setName}
          required
        />
        <SelectField
          label="Gender"
          value={props.gender}
          onChange={props.setGender}
        >
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Others">Others</option>
        </SelectField>
        <Input
          label="Email Address"
          value={props.email}
          onChange={props.setEmail}
          type="email"
          required
        />
        <Input
          label="Role"
          value={props.memberRole}
          onChange={props.setMemberRole}
        />
        <SelectField
          label="Department"
          value={props.department}
          onChange={props.setDepartment}
        >
          <option value="">Select department</option>
          {EMPLOYEE_DEPARTMENTS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </SelectField>
        <Input
          label="Date of Joining"
          value={props.dateOfJoining}
          onChange={props.setDateOfJoining}
          type="date"
        />
        <Input
          label="Date of Birth"
          value={props.dateOfBirth}
          onChange={props.setDateOfBirth}
          type="date"
        />
        <Input
          label="EPF Number"
          value={props.epfNumber}
          onChange={props.setEpfNumber}
        />
        <Input
          label="UAN Number"
          value={props.uanNumber}
          onChange={props.setUanNumber}
        />
        <Input
          label="PAN Number"
          value={props.panNumber}
          onChange={(value) => props.setPanNumber(value.toUpperCase())}
          maxLength={10}
          autoCapitalize="characters"
          autoComplete="off"
        />
        <Input
          label="Aadhaar Number"
          value={props.aadhaarNumber}
          onChange={(value) =>
            props.setAadhaarNumber(value.replace(/\D/g, "").slice(0, 12))
          }
          maxLength={12}
          inputMode="numeric"
          autoComplete="off"
        />
        <SelectField
          label="Reporting Manager"
          value={props.reportingManagerId}
          onChange={props.setReportingManagerId}
        >
          <option value="">No reporting manager</option>
          {props.reportingManagers.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.name} · {manager.access_role}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Access Type"
          value={props.accessRole}
          onChange={props.setAccessRole}
        >
          <option value="Employee">Employee</option>
          <option value="Manager">Manager</option>
          <option value="Admin">Admin</option>
          {props.canAssignSuperAdmin ? (
            <option value="Super Admin">Super Admin</option>
          ) : null}
        </SelectField>
      </div>
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          data-shortcut-save
          data-shortcut-primary
          aria-keyshortcuts="Control+S Meta+S Control+Enter Meta+Enter"
          onClick={props.onSave}
          className="rounded-xl bg-[#153E90] px-5 py-2.5 font-bold text-white"
        >
          Save
        </button>
        <button
          type="button"
          onClick={props.onCancel}
          className="rounded-xl border border-slate-200 px-5 py-2.5 font-bold"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
function Confirmation({
  text,
  confirm,
  tone,
  onConfirm,
  onCancel,
  busy = false,
}: {
  text: string;
  confirm: string;
  tone: "red" | "green";
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
      <p className="font-semibold text-slate-700">{text}</p>
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={`rounded-xl px-5 py-2.5 font-bold text-white ${tone === "red" ? "bg-red-600" : "bg-emerald-600"}`}
        >
          {busy ? "Updating..." : confirm}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-200 px-5 py-2.5 font-bold"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
function Input({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  maxLength,
  inputMode,
  autoCapitalize,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: Setter;
  type?: string;
  required?: boolean;
  maxLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoCapitalize?: string;
  autoComplete?: string;
}) {
  return (
    <label className="space-y-1.5 text-sm font-semibold text-slate-700">
      <span>
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        maxLength={maxLength}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        className="h-12 w-full rounded-2xl border border-slate-200 px-4 font-normal outline-none focus:border-blue-400"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: Setter;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 font-normal outline-none focus:border-blue-400"
      >
        {children}
      </select>
    </label>
  );
}
