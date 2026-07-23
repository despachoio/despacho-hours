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
import {
  emptyEmployeeProfileChanges,
  validateEmployeeProfileChanges,
  type EmployeeProfileChanges,
} from "@/lib/employee-profile";
import {
  EmployeeProfileDetailsSections,
  EmployeeProfileFormSections,
} from "@/components/team/EmployeeProfileSections";

type EditSnapshot = {
  value: EmployeeProfileChanges;
  reportingManagerId: string;
  accessRole: string;
};

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
  const [saving, setSaving] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState<EditSnapshot | null>(null);
  const [employeeCode, setEmployeeCode] = useState("");
  const [title, setTitle] = useState("Mr");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("Male");
  const [email, setEmail] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [level, setLevel] = useState("");
  const [department, setDepartment] = useState("");
  const [dateOfJoining, setDateOfJoining] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [epfNumber, setEpfNumber] = useState("");
  const [uanNumber, setUanNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [extendedDetails, setExtendedDetails] =
    useState<EmployeeProfileChanges>(emptyEmployeeProfileChanges);
  const [reportingManagerId, setReportingManagerId] = useState("");
  const [reportingManagers, setReportingManagers] = useState<
    ReportingManagerOption[]
  >([]);
  const [accessRole, setAccessRole] = useState("Employee");
  const role = String(profile?.role || "")
    .trim()
    .toLowerCase();
  const isFinanceAdmin = role === "finance admin";
  const isSuperAdmin = isFinanceAdmin || role === "super admin";
  const isAdmin = isSuperAdmin || role === "admin";
  const canManageMember =
    isAdmin &&
    (isFinanceAdmin ||
      (role === "super admin" && accessRole !== "Finance Admin") ||
      (role === "admin" &&
        !["Super Admin", "Finance Admin"].includes(accessRole)));
  const employeeProfileValue: EmployeeProfileChanges = {
    ...extendedDetails,
    employee_code: employeeCode,
    title,
    name,
    gender,
    email,
    role: memberRole || null,
    level: level || null,
    department: department || null,
    date_of_joining: dateOfJoining || null,
    date_of_birth: dateOfBirth || null,
    epf_number: epfNumber || null,
    uan_number: uanNumber || null,
    pan_number: panNumber || null,
    aadhaar_number: aadhaarNumber || null,
  };
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
      if (!current) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      if (
        currentRole === "employee" &&
        current.employee_id !== id
      ) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      let memberData: Omit<TeamEmployee, "reporting_manager"> | null = null;
      if (
        currentRole === "manager" &&
        current.employee_id !== id
      ) {
        const metricEmployees = await supabase.rpc(
          "get_team_metric_employees",
        );
        if (!metricEmployees.error) {
          memberData =
            (
              (metricEmployees.data || []) as Array<
                Omit<TeamEmployee, "reporting_manager">
              >
            ).find((employee) => employee.id === id) || null;
        }
        if (metricEmployees.error || !memberData) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }
      } else {
        const memberResult = await supabase
          .from("employees")
          .select(
            "id,employee_code,title,name,gender,email,role,level,department,date_of_joining,date_of_birth,epf_number,uan_number,reporting_manager_id,status,hourly_cost",
          )
          .eq("id", id)
          .single();
        if (memberResult.error || !memberResult.data) {
          setError(memberResult.error?.message || "Employee not found.");
          setLoading(false);
          return;
        }
        memberData = memberResult.data as unknown as Omit<
          TeamEmployee,
          "reporting_manager"
        >;
      }

      const rawMember = memberData as Omit<
        TeamEmployee,
        "reporting_manager"
      >;
      const loaded: TeamEmployee = {
        ...rawMember,
        reporting_manager: null,
      };
      if (
        (!["finance admin", "super admin", "admin"].includes(currentRole) &&
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
      setLevel(loaded.level || "");
      setDepartment(loaded.department || "");
      setDateOfJoining(loaded.date_of_joining || "");
      setDateOfBirth(loaded.date_of_birth || "");
      setEpfNumber(loaded.epf_number || "");
      setUanNumber(loaded.uan_number || "");
      setReportingManagerId(loaded.reporting_manager_id || "");
      if (["finance admin", "admin", "super admin"].includes(currentRole)) {
        const [
          managerResult,
          statutoryResult,
          extendedResult,
          financeResult,
          benefitResult,
        ] =
          await Promise.all([
          supabase.rpc("get_reporting_manager_options"),
          supabase
            .from("employee_statutory_details")
            .select("pan_number,aadhaar_number")
            .eq("employee_id", id)
            .maybeSingle(),
          supabase
            .from("employee_extended_details")
            .select(
              "phone_country_code,phone_number,marital_status,blood_group,bank_account_number,bank_name,ifsc_code,branch_name,address_line_1,address_line_2,address_line_3,city,state,country,pincode,father_name,mother_name,spouse_name,children,emergency_contact_person,emergency_contact_number,nominee_name,nominee_relationship,nominee_date_of_birth",
            )
            .eq("employee_id", id)
            .maybeSingle(),
          currentRole === "finance admin"
            ? supabase
                .from("employee_finance_details")
                .select(
                  "epf_number,uan_number,bank_account_number,bank_name,ifsc_code,branch_name",
                )
                .eq("employee_id", id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          supabase
            .from("employee_benefit_details")
            .select(
              "accidental_policy_number,accidental_policy_expiration_date,health_policy_number,health_policy_expiration_date",
            )
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
        if (extendedResult.error) {
          setError(extendedResult.error.message);
        } else {
          setExtendedDetails({
            ...emptyEmployeeProfileChanges(),
            ...extendedResult.data,
            ...financeResult.data,
            ...benefitResult.data,
            children: Array.isArray(extendedResult.data?.children)
              ? extendedResult.data.children.map((child) =>
                  String(child || ""),
                )
              : [],
          });
        }
        if (financeResult.error) {
          setError(financeResult.error.message);
        } else if (financeResult.data) {
          setEpfNumber(financeResult.data.epf_number || "");
          setUanNumber(financeResult.data.uan_number || "");
        }
        if (benefitResult.error) {
          setError(benefitResult.error.message);
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

  function updateProfileField<K extends keyof EmployeeProfileChanges>(
    key: K,
    value: EmployeeProfileChanges[K],
  ) {
    if (key === "employee_code") setEmployeeCode(String(value || ""));
    else if (key === "title") setTitle(String(value || ""));
    else if (key === "name") setName(String(value || ""));
    else if (key === "gender") setGender(String(value || ""));
    else if (key === "email") setEmail(String(value || ""));
    else if (key === "role") setMemberRole(String(value || ""));
    else if (key === "level") setLevel(String(value || ""));
    else if (key === "department") setDepartment(String(value || ""));
    else if (key === "date_of_joining") setDateOfJoining(String(value || ""));
    else if (key === "date_of_birth") setDateOfBirth(String(value || ""));
    else if (key === "epf_number") setEpfNumber(String(value || ""));
    else if (key === "uan_number") setUanNumber(String(value || ""));
    else if (key === "pan_number") setPanNumber(String(value || ""));
    else if (key === "aadhaar_number") setAadhaarNumber(String(value || ""));
    else
      setExtendedDetails((current) => ({
        ...current,
        [key]: value,
      }));
  }

  function applyProfileValue(value: EmployeeProfileChanges) {
    setEmployeeCode(value.employee_code || "");
    setTitle(value.title || "Mr");
    setName(value.name || "");
    setGender(value.gender || "Male");
    setEmail(value.email || "");
    setMemberRole(value.role || "");
    setLevel(value.level || "");
    setDepartment(value.department || "");
    setDateOfJoining(value.date_of_joining || "");
    setDateOfBirth(value.date_of_birth || "");
    setEpfNumber(value.epf_number || "");
    setUanNumber(value.uan_number || "");
    setPanNumber(value.pan_number || "");
    setAadhaarNumber(value.aadhaar_number || "");
    setExtendedDetails({
      ...emptyEmployeeProfileChanges(),
      ...value,
      children: [...value.children],
    });
  }

  function beginEditing() {
    setEditSnapshot({
      value: {
        ...employeeProfileValue,
        children: [...employeeProfileValue.children],
      },
      reportingManagerId,
      accessRole,
    });
    setError("");
    router.push(`/team/${id}?action=edit`);
  }

  function cancelEditing() {
    if (editSnapshot) {
      applyProfileValue(editSnapshot.value);
      setReportingManagerId(editSnapshot.reportingManagerId);
      setAccessRole(editSnapshot.accessRole);
    }
    setEditSnapshot(null);
    setError("");
    router.push(`/team/${id}`);
  }

  async function saveMember() {
    if (!canManageMember || saving) return;
    const validation = validateEmployeeProfileChanges(employeeProfileValue);
    if ("error" in validation) {
      setError(validation.error || "Enter valid employee details.");
      return;
    }
    const normalized = validation.value;
    setSaving(true);
    setError("");
    try {
    const { error: employeeError } = await supabase
      .from("employees")
      .update({
        employee_code: normalized.employee_code,
        title: normalized.title,
        name: normalized.name,
        gender: normalized.gender,
        email: normalized.email,
        role: normalized.role,
        level: normalized.level,
        department: normalized.department,
        date_of_joining: normalized.date_of_joining,
        date_of_birth: normalized.date_of_birth,
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
          pan_number: normalized.pan_number,
          aadhaar_number: normalized.aadhaar_number,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "employee_id" },
      );
    if (statutoryError) {
      setError(statutoryError.message);
      return;
    }
    const { error: extendedError } = await supabase
      .from("employee_extended_details")
      .upsert(
        {
          employee_id: id,
          phone_country_code: normalized.phone_country_code,
          phone_number: normalized.phone_number,
          marital_status: normalized.marital_status,
          blood_group: normalized.blood_group,
          address_line_1: normalized.address_line_1,
          address_line_2: normalized.address_line_2,
          address_line_3: normalized.address_line_3,
          city: normalized.city,
          state: normalized.state,
          country: normalized.country,
          pincode: normalized.pincode,
          father_name: normalized.father_name,
          mother_name: normalized.mother_name,
          spouse_name: normalized.spouse_name,
          children: normalized.children,
          emergency_contact_person: normalized.emergency_contact_person,
          emergency_contact_number: normalized.emergency_contact_number,
          nominee_name: normalized.nominee_name,
          nominee_relationship: normalized.nominee_relationship,
          nominee_date_of_birth: normalized.nominee_date_of_birth,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "employee_id" },
      );
    if (extendedError) {
      setError(extendedError.message);
      return;
    }
    if (isFinanceAdmin) {
      const { error: financeError } = await supabase
        .from("employee_finance_details")
        .upsert(
          {
            employee_id: id,
            epf_number: normalized.epf_number,
            uan_number: normalized.uan_number,
            bank_account_number: normalized.bank_account_number,
            bank_name: normalized.bank_name,
            ifsc_code: normalized.ifsc_code,
            branch_name: normalized.branch_name,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "employee_id" },
        );
      if (financeError) {
        setError(financeError.message);
        return;
      }
      const { error: benefitError } = await supabase
        .from("employee_benefit_details")
        .upsert(
          {
            employee_id: id,
            accidental_policy_number:
              normalized.accidental_policy_number,
            accidental_policy_expiration_date:
              normalized.accidental_policy_expiration_date,
            health_policy_number: normalized.health_policy_number,
            health_policy_expiration_date:
              normalized.health_policy_expiration_date,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "employee_id" },
        );
      if (benefitError) {
        setError(benefitError.message);
        return;
      }
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
    const selectedManager = reportingManagers.find(
      (manager) => manager.id === reportingManagerId,
    );
    applyProfileValue(normalized);
    setMember((current) =>
      current
        ? {
            ...current,
            employee_code: normalized.employee_code,
            title: normalized.title,
            name: normalized.name,
            gender: normalized.gender,
            email: normalized.email,
            role: normalized.role,
            level: normalized.level,
            department: normalized.department,
            date_of_joining: normalized.date_of_joining,
            date_of_birth: normalized.date_of_birth,
            reporting_manager_id: reportingManagerId || null,
            reporting_manager: selectedManager
              ? {
                  id: selectedManager.id,
                  name: selectedManager.name,
                  title: null,
                }
              : null,
          }
        : current,
    );
    setEditSnapshot(null);
    setError("Employee details updated.");
    router.push(`/team/${id}`);
    router.refresh();
    } catch {
      setError("Unable to save employee details right now.");
    } finally {
      setSaving(false);
    }
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
    action === "edit" ? (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-shortcut-save
          data-shortcut-primary
          aria-keyshortcuts="Control+S Meta+S Control+Enter Meta+Enter"
          onClick={() => void saveMember()}
          disabled={saving}
          className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-2.5 text-center text-xs font-bold text-slate-950 shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={cancelEditing}
          disabled={saving}
          className="rounded-xl border border-white/25 bg-white/10 px-5 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    ) : (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={beginEditing}
        className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-center text-xs font-bold text-slate-950"
      >
        Edit
      </button>
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
    )
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
        {isAdmin ? (
          action === "edit" && canManageMember ? (
            <div className="mt-6">
              <EmployeeProfileFormSections
                value={employeeProfileValue}
                onChange={updateProfileField}
                showFinanceDetails={isFinanceAdmin}
                benefitsReadOnly={!isFinanceAdmin}
                joiningExtras={
                  <>
                    <ProfileSelectField
                      label="Reporting Manager"
                      value={reportingManagerId}
                      onChange={setReportingManagerId}
                    >
                      <option value="">No reporting manager</option>
                      {reportingManagers.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name} · {manager.access_role}
                        </option>
                      ))}
                    </ProfileSelectField>
                    <ProfileSelectField
                      label="Access Type"
                      value={accessRole}
                      onChange={setAccessRole}
                    >
                      <option value="Employee">Employee</option>
                      <option value="Manager">Manager</option>
                      <option value="Admin">Admin</option>
                      {isSuperAdmin ? (
                        <option value="Super Admin">Super Admin</option>
                      ) : null}
                      {isFinanceAdmin ? (
                        <option value="Finance Admin">Finance Admin</option>
                      ) : null}
                    </ProfileSelectField>
                  </>
                }
              />
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  data-shortcut-save
                  data-shortcut-primary
                  aria-keyshortcuts="Control+S Meta+S Control+Enter Meta+Enter"
                  onClick={() => void saveMember()}
                  disabled={saving}
                  className="rounded-2xl bg-[#153E90] px-6 py-3 text-sm font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={saving}
                  className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <EmployeeProfileDetailsSections
              value={employeeProfileValue}
              showFinanceDetails={isFinanceAdmin}
              reportingManager={
                member.reporting_manager
                  ? `${member.reporting_manager.title ? `${member.reporting_manager.title} ` : ""}${member.reporting_manager.name}`
                  : "—"
              }
              accessRole={accessRole}
              status={member.status}
            />
          )
        ) : null}
        {error ? (
          <div
            role="status"
            className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${error.includes("sent") || error.includes("updated") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}
          >
            {error}
          </div>
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

export default function TeamDetailPage() {
  return (
    <Suspense fallback={null}>
      <TeamDetailPageContent />
    </Suspense>
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
function ProfileSelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="text-sm font-semibold text-slate-700">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-normal text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
      >
        {children}
      </select>
    </label>
  );
}
