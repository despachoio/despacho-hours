"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import KairoSegmentedControl from "@/components/ui/KairoSegmentedControl";
import { supabase } from "@/lib/supabase";

type Contact = {
  name: string | null;
  email: string;
  is_active: boolean | null;
};

type ClientProject = {
  id: string;
  status: string | null;
};

type Client = {
  id: string;
  name: string;
  status: string;
  client_contacts: Contact[];
  projects: ClientProject[];
};

type ClientStatusFilter = "active" | "archived" | "all";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
] as const;

function clientInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

export function ClientsWorkspace({ embedded = false }: { embedded?: boolean }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ClientStatusFilter>("active");
  const [showNewClient, setShowNewClient] = useState(false);
  const [clientName, setClientName] = useState("");

  async function loadClients() {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", userData.user.id)
        .single();
      setRole(profile?.role || "");
    }

    const { data, error } = await supabase
      .from("clients")
      .select(
        "id,name,status,client_contacts(name,email,is_active),projects(id,status)",
      )
      .order("name", { ascending: true });

    if (error) {
      console.error("Client load failed:", error);
      return;
    }
    setClients((data || []) as unknown as Client[]);
  }

  async function addClient() {
    if (!clientName.trim()) return;
    const { error } = await supabase.from("clients").insert({
      name: clientName.trim(),
      status: "active",
    });
    if (error) {
      console.error("Client creation failed:", error);
      return;
    }
    setClientName("");
    setShowNewClient(false);
    await loadClients();
  }

  useEffect(() => {
    // Existing dashboard page performs its initial Supabase load client-side.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadClients();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearch(search.trim().toLowerCase()),
      300,
    );
    return () => window.clearTimeout(timeout);
  }, [search]);

  const filteredClients = useMemo(
    () =>
      clients
        .filter((client) => {
          const normalizedStatus = String(client.status || "").toLowerCase();
          if (statusFilter !== "all" && normalizedStatus !== statusFilter) {
            return false;
          }
          if (!debouncedSearch) return true;
          return (
            client.name.toLowerCase().includes(debouncedSearch) ||
            (client.client_contacts || []).some(
              (contact) =>
                contact.is_active !== false &&
                `${contact.name || ""} ${contact.email}`
                  .toLowerCase()
                  .includes(debouncedSearch),
            )
          );
        })
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        ),
    [clients, debouncedSearch, statusFilter],
  );

  const metrics = useMemo(
    () => ({
      total: clients.length,
      active: clients.filter(
        (client) => client.status?.toLowerCase() === "active",
      ).length,
      archived: clients.filter(
        (client) => client.status?.toLowerCase() === "archived",
      ).length,
    }),
    [clients],
  );
  const isAdmin = ["finance admin", "super admin", "admin"].includes(
    role.trim().toLowerCase(),
  );

  useEffect(() => {
    if (!isAdmin) return;
    const openNewClient = () => setShowNewClient(true);
    window.addEventListener("kairo:new-client", openNewClient);
    return () => window.removeEventListener("kairo:new-client", openNewClient);
  }, [isAdmin]);

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("active");
  }

  const Root = embedded ? "div" : "main";
  return (
    <Root className={embedded ? "" : "min-h-screen bg-[#f8fafc] px-6 py-7 lg:px-8"}>
      <div className={embedded ? "" : "mx-auto max-w-7xl"}>
        {!embedded ? <section className="relative overflow-hidden rounded-[2rem] bg-[#0F172A] p-8 text-white shadow-xl shadow-slate-300/50 lg:p-10">
          <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#153E90]/60 blur-3xl" />
          <div className="absolute bottom-0 right-1/3 h-32 w-32 rounded-full bg-blue-400/10 blur-2xl" />
          <div className="relative flex items-center justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">
                Client portfolio
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight lg:text-5xl">
                Clients
              </h1>
              <p className="mt-3 text-slate-300">
                Manage client relationships, contacts, and active projects.
              </p>
            </div>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setShowNewClient(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-[#0F172A] shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50"
              >
                <span className="text-lg leading-none text-[#153E90]">+</span>
                New Client
              </button>
            ) : null}
          </div>
        </section> : <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#153E90]">Client portfolio</p><h2 className="mt-2 text-2xl font-bold text-slate-950">Clients</h2><p className="mt-1 text-sm text-slate-500">Manage client relationships, contacts, and active projects.</p></div>{isAdmin ? <button type="button" onClick={() => setShowNewClient(true)} className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-[#153E90] px-4 py-2.5 text-sm font-bold text-white shadow-sm sm:self-auto"><span className="text-base leading-none">+</span>New Client</button> : null}</div>}

        <section className="relative z-10 -mt-3 grid grid-cols-1 gap-4 px-3 sm:grid-cols-3 lg:px-6">
          {[
            {
              label: "Total Clients",
              value: metrics.total,
              accent: "from-[#153E90] to-cyan-400",
              surface: "from-white via-white to-blue-50/80",
              badge: "bg-blue-50 text-[#153E90] ring-blue-100",
              icon: "C",
            },
            {
              label: "Active",
              value: metrics.active,
              accent: "from-emerald-600 to-teal-300",
              surface: "from-white via-white to-emerald-50/80",
              badge: "bg-emerald-50 text-emerald-700 ring-emerald-100",
              icon: "✓",
            },
            {
              label: "Archived",
              value: metrics.archived,
              accent: "from-violet-600 to-fuchsia-300",
              surface: "from-white via-white to-violet-50/75",
              badge: "bg-violet-50 text-violet-700 ring-violet-100",
              icon: "A",
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
              <span
                aria-hidden="true"
                className={`absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-2xl text-xs font-black ring-1 ${metric.badge}`}
              >
                {metric.icon}
              </span>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 sm:text-xs">
                {metric.label}
              </p>
              <p className="mt-3 text-2xl font-bold text-[#153E90] sm:text-3xl">
                {metric.value}
              </p>
            </article>
          ))}
        </section>

        {showNewClient && isAdmin ? (
          <section className="mt-7 rounded-3xl border border-blue-100 bg-white p-6 shadow-lg shadow-blue-100/40">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#153E90]">
                  New relationship
                </p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">
                  Create a client
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowNewClient(false)}
                aria-label="Close new client"
                className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                autoFocus
                placeholder="Company name"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                className="min-w-0 flex-1 rounded-2xl border border-slate-300 px-5 py-3.5 outline-none focus:border-[#153E90] focus:ring-4 focus:ring-blue-100"
              />
              <button
                type="button"
                data-shortcut-primary
                aria-keyshortcuts="Control+Enter Meta+Enter"
                onClick={() => void addClient()}
                className="rounded-2xl bg-[#153E90] px-6 py-3.5 font-bold text-white hover:bg-[#123578]"
              >
                Create Client
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewClient(false);
                  setClientName("");
                }}
                className="rounded-2xl border border-slate-300 px-6 py-3.5 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="shrink-0 lg:w-44">
              <h2 className="font-bold text-slate-950">Client portfolio</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {filteredClients.length}{" "}
                {filteredClients.length === 1 ? "client" : "clients"} shown
              </p>
            </div>
            <label className="relative block min-w-0 flex-1">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
                ⌕
              </span>
              <input
                data-shortcut-search
                placeholder="Search clients..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-[#153E90] focus:ring-4 focus:ring-blue-100"
              />
            </label>
            <KairoSegmentedControl
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
              ariaLabel="Filter clients by status"
            />
          </div>
        </section>

        <section className="mt-5 space-y-3">
          {filteredClients.map((client) => {
            const activeProjects = (client.projects || []).filter(
              (project) => project.status?.toLowerCase() === "active",
            ).length;
            const isArchived = client.status?.toLowerCase() === "archived";
            return (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                data-shortcut-row
                data-shortcut-href={`/clients/${client.id}`}
                className={`group relative flex min-h-[104px] cursor-pointer items-center gap-4 overflow-hidden rounded-3xl border px-5 py-4 shadow-md transition duration-300 hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#153E90]/30 sm:px-6 ${
                  isArchived
                    ? "border-slate-200 bg-gradient-to-r from-white via-white to-slate-50 hover:border-slate-300 hover:shadow-slate-200/70"
                    : "border-blue-100 bg-gradient-to-r from-white via-white to-blue-50/75 hover:border-blue-300 hover:shadow-blue-100/80"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-5 left-0 w-1 rounded-r-full ${
                    isArchived
                      ? "bg-slate-300"
                      : "bg-gradient-to-b from-[#153E90] to-cyan-400"
                  }`}
                />
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-md ${
                    isArchived
                      ? "bg-slate-500 shadow-slate-200"
                      : "bg-gradient-to-br from-[#153E90] to-blue-600 shadow-blue-200"
                  }`}
                >
                  {clientInitials(client.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-bold text-slate-950 transition group-hover:text-[#153E90]">
                    {client.name}
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {activeProjects} active{" "}
                    {activeProjects === 1 ? "project" : "projects"}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                    isArchived
                      ? "bg-slate-100 text-slate-500"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {isArchived ? "Archived" : "Active"}
                </span>
                <span
                  aria-hidden="true"
                  className="text-xl text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#153E90]"
                >
                  ›
                </span>
              </Link>
            );
          })}
        </section>

        {filteredClients.length === 0 ? (
          <section className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <h3 className="font-bold text-slate-900">
              No clients match your search or selected status.
            </h3>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-[#153E90] hover:bg-blue-50"
            >
              Clear Filters
            </button>
          </section>
        ) : null}
      </div>
    </Root>
  );
}

export default function ClientsPage() {
  return <ClientsWorkspace />;
}
