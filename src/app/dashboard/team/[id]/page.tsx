"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
  TeamEmployee,
  TeamEntry,
  TeamProfile,
  TeamTimer,
} from "@/components/team/types";
import { dateRange, employeeAnalytics } from "@/components/team/utils";

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
  const [employeeCode, setEmployeeCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [department, setDepartment] = useState("");
  const [hourlyCost, setHourlyCost] = useState("");
  const [accessRole, setAccessRole] = useState("Employee");
  const role = String(profile?.role || "")
    .trim()
    .toLowerCase();
  const isAdmin = role === "admin";
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
        (currentRole === "employee" && current.employee_id !== id)
      ) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      const [memberResult, timerResult, accessResult] = await Promise.all([
        supabase
          .from("employees")
          .select(
            "id,employee_code,name,email,role,department,status,hourly_cost",
          )
          .eq("id", id)
          .single(),
        supabase
          .from("active_timers")
          .select(
            "id,employee_id,project_id,started_at,paused_at,total_paused_seconds,status,description,projects(id,name,project_code,clients(id,name))",
          )
          .eq("employee_id", id)
          .in("status", ["running", "paused"])
          .maybeSingle(),
        currentRole === "admin"
          ? supabase
              .from("profiles")
              .select("role")
              .eq("employee_id", id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (memberResult.error || !memberResult.data) {
        setError(memberResult.error?.message || "Employee not found.");
        setLoading(false);
        return;
      }
      const loaded = memberResult.data as TeamEmployee;
      if (
        currentRole !== "admin" &&
        String(loaded.status || "").trim().toLowerCase() !== "active"
      ) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      setMember(loaded);
      setTimer((timerResult.data || null) as unknown as TeamTimer | null);
      setAccessRole(accessResult.data?.role || "Employee");
      setEmployeeCode(loaded.employee_code || "");
      setName(loaded.name);
      setEmail(loaded.email);
      setMemberRole(loaded.role || "");
      setDepartment(loaded.department || "");
      setHourlyCost(String(loaded.hourly_cost || 0));
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
          "id,employee_id,project_id,entry_date,started_at,stopped_at,hours,description,projects(id,name,project_code,clients(id,name))",
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
    if (!isAdmin) return;
    const { error: employeeError } = await supabase
      .from("employees")
      .update({
        employee_code: employeeCode || null,
        name,
        email,
        role: memberRole || null,
        department: department || null,
        hourly_cost: Number(hourlyCost || 0),
      })
      .eq("id", id);
    if (employeeError) {
      setError(employeeError.message);
      return;
    }
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ role: accessRole, full_name: name })
      .eq("employee_id", id);
    if (profileError) {
      setError(profileError.message);
      return;
    }
    router.push(`/dashboard/team/${id}`);
    router.refresh();
  }

  async function updateStatus(status: "active" | "inactive") {
    if (!isAdmin || statusBusy) return;
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
      router.push(`/dashboard/team/${id}`);
    } catch {
      setError("Unable to update employee status.");
    } finally {
      setStatusBusy(false);
    }
  }

  async function sendPasswordReset() {
    if (!isAdmin || !member?.email) return;
    const result = await supabase.functions.invoke("send-password-reset", {
      body: { email: member.email },
    });
    setError(
      result.error ? result.error.message : "Password reset email sent.",
    );
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

  const adminActions = isAdmin ? (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => router.push(`/dashboard/team/${id}?action=edit`)}
        className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-950"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={() => void sendPasswordReset()}
        className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold"
      >
        Reset Password
      </button>
      <button
        type="button"
        onClick={() =>
          router.push(
            `/dashboard/team/${id}?action=${member.status === "active" ? "deactivate" : "activate"}`,
          )
        }
        className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold"
      >
        {member.status === "active" ? "Deactivate Employee" : "Activate Employee"}
      </button>
    </div>
  ) : null;

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-5 py-7 sm:px-8">
      <div className="mx-auto max-w-[1450px]">
        <button
          type="button"
          onClick={() => router.push("/dashboard/team")}
          className="mb-5 text-sm font-bold text-slate-500 hover:text-[#153E90]"
        >
          ← Back to Team
        </button>
        <EmployeeHeader analytics={analytics} actions={adminActions} />
        {error ? (
          <div
            role="status"
            className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${error.includes("sent") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}
          >
            {error}
          </div>
        ) : null}
        {action === "edit" && isAdmin ? (
          <AdminEditForm
            employeeCode={employeeCode}
            setEmployeeCode={setEmployeeCode}
            name={name}
            setName={setName}
            email={email}
            setEmail={setEmail}
            memberRole={memberRole}
            setMemberRole={setMemberRole}
            department={department}
            setDepartment={setDepartment}
            hourlyCost={hourlyCost}
            setHourlyCost={setHourlyCost}
            accessRole={accessRole}
            setAccessRole={setAccessRole}
            onSave={() => void saveMember()}
            onCancel={() => router.push(`/dashboard/team/${id}`)}
          />
        ) : null}
        {action === "deactivate" && isAdmin ? (
          <Confirmation
            text="Deactivate this team member?"
            confirm="Deactivate"
            tone="red"
            busy={statusBusy}
            onConfirm={() => void updateStatus("inactive")}
            onCancel={() => router.push(`/dashboard/team/${id}`)}
          />
        ) : null}
        {action === "activate" && isAdmin ? (
          <Confirmation
            text="Activate this team member?"
            confirm="Activate"
            tone="green"
            busy={statusBusy}
            onConfirm={() => void updateStatus("active")}
            onCancel={() => router.push(`/dashboard/team/${id}`)}
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
  name: string;
  setName: Setter;
  email: string;
  setEmail: Setter;
  memberRole: string;
  setMemberRole: Setter;
  department: string;
  setDepartment: Setter;
  hourlyCost: string;
  setHourlyCost: Setter;
  accessRole: string;
  setAccessRole: Setter;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="mt-6 rounded-3xl border border-blue-100 bg-white p-6 shadow-lg">
      <h2 className="text-xl font-bold">Edit employee</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Input
          value={props.employeeCode}
          onChange={props.setEmployeeCode}
          placeholder="Employee code"
        />
        <Input value={props.name} onChange={props.setName} placeholder="Name" />
        <Input
          value={props.email}
          onChange={props.setEmail}
          placeholder="Email"
        />
        <Input
          value={props.memberRole}
          onChange={props.setMemberRole}
          placeholder="Role"
        />
        <Input
          value={props.department}
          onChange={props.setDepartment}
          placeholder="Department"
        />
        <Input
          value={props.hourlyCost}
          onChange={props.setHourlyCost}
          placeholder="Hourly cost"
          type="number"
        />
        <select
          value={props.accessRole}
          onChange={(event) => props.setAccessRole(event.target.value)}
          className="rounded-2xl border border-slate-200 px-4 py-3"
        >
          <option>Employee</option>
          <option>Manager</option>
          <option>Admin</option>
        </select>
      </div>
      <div className="mt-5 flex gap-3">
        <button
          type="button"
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
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: Setter;
  placeholder: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400"
    />
  );
}
