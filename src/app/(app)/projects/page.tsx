"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import KairoSegmentedControl from "@/components/ui/KairoSegmentedControl";

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

type LoadedProject = Project & {
  project_resources?: { employee_id: string }[];
};

type ProjectStatusFilter = "active" | "archived" | "all";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
] as const;

function projectInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

export default function ProjectsPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ProjectStatusFilter>("active");

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
      .select(
        `
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
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    if (data) {
      let visibleProjects = data as unknown as LoadedProject[];

      if (currentRole === "Employee" && currentEmployeeId) {
        visibleProjects = visibleProjects.filter((project) =>
          project.project_resources?.some(
            (resource) => resource.employee_id === currentEmployeeId,
          ),
        );
      }

      setProjects(visibleProjects as unknown as Project[]);
    }
  }

  useEffect(() => {
    // Existing dashboard page performs its initial Supabase load client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProjects();
  }, []);

  const filtered = projects.filter((project) => {
    const q = search.toLowerCase();

    const matchesSearch =
      project.name.toLowerCase().includes(q) ||
      (project.project_code || "").toLowerCase().includes(q) ||
      (project.clients?.name || "").toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === "all" || project.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const groupedProjects = Object.entries(
    filtered.reduce(
      (groups, project) => {
        const clientName = project.clients?.name || "No Client";

        if (!groups[clientName]) {
          groups[clientName] = [];
        }

        groups[clientName].push(project);

        return groups;
      },
      {} as Record<string, Project[]>,
    ),
  )
    .map(
      ([clientName, clientProjects]) =>
        [
          clientName,
          [...clientProjects].sort((projectA, projectB) => {
            const codeComparison = (projectA.project_code || "").localeCompare(
              projectB.project_code || "",
              undefined,
              { numeric: true, sensitivity: "base" },
            );
            return (
              codeComparison ||
              projectA.name.localeCompare(projectB.name, undefined, {
                sensitivity: "base",
              })
            );
          }),
        ] as const,
    )
    .sort(([clientA], [clientB]) =>
      clientA.localeCompare(clientB, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );

  return (
    <main className="min-h-screen bg-[#f8fafc] px-8 py-7">
      <div className="mx-auto max-w-7xl">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#0F172A] p-8 text-white shadow-xl shadow-slate-300/50 lg:p-10">
          <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#153E90]/60 blur-3xl" />
          <div className="absolute bottom-0 right-1/3 h-32 w-32 rounded-full bg-blue-400/10 blur-2xl" />
          <div className="relative flex items-center justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">
                Delivery portfolio
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight lg:text-5xl">
                Projects
              </h1>

              <p className="mt-3 text-slate-300">
                Manage projects and hour banks.
              </p>
            </div>

            {role === "Admin" && (
              <button
                type="button"
                onClick={() => router.push("/projects/new")}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-[#0F172A] shadow-lg transition hover:-translate-y-0.5"
              >
                + New Project
              </button>
            )}
          </div>
        </div>

        <div className="relative z-10 -mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60 sm:mx-5 sm:flex-row">
          <input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full flex-1 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3 outline-none transition focus:border-[#153E90] focus:ring-4 focus:ring-blue-100"
          />

          <KairoSegmentedControl
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
            ariaLabel="Filter projects by status"
          />
        </div>

        <div className="mt-8 space-y-8">
          {groupedProjects.length ? (
            groupedProjects.map(([clientName, clientProjects]) => (
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
                        router.push(`/projects/${project.id}/wallet`)
                      }
                      className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-blue-300 hover:shadow-md"
                    >
                      <div
                        className={
                          role === "Admin"
                            ? "grid items-center gap-5 px-5 py-4 sm:grid-cols-2 xl:grid-cols-[2fr_.7fr_.7fr_.7fr_auto] xl:px-6"
                            : "grid items-center gap-5 px-5 py-4 sm:grid-cols-2 xl:grid-cols-[2fr_.7fr_.7fr_.7fr] xl:px-6"
                        }
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#153E90] text-sm font-bold text-white shadow-md shadow-blue-200">
                            {projectInitials(project.name)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="flex min-w-0 items-center gap-2 whitespace-nowrap text-lg font-bold">
                              <span className="shrink-0 text-[#153E90]">
                                [{project.project_code}]
                              </span>
                              <span className="truncate text-slate-950 transition group-hover:text-[#153E90]">
                                {project.name}
                              </span>
                            </h3>
                            <span
                              className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${project.status === "archived" ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}
                            >
                              {project.status === "archived"
                                ? "Archived"
                                : "Active"}
                            </span>
                          </div>
                        </div>

                        <div className="text-center">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                            Purchased
                          </p>

                          <p className="mt-1 text-xl font-bold text-slate-950">
                            {Number(project.purchased_hours || 0).toFixed(2)}
                          </p>
                        </div>

                        <div className="text-center">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                            Used
                          </p>

                          <p className="mt-1 text-xl font-bold text-slate-950">
                            {Number(project.used_hours || 0).toFixed(2)}
                          </p>
                        </div>

                        <div className="text-center">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                            Remaining
                          </p>

                          <p
                            className={`mt-1 text-xl font-bold ${Number(project.remaining_hours || 0) < 0 ? "text-red-600" : "text-slate-950"}`}
                          >
                            {Number(project.remaining_hours || 0).toFixed(2)}
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
                                `/projects/${project.id}?action=${selectedAction}`,
                              );
                            }}
                            defaultValue=""
                            aria-label={`Actions for ${project.name}`}
                            className="h-11 min-w-36 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm outline-none hover:border-blue-200 focus:border-[#153E90]"
                          >
                            <option value="">Actions</option>

                            {project.status === "active" ? (
                              <>
                                <option value="edit">Edit</option>

                                <option value="team">Assign Team</option>

                                <option value="hours">Hours to credit</option>

                                <option value="archive">Deactivate</option>
                              </>
                            ) : (
                              <option value="unarchive">Activate</option>
                            )}
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          ) : (
            <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
              <p className="font-semibold text-slate-500">
                No projects match your search or selected status.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("active");
                }}
                className="mt-4 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-[#153E90] hover:bg-blue-50"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
