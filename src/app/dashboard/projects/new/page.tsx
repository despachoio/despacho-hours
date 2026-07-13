"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Client = {
  id: string;
  name: string;
};

type Employee = {
  id: string;
  name: string;
};

function NewProjectPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
const clientFromUrl = searchParams.get("client");

  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [clientId, setClientId] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [purchasedHours, setPurchasedHours] = useState("");
  const [assignedEmployeeIds, setAssignedEmployeeIds] = useState<string[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");

  const [saving, setSaving] = useState(false);

  async function loadData() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", userData.user.id)
      .single();

    if (profile?.role !== "Admin") {
      router.push("/dashboard/projects");
      return;
    }

    const { data: clientData } = await supabase
      .from("clients")
      .select("id, name")
      .order("name");

    if (clientData) {

  setClients(clientData as Client[]);

}

if (clientFromUrl) {

  setClientId(clientFromUrl);

}

    const { data: employeeData } = await supabase
      .from("employees")
      .select("id, name")
      .eq("status", "active")
      .order("name");

    if (employeeData) {
      setEmployees(employeeData as Employee[]);
    }
  }

  async function saveProject() {
    if (!clientId || !name || !startDate || !purchasedHours) {
      alert("Please fill client, project name, start date, and purchased hours.");
      return;
    }

    if (saving) return;

    setSaving(true);

    const hours = Number(purchasedHours);

    if (!hours || hours <= 0) {
      alert("Purchased hours must be greater than 0.");
      setSaving(false);
      return;
    }

    const { data: newProject, error } = await supabase
      .from("projects")
      .insert({
        client_id: clientId,
        project_code: projectCode || null,
        name,
        start_date: startDate,
        purchased_hours: hours,
        used_hours: 0,
        remaining_hours: hours,
        status: "active",
      })
      .select("id")
      .single();

    if (error) {
      setSaving(false);
      alert(error.message);
      return;
    }

    const purchaseDate =
  new Date()
    .toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    )
    .replace(/ /g, "-");


const { error: noteError } =
  await supabase
    .from("project_notes")
    .insert({

      project_id:
        newProject.id,

      note:
        `${purchaseDate} - ${hours.toFixed(2)} hours purchased`,

    });


if (noteError) {

  alert(
    "Project note error: " +
    noteError.message
  );

  console.error(noteError);

}

    if (assignedEmployeeIds.length > 0 && newProject?.id) {
      const rows = assignedEmployeeIds.map((employeeId) => ({
        project_id: newProject.id,
        employee_id: employeeId,
      }));

      const { error: assignError } = await supabase
        .from("project_resources")
        .insert(rows);

      if (assignError) {
        setSaving(false);
        alert(assignError.message);
        return;
      }
    }

    setSaving(false);
    router.push("/dashboard/projects");
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <main className="min-h-screen bg-[#f8fafc] px-8 py-7">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => router.push("/dashboard/projects")}
          className="mb-6 text-sm font-semibold text-slate-500 hover:text-slate-950"
        >
          ← Back to Projects
        </button>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-950">
            Create New Project
          </h1>

          <div className="mt-8 space-y-5">
            <div>
              <label className="text-sm font-semibold text-slate-500">
                Client
              </label>

              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="mt-2 w-full rounded-2xl border px-5 py-3"
              >
                <option value="">Select client</option>

                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-500">
                Project Code
              </label>

              <input
                value={projectCode}
                onChange={(e) => setProjectCode(e.target.value)}
                placeholder="Example: DOZR001"
                className="mt-2 w-full rounded-2xl border px-5 py-3"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-500">
                Project Name
              </label>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name"
                className="mt-2 w-full rounded-2xl border px-5 py-3"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-500">
                Project Start Date
              </label>

              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-2 w-full rounded-2xl border px-5 py-3"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-500">
                Purchased Hours
              </label>

              <input
                type="number"
                value={purchasedHours}
                onChange={(e) => setPurchasedHours(e.target.value)}
                placeholder="Example: 200"
                className="mt-2 w-full rounded-2xl border px-5 py-3"
              />
            </div>

            <div>
  <label className="text-sm font-semibold text-slate-500">
    Assign Team
  </label>


  <select
    value={selectedEmployee}
    onChange={(e) => {

      const employeeId = e.target.value;


      if (
        employeeId &&
        !assignedEmployeeIds.includes(employeeId)
      ) {

        setAssignedEmployeeIds([
          ...assignedEmployeeIds,
          employeeId,
        ]);

      }


      setSelectedEmployee("");

    }}

    className="mt-2 w-full rounded-2xl border border-slate-200 px-5 py-3"
  >

    <option value="">
      Select employee
    </option>


    {employees
      .filter(
        (employee) =>
          !assignedEmployeeIds.includes(
            employee.id
          )
      )
      .map((employee) => (

        <option
          key={employee.id}
          value={employee.id}
        >

          {employee.name}

        </option>

      ))}

  </select>



  <div className="mt-3 flex flex-wrap gap-2">

    {assignedEmployeeIds.map((id) => {

      const employee =
        employees.find(
          (e) => e.id === id
        );


      if (!employee) return null;


      return (

        <span
          key={id}
          className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700"
        >

          {employee.name}


          <button
            type="button"
            onClick={() =>
              setAssignedEmployeeIds(
                assignedEmployeeIds.filter(
                  (x) => x !== id
                )
              )
            }

            className="font-bold text-red-500"
          >

            ×

          </button>

        </span>

      );

    })}

  </div>

</div>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard/projects")}
              className="rounded-xl border px-6 py-3 font-bold"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={saveProject}
              className="rounded-xl bg-slate-950 px-6 py-3 font-bold text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Project"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function NewProjectPage() {
  return (
    <Suspense fallback={null}>
      <NewProjectPageContent />
    </Suspense>
  );
}
