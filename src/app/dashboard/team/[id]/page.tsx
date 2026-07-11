"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter, useSearchParams } from "next/navigation";

type ProjectResource = {
  id: string;
  projects: {
    id: string;
    name: string;
    project_code: string | null;
    status: string;
    clients: {
      name: string;
    } | null;
  } | null;
};

type TimeEntry = {
  id: string;
  entry_date: string;
  hours: number;
  description: string | null;
  projects: {
    id: string;
    name: string;
    project_code: string | null;
    clients: {
      name: string;
    } | null;
  } | null;
};

type TeamMember = {
  id: string;
  user_id: string | null;
  employee_code: string | null;
  name: string;
  email: string;
  role: string | null;
  department: string | null;
  status: string | null;
  hourly_cost: number | null;
  project_resources: ProjectResource[];
  time_entries: TimeEntry[];
};

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const memberId = params.id as string;
  const action = searchParams.get("action");

  const [userRole, setUserRole] = useState("");
  const [member, setMember] = useState<TeamMember | null>(null);

  const [employeeCode, setEmployeeCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [department, setDepartment] = useState("");
  const [hourlyCost, setHourlyCost] = useState("");
  const [accessRole, setAccessRole] = useState("Employee");

  async function loadMember() {
    const { data: userData } = await supabase.auth.getUser();

    if (userData.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", userData.user.id)
        .single();

      setUserRole(profile?.role || "");
    }

    const { data, error } = await supabase
      .from("employees")
      .select(`
        *,
        project_resources (
          id,
          projects (
            id,
            name,
            project_code,
            status,
            clients (
              name
            )
          )
        ),
        time_entries (
          id,
          entry_date,
          hours,
          description,
          projects (
            id,
            name,
            project_code,
            clients (
              name
            )
          )
        )
      `)
      .eq("id", memberId)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    if (data) {
      setMember(data as TeamMember);
      setEmployeeCode(data.employee_code || "");
      setName(data.name || "");
      setEmail(data.email || "");
      setMemberRole(data.role || "");
      setDepartment(data.department || "");
      setHourlyCost(String(data.hourly_cost || 0));
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("role")
      .eq("employee_id", memberId)
      .single();

    setAccessRole(profileData?.role || "Employee");
  }

  async function saveMember() {
    if (userRole !== "Admin") return;

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
      .eq("id", memberId);

    if (employeeError) {
      alert(employeeError.message);
      console.error(employeeError);
      return;
    }

    const { data: profileRows, error: findProfileError } = await supabase
      .from("profiles")
      .select("id, user_id, employee_id, role")
      .eq("employee_id", memberId);

    if (findProfileError) {
      alert(findProfileError.message);
      console.error(findProfileError);
      return;
    }

    console.log("Matching profile:", profileRows);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        role: accessRole,
        full_name: name,
      })
      .eq("employee_id", memberId);

    if (profileError) {
      alert(profileError.message);
      console.error(profileError);
      return;
    }

    router.push("/dashboard/team");
  }

  async function updateStatus(status: string) {
    if (userRole !== "Admin") return;

    const { error } = await supabase
      .from("employees")
      .update({ status })
      .eq("id", memberId);

    if (error) {
      alert(error.message);
      console.error(error);
      return;
    }

    router.push("/dashboard/team");
  }

  async function sendPasswordReset() {
    if (!member?.email) return;

    const { error } = await supabase.functions.invoke("send-password-reset", {
      body: {
        email: member.email,
      },
    });

    if (error) {
      alert(error.message);
      console.error(error);
      return;
    }

    alert("Password reset email sent.");
  }

  function formatDate(date: string) {
    return new Date(date)
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      .replace(/ /g, "-");
  }

  useEffect(() => {
    loadMember();
  }, []);

  if (!member) return null;

  return (
    <main className="min-h-screen bg-[#f8fafc] px-8 py-7">
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => router.push("/dashboard/team")}
          className="mb-6 text-sm font-medium text-slate-500"
        >
          ← Back to Team
        </button>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-slate-500">
              Employee Code: {member.employee_code || "Not set"}
            </p>

            <div className="mt-2 flex items-center gap-3">
              <h1 className="text-3xl font-bold">{member.name}</h1>

              <span
                className={`
                  rounded-full px-3 py-1 text-xs font-semibold
                  ${
                    member.status === "active"
                      ? "bg-green-100 text-green-700"
                      : member.status === "on_hold"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-slate-100 text-slate-600"
                  }
                `}
              >
                {member.status || "active"}
              </span>
            </div>
          </div>

          {!action && (
            <div className="mt-8 space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-2xl bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">Role</p>
                  <p className="mt-2 text-lg font-bold">{member.role || "-"}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">Department</p>
                  <p className="mt-2 text-lg font-bold">
                    {member.department || "-"}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">Hourly Cost</p>
                  <p className="mt-2 text-lg font-bold">
                    ₹{member.hourly_cost || 0}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-600">
                  Email: <span className="text-slate-950">{member.email}</span>
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-600">
                  Assigned Projects
                </p>

                <div className="mt-4 space-y-3">
                  {member.project_resources?.length ? (
                    member.project_resources.map((resource) => (
                      <div
                        key={resource.id}
                        className="flex items-center justify-between rounded-2xl bg-white p-4 ring-1 ring-slate-200"
                      >
                        <div>
                          <p className="font-bold">
                            [{resource.projects?.project_code}]{" "}
                            {resource.projects?.name}
                          </p>

                          <p className="text-sm text-slate-500">
                            {resource.projects?.clients?.name}
                          </p>

                          <span
                            className={`
                              mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold
                              ${
                                resource.projects?.status === "active"
                                  ? "bg-green-100 text-green-700"
                                  : resource.projects?.status === "archived"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-yellow-100 text-yellow-700"
                              }
                            `}
                          >
                            {resource.projects?.status}
                          </span>
                        </div>

                        <button
                          onClick={() =>
                            router.push(
                              `/dashboard/projects/${resource.projects?.id}`
                            )
                          }
                          className="rounded-xl border px-4 py-2 text-sm font-semibold"
                        >
                          View
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      No projects assigned.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-600">
                  Recent Time Entries
                </p>

                <div className="mt-4 space-y-3">
                  {member.time_entries?.length ? (
                    member.time_entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold">
                              [{entry.projects?.project_code}]{" "}
                              {entry.projects?.name}
                            </p>

                            <p className="text-sm text-slate-500">
                              {entry.projects?.clients?.name}
                            </p>

                            <p className="text-sm text-slate-500">
                              {formatDate(entry.entry_date)}
                            </p>
                          </div>

                          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">
                            {entry.hours} hrs
                          </span>
                        </div>

                        <p className="mt-3 text-sm text-slate-600">
                          {entry.description || "-"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      No time entries yet.
                    </p>
                  )}
                </div>
              </div>

              {userRole === "Admin" && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        "/dashboard/team/" + member.id + "?action=edit"
                      )
                    }
                    className="rounded-2xl border px-6 py-3 font-semibold"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={sendPasswordReset}
                    className="rounded-2xl border border-slate-200 px-6 py-3 font-semibold hover:bg-slate-50"
                  >
                    Send Password Reset
                  </button>

                  {member.status === "active" ? (
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          "/dashboard/team/" +
                            member.id +
                            "?action=deactivate"
                        )
                      }
                      className="rounded-2xl border border-red-100 px-6 py-3 font-semibold text-red-600"
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          "/dashboard/team/" +
                            member.id +
                            "?action=activate"
                        )
                      }
                      className="rounded-2xl border border-green-100 px-6 py-3 font-semibold text-green-700"
                    >
                      Activate
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {action === "edit" && userRole === "Admin" && (
            <div className="mt-8 space-y-5">
              <input
                placeholder="Employee code"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                className="w-full rounded-2xl border px-5 py-3"
              />

              <input
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl border px-5 py-3"
              />

              <input
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border px-5 py-3"
              />

              <input
                placeholder="Role"
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value)}
                className="w-full rounded-2xl border px-5 py-3"
              />

              <input
                placeholder="Department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-2xl border px-5 py-3"
              />

              <input
                placeholder="Hourly cost"
                type="number"
                value={hourlyCost}
                onChange={(e) => setHourlyCost(e.target.value)}
                className="w-full rounded-2xl border px-5 py-3"
              />

              <select
                value={accessRole}
                onChange={(e) => setAccessRole(e.target.value)}
                className="w-full rounded-2xl border px-5 py-3"
              >
                <option value="Employee">Employee</option>
                <option value="Manager">Manager</option>
                <option value="Admin">Admin</option>
              </select>

              <div className="flex gap-3">
                <button
                  onClick={saveMember}
                  className="rounded-2xl bg-slate-950 px-6 py-3 font-semibold text-white"
                >
                  Save
                </button>

                <button

  type="button"

  onClick={sendPasswordReset}

  className="rounded-2xl border border-slate-200 px-6 py-3 font-semibold hover:bg-slate-50"

>

  Send Password Reset

</button>

                <button
                  onClick={() => router.push(`/dashboard/team/${member.id}`)}
                  className="rounded-2xl border px-6 py-3 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {action === "deactivate" && userRole === "Admin" && (
            <div className="mt-8">
              <p className="text-slate-600">
                Do you want to deactivate this team member?
              </p>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => updateStatus("inactive")}
                  className="rounded-2xl bg-red-600 px-6 py-3 font-semibold text-white"
                >
                  Deactivate
                </button>

                <button
                  onClick={() => router.push(`/dashboard/team/${member.id}`)}
                  className="rounded-2xl border px-6 py-3 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {action === "activate" && userRole === "Admin" && (
            <div className="mt-8">
              <p className="text-slate-600">
                Do you want to activate this team member again?
              </p>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => updateStatus("active")}
                  className="rounded-2xl bg-green-600 px-6 py-3 font-semibold text-white"
                >
                  Activate
                </button>

                <button
                  onClick={() => router.push(`/dashboard/team/${member.id}`)}
                  className="rounded-2xl border px-6 py-3 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {action && userRole !== "Admin" && (
            <div className="mt-8 rounded-2xl bg-red-50 p-5 text-sm font-semibold text-red-600">
              You do not have permission to modify employee details.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}