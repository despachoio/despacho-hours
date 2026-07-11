"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type TeamMember = {
  id: string;
  employee_code: string | null;
  name: string;
  email: string;
  role: string | null;
  department: string | null;
  status: string | null;
  hourly_cost: number | null;
  time_entries: {
    hours: number;
    entry_date: string;
  }[];
};

export default function TeamPage() {
  const router = useRouter();

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [search, setSearch] = useState("");
  const [userRole, setUserRole] = useState("");
  const [accessRole, setAccessRole] = useState("Employee");

  const [showNewMember, setShowNewMember] = useState(false);

  const [employeeCode, setEmployeeCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [memberRole, setMemberRole] = useState("");
  const [department, setDepartment] = useState("");
  const [hourlyCost, setHourlyCost] = useState("");

  async function loadTeam() {
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
        time_entries (
          hours,
          entry_date
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    if (data) setTeam(data as TeamMember[]);
  }

  async function addTeamMember() {
  if (!name.trim() || !email.trim()) return;

  const { error } = await supabase.functions.invoke("invite-team-member", {
    body: {
      email: email.trim(),
      full_name: name.trim(),
      employee_code: employeeCode.trim() || null,
      designation: memberRole.trim() || null,
      department: department.trim() || null,
      hourly_cost: hourlyCost || 0,
    
      access_role: accessRole,
    },
  });

  if (error) {
    alert(error.message);
    console.error(error);
    return;
  }

  alert("Invitation sent and employee created.");

  setEmployeeCode("");
  setName("");
  setEmail("");
  setMemberRole("");
  setDepartment("");
  setHourlyCost("");
  setAccessRole("Employee");
  setShowNewMember(false);

  loadTeam();
}

  function handleAction(value: string, member: TeamMember) {
    if (!value) return;
    router.push(`/dashboard/team/${member.id}?action=${value}`);
  }

  const filteredTeam = useMemo(() => {
    const q = search.toLowerCase().trim();

    if (!q) return team;

    return team.filter((member) => {
      return (
        member.name.toLowerCase().includes(q) ||
        member.email.toLowerCase().includes(q) ||
        (member.employee_code || "").toLowerCase().includes(q) ||
        (member.role || "").toLowerCase().includes(q) ||
        (member.department || "").toLowerCase().includes(q)
      );
    });
  }, [team, search]);

  function getWeeklyHours(member: TeamMember) {
    const today = new Date();
    const weekStart = new Date(today);

    weekStart.setDate(today.getDate() - today.getDay() + 1);

    return (
      member.time_entries
        ?.filter((entry) => new Date(entry.entry_date) >= weekStart)
        .reduce((sum, entry) => sum + Number(entry.hours || 0), 0) || 0
    );
  }

  function getUtilization(member: TeamMember) {
    const capacity = 40;
    const hours = getWeeklyHours(member);

    return Math.round((hours / capacity) * 100);
  }

  function getUtilizationColor(member: TeamMember) {
    const utilization = getUtilization(member);

    if (utilization <= 25) return "bg-slate-400";
    if (utilization <= 50) return "bg-yellow-400";
    if (utilization <= 100) return "bg-green-500";

    return "bg-red-500";
  }

  useEffect(() => {
    loadTeam();
  }, []);

  return (
    <main className="min-h-screen bg-[#f8fafc] px-8 py-7">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Kairo</p>

            <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-950">
              Team
            </h1>

            <p className="mt-2 text-slate-500">
              Manage people, roles, departments and internal costs.
            </p>
          </div>

          {userRole === "Admin" && (
            <button
              onClick={() => setShowNewMember(true)}
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm"
            >
              + New Team Member
            </button>
          )}
        </div>

        {showNewMember && userRole === "Admin" && (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">
              Add team member
            </h2>

            <div className="mt-5 grid grid-cols-3 gap-4">
              <input
                placeholder="Employee code"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                className="rounded-2xl border border-slate-200 px-5 py-3 outline-none focus:border-slate-950"
              />

              <input
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-2xl border border-slate-200 px-5 py-3 outline-none focus:border-slate-950"
              />

              <input
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-2xl border border-slate-200 px-5 py-3 outline-none focus:border-slate-950"
              />

              <input
                placeholder="Role"
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value)}
                className="rounded-2xl border border-slate-200 px-5 py-3 outline-none focus:border-slate-950"
              />

              <input
                placeholder="Department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="rounded-2xl border border-slate-200 px-5 py-3 outline-none focus:border-slate-950"
              />

              <input

  placeholder="Hourly cost"

  type="number"

  value={hourlyCost}

  onChange={(e) => setHourlyCost(e.target.value)}

  className="rounded-2xl border border-slate-200 px-5 py-3 outline-none focus:border-slate-950"

/>

<select

  value={accessRole}

  onChange={(e) => setAccessRole(e.target.value)}

  className="rounded-2xl border border-slate-200 px-5 py-3 outline-none focus:border-slate-950"

>

  <option value="Employee">Employee</option>

  <option value="Manager">Manager</option>

  <option value="Admin">Admin</option>

</select>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={addTeamMember}
                className="rounded-2xl bg-slate-950 px-6 py-3 font-semibold text-white hover:bg-slate-800"
              >
                Save Team Member
              </button>

              <button
                onClick={() => {
                  setShowNewMember(false);
                  setEmployeeCode("");
                  setName("");
                  setEmail("");
                  setMemberRole("");
                  setDepartment("");
                  setHourlyCost("");
                  setAccessRole("Employee");
                }}
                className="rounded-2xl border border-slate-200 px-6 py-3 font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <input
          placeholder="Search team..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-8 w-full max-w-md rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm outline-none focus:border-slate-950"
        />

        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[36%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[20%]" />
              {userRole === "Admin" && <col className="w-[22%]" />}
            </colgroup>

            <thead className="bg-slate-50 text-sm font-semibold text-slate-500">
              <tr>
                <th className="px-6 py-4 text-left">
                  Team Members ({filteredTeam.length})
                </th>

                <th className="px-6 py-4 text-center">Hours</th>

                <th className="px-6 py-4 text-center">Capacity</th>

                <th className="px-6 py-4">
                  <div className="flex justify-center">
                    <div className="w-28 text-left">Utilization</div>
                  </div>
                </th>

                {userRole === "Admin" && (
                  <th className="px-6 py-4 text-center">Actions</th>
                )}
              </tr>
            </thead>

            <tbody>
              {filteredTeam.map((member) => (
                <tr key={member.id} className="border-t hover:bg-slate-50">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-3 w-3 rounded-full ${
                          member.status === "active"
                            ? "bg-green-500"
                            : member.status === "on_hold"
                            ? "bg-yellow-400"
                            : "bg-slate-300"
                        }`}
                      />

                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white">
                        {member.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .substring(0, 2)}
                      </div>

                      <button
                        onClick={() => router.push(`/dashboard/team/${member.id}`)}
                        className="font-bold text-slate-950 hover:underline"
                      >
                        {member.name}
                      </button>
                    </div>
                  </td>

                  <td className="px-6 py-5 text-center font-semibold">
                    {getWeeklyHours(member).toFixed(2)}
                  </td>

                  <td className="px-6 py-5 text-center font-semibold">40</td>

                  <td className="px-6 py-5">
                    <div className="flex items-center justify-center gap-3">
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full ${getUtilizationColor(
                            member
                          )}`}
                          style={{
                            width: `${Math.min(getUtilization(member), 100)}%`,
                          }}
                        />
                      </div>

                      <span className="w-10 text-left text-sm font-bold text-slate-700">
                        {getUtilization(member)}%
                      </span>
                    </div>
                  </td>

                  {userRole === "Admin" && (
                    <td className="px-6 py-5 text-center">
                      <select

  defaultValue=""

  onChange={async (e) => {

    const value = e.target.value;

    if (!value) return;

    if (value === "reset") {

      const { error } =

        await supabase.functions.invoke(

          "send-password-reset",

          {

            body: {

              email: member.email,

            },

          }

        );

      if (error) {

        alert(error.message);

        return;

      }

      alert("Password reset email sent.");

      e.target.value = "";

      return;

    }

    handleAction(value, member);

  }}

className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
>

  <option value="">

    Actions

  </option>

  <option value="edit">

    Edit

  </option>

  <option value="reset">

    Send Password Reset

  </option>

  {member.status === "active" ? (

    <option value="deactivate">

      Deactivate

    </option>

  ) : (

    <option value="activate">

      Activate

    </option>

  )}

</select>
                    </td>
                  )}
                </tr>
              ))}

              {!filteredTeam.length && (
                <tr>
                  <td
                    colSpan={userRole === "Admin" ? 5 : 4}
                    className="px-6 py-10 text-center text-slate-500"
                  >
                    No team members found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}