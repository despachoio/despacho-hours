"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDecimalHours } from "@/lib/format-hours";
import { useRouter } from "next/navigation";
import Link from "next/link";
import KairoSegmentedControl from "@/components/ui/KairoSegmentedControl";
import ModuleHeader from "@/components/ui/ModuleHeader";

type Project = {
  id: string;
  name: string;
  project_code: string | null;
  purchased_hours: number;
  used_hours: number;
  remaining_hours: number;
  status: string;
  is_billable: boolean;
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

export function ProjectsWorkspace({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ProjectStatusFilter>("active");
  const canAdministerProjects = [
    "Finance Admin",
    "Super Admin",
    "Admin",
  ].includes(role);
  const canOpenProject = canAdministerProjects || role === "Manager";

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
        is_billable,
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesSearch =
        project.name.toLowerCase().includes(q) ||
        (project.project_code || "").toLowerCase().includes(q) ||
        (project.clients?.name || "").toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" ||
        project.status?.toLowerCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [projects, search, statusFilter]);

  const metrics = useMemo(
    () => ({
      total: projects.length,
      active: projects.filter(
        (project) => project.status?.toLowerCase() === "active",
      ).length,
      archived: projects.filter(
        (project) => project.status?.toLowerCase() === "archived",
      ).length,
    }),
    [projects],
  );

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

  const Root = embedded ? "div" : "main";
  return (
    <Root className={embedded ? "" : "min-h-screen bg-[#f8fafc] px-8 py-7"}>
      <div className={embedded ? "" : "mx-auto max-w-7xl"}>
        {!embedded ? <div className="relative overflow-hidden rounded-[2rem] bg-[#0F172A] p-8 text-white shadow-xl shadow-slate-300/50 lg:p-10">
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

            {canAdministerProjects && (
              <Link
                href="/projects/new"
                className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-[#0F172A] shadow-lg transition hover:-translate-y-0.5"
              >
                + New Project
              </Link>
            )}
          </div>
        </div> : <ModuleHeader
          className="mb-6"
          eyebrow="Delivery portfolio"
          title="Projects"
          description="Manage projects and hour banks."
          actions={canAdministerProjects ? <Link href="/projects/new" className="inline-flex items-center justify-center rounded-xl bg-[#153E90] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#123578]">+ New Project</Link> : null}
        />}

        <section className="relative z-10 -mt-3 grid grid-cols-1 gap-4 px-3 sm:grid-cols-3 lg:px-6">
          {[
            {
              label: "Total Projects",
              value: metrics.total,
              accent: "from-[#153E90] to-cyan-400",
              surface: "from-white via-white to-blue-50/80",
            },
            {
              label: "Active",
              value: metrics.active,
              accent: "from-emerald-600 to-teal-300",
              surface: "from-white via-white to-emerald-50/80",
            },
            {
              label: "Archived",
              value: metrics.archived,
              accent: "from-violet-600 to-fuchsia-300",
              surface: "from-white via-white to-violet-50/75",
            },
          ].map((metric) => (
            <article
              key={metric.label}
              className={`group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br ${metric.surface} p-5 shadow-lg shadow-slate-200/55 transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-100/70`}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-x-5 top-0 h-1 rounded-b-full bg-gradient-to-r ${metric.accent}`}
              />
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 sm:text-xs">
                {metric.label}
              </p>
              <p className="mt-3 text-2xl font-bold text-[#153E90] sm:text-3xl">
                {metric.value}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="shrink-0 lg:w-44">
              <h2 className="font-bold text-slate-950">Project portfolio</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {filtered.length} {filtered.length === 1 ? "project" : "projects"}{" "}
                shown
              </p>
            </div>
            <label className="relative block min-w-0 flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
                ⌕
              </span>
              <input
                data-shortcut-search
                placeholder="Search projects..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-[#153E90] focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <KairoSegmentedControl
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
              ariaLabel="Filter projects by status"
            />
          </div>
        </section>

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
                      data-shortcut-row
                      data-shortcut-href={
                        canOpenProject
                          ? `/projects/${project.id}/wallet`
                          : undefined
                      }
                      data-shortcut-edit-href={
                        canAdministerProjects
                          ? `/projects/${project.id}?action=edit`
                          : undefined
                      }
                      role={canOpenProject ? "link" : undefined}
                      tabIndex={canOpenProject ? 0 : undefined}
                      onClick={
                        canOpenProject
                          ? (event) => {
                              if (
                                (event.target as HTMLElement).closest(
                                  "a,button,select,input,textarea",
                                )
                              )
                                return;
                              router.push(`/projects/${project.id}/wallet`);
                            }
                          : undefined
                      }
                      onKeyDown={
                        canOpenProject
                          ? (event) => {
                              if (
                                event.key === "Enter" ||
                                event.key === " "
                              ) {
                                event.preventDefault();
                                router.push(
                                  `/projects/${project.id}/wallet`,
                                );
                              }
                            }
                          : undefined
                      }
                      className={`group relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-white via-white to-blue-50/65 shadow-md shadow-slate-200/60 transition duration-300 ${
                        canOpenProject
                          ? "cursor-pointer hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-100/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100"
                          : "cursor-default"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-5 left-0 w-1 rounded-r-full bg-gradient-to-b from-[#153E90] to-cyan-400"
                      />
                      <div
                        className={
                          canAdministerProjects
                            ? "grid items-center gap-5 px-5 py-4 sm:grid-cols-2 xl:grid-cols-[2fr_.7fr_.7fr_.7fr_auto] xl:px-6"
                            : "grid items-center gap-5 px-5 py-4 sm:grid-cols-2 xl:grid-cols-[2fr_.7fr_.7fr_.7fr] xl:px-6"
                        }
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#153E90] to-blue-600 text-sm font-bold text-white shadow-md shadow-blue-200">
                            {projectInitials(project.name)}
                          </div>
                          <div className="min-w-0">
                            {canOpenProject ? (
                              <Link
                                href={`/projects/${project.id}/wallet`}
                                className="flex min-w-0 items-center gap-2 whitespace-nowrap text-lg font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#153E90]/30"
                              >
                                <span className="shrink-0 text-[#153E90]">
                                  [{project.project_code}]
                                </span>
                                <span className="truncate text-slate-950 transition group-hover:text-[#153E90]">
                                  {project.name}
                                </span>
                              </Link>
                            ) : (
                              <div className="flex min-w-0 items-center gap-2 whitespace-nowrap text-lg font-bold">
                              <span className="shrink-0 text-[#153E90]">
                                [{project.project_code}]
                              </span>
                              <span className="truncate text-slate-950">
                                {project.name}
                              </span>
                              </div>
                            )}
                            <span
                              className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${project.status === "archived" ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}
                            >
                              {project.status === "archived"
                                ? "Archived"
                                : "Active"}
                            </span>
                            <span
                              className={`ml-2 mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${project.is_billable ? "bg-blue-50 text-[#153E90]" : "bg-violet-50 text-violet-700"}`}
                            >
                              {project.is_billable ? "Billable" : "Non-billable"}
                            </span>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-blue-100/80 bg-white/80 px-3 py-2.5 text-center shadow-sm">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                            Purchased
                          </p>

                          <p className="mt-1 text-xl font-bold text-slate-950">
                            {formatDecimalHours(project.purchased_hours)}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-violet-100/80 bg-white/80 px-3 py-2.5 text-center shadow-sm">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                            Used
                          </p>

                          <p className="mt-1 text-xl font-bold text-slate-950">
                            {formatDecimalHours(project.used_hours)}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-emerald-100/80 bg-white/80 px-3 py-2.5 text-center shadow-sm">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                            Remaining
                          </p>

                        <p
  className={`mt-1 text-xl font-bold ${
    Number(project.remaining_hours || 0) < 0
      ? "text-red-600"
      : Number(project.remaining_hours || 0) > 0 &&
        Number(project.remaining_hours || 0) < 10
      ? "text-yellow-500"
      : "text-slate-950"
  }`}
>
  {formatDecimalHours(project.remaining_hours)}
</p>
                        </div>

                        {canAdministerProjects && (
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
    </Root>
  );
}

export default function ProjectsPage() {
  return <ProjectsWorkspace />;
}
