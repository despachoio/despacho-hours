"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  name: string;
  project_code: string | null;
  purchased_hours: number;
  used_hours: number;
  remaining_hours: number;
  status: string;
  clients: {
    id: string;
    name: string;
  } | null;
};

export default function ProjectsPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  async function loadProjects() {
    const { data: userData } = await supabase.auth.getUser();

    let currentRole = "";
    let currentEmployeeId = "";

    if (userData.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, employee_id")
        .eq("user_id", userData.user.id)
        .single();

      currentRole = profile?.role || "";
      currentEmployeeId = profile?.employee_id || "";

      setRole(currentRole);
    }

    const { data, error } = await supabase
      .from("projects")
      .select(`
        id,
        name,
        project_code,
        purchased_hours,
        used_hours,
        remaining_hours,
        status,
        clients(
          id,
          name
        ),
        project_resources(
          employee_id
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    if (data) {
      let visibleProjects = data;

      if (
        currentRole === "Employee" &&
        currentEmployeeId
      ) {
        visibleProjects = data.filter((project: any) =>
          project.project_resources?.some(
            (resource: any) =>
              resource.employee_id === currentEmployeeId
          )
        );
      }

      setProjects(visibleProjects as unknown as Project[]);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  const filtered = projects.filter((project) => {
    const q = search.toLowerCase();

    const matchesSearch =
      project.name.toLowerCase().includes(q) ||
      (project.project_code || "")
        .toLowerCase()
        .includes(q) ||
      (project.clients?.name || "")
        .toLowerCase()
        .includes(q);

    const matchesStatus =
      statusFilter === "all" ||
      project.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const groupedProjects = Object.entries(
    filtered.reduce((groups, project) => {
      const clientName =
        project.clients?.name || "No Client";

      if (!groups[clientName]) {
        groups[clientName] = [];
      }

      groups[clientName].push(project);

      return groups;
    }, {} as Record<string, Project[]>)
  ).sort(([clientA], [clientB]) =>
    clientA.localeCompare(clientB)
  );

  return (
    <main className="min-h-screen bg-[#f8fafc] px-8 py-7">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="mt-1 text-4xl font-bold tracking-tight">
              Projects
            </h1>

            <p className="mt-2 text-slate-500">
              Manage projects and hour banks.
            </p>
          </div>

          {role === "Admin" && (
            <button
              type="button"
              onClick={() =>
                router.push("/dashboard/projects/new")
              }
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
            >
              + New Project
            </button>
          )}
        </div>

        <div className="mt-8 flex gap-3">
          <input
            placeholder="Search projects..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm"
          />

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
            className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm outline-none hover:border-slate-300"
          >
            <option value="active">
              Active Projects
            </option>

            <option value="archived">
              Archived Projects
            </option>

            <option value="all">
              All Projects
            </option>
          </select>
        </div>

        <div className="mt-8 space-y-8">
          {groupedProjects.length ? (
            groupedProjects.map(
              ([clientName, clientProjects]) => (
                <section key={clientName}>
                  <div className="mb-5 flex items-center gap-4">
  <h2 className="text-xl font-bold text-slate-950">
    {clientName}
  </h2>

  <div className="h-px flex-1 bg-slate-200" />
</div>

                  <div className="space-y-4">
                    {clientProjects.map((project) => (
                      <div
  key={project.id}
  onClick={() =>
    router.push(`/dashboard/projects/${project.id}/wallet`)
  }
  className="cursor-pointer rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
>
                        <div
                          className={
                            role === "Admin"
                              ? "grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-6 px-6 py-5"
                              : "grid grid-cols-[2fr_1fr_1fr_1fr] items-center gap-6 px-6 py-5"
                          }
                        >
                          <div className="flex items-center gap-3">

  <h3 className="text-lg font-bold text-slate-950">

    [{project.project_code}] {project.name}

  </h3>

  {project.status === "archived" && (

    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-700">

  Archived

</span>

  )}

</div>

                          <div className="text-center">
                            <p className="text-xs font-medium text-slate-500">
                              Purchased
                            </p>

                            <p className="mt-1 text-lg font-semibold text-slate-950">
                              {Number(
                                project.purchased_hours ||
                                  0
                              ).toFixed(2)}
                            </p>
                          </div>

                          <div className="text-center">
                            <p className="text-xs font-medium text-slate-500">
                              Used
                            </p>

                            <p className="mt-1 text-lg font-semibold text-slate-950">
                              {Number(
                                project.used_hours || 0
                              ).toFixed(2)}
                            </p>
                          </div>

                          <div className="text-center">
                            <p className="text-xs font-medium text-slate-500">
                              Remaining
                            </p>

                            <p className="mt-1 text-lg font-semibold text-slate-950">
                              {Number(
                                project.remaining_hours ||
                                  0
                              ).toFixed(2)}
                            </p>
                          </div>

                          {role === "Admin" && (
  <select
    onClick={(e) => e.stopPropagation()}
    onChange={(e) => {
      e.stopPropagation();

      const selectedAction = e.target.value;

      if (!selectedAction) return;

      router.push(
        `/dashboard/projects/${project.id}?action=${selectedAction}`
      );
    }}
    defaultValue=""
    className="rounded-xl border border-slate-200 px-4 py-2 font-semibold"
  >
                              <option value="">
                                Actions
                              </option>

                              {project.status ===
                              "active" ? (
                                <>
                                  <option value="edit">
                                    Edit
                                  </option>

                                  <option value="hours">
                                    Add Hours
                                  </option>

                                  <option value="team">
                                    Assign Team
                                  </option>

                                  <option value="archive">
                                    Archive
                                  </option>
                                </>
                              ) : (
                                <option value="unarchive">
                                  Unarchive
                                </option>
                              )}
                            </select>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )
            )
          ) : (
            <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
              <p className="font-semibold text-slate-500">
                No projects found.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}