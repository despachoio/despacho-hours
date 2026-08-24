"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClientsWorkspace } from "@/app/(app)/clients/page";
import { ProjectsWorkspace } from "@/app/(app)/projects/page";
import { supabase } from "@/lib/supabase";
import TimeOffIcon, { type TimeOffIconName } from "@/components/time-off/TimeOffIcon";

const accountTabs = [
  { value: "clients", label: "Clients", icon: "people" },
  { value: "projects", label: "Projects", icon: "folder" },
] as const;

type AccountTab = (typeof accountTabs)[number]["value"];

function AccountsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [role, setRole] = useState("");
  const [loadingRole, setLoadingRole] = useState(true);
  const canViewClients = role.trim().toLowerCase() !== "employee";
  const selectedTab: AccountTab =
    requestedTab === "projects" || !canViewClients ? "projects" : "clients";

  useEffect(() => {
    async function loadRole() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return setLoadingRole(false);
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", userData.user.id)
        .single();
      setRole(String(data?.role || ""));
      setLoadingRole(false);
    }
    void loadRole();
  }, []);

  const visibleTabs = canViewClients ? accountTabs : accountTabs.slice(1);
  function selectTab(tab: AccountTab) {
    router.replace(tab === "clients" ? "/accounts" : "/accounts?tab=projects", {
      scroll: false,
    });
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-5 py-7 sm:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#0F172A] via-[#172554] to-[#153E90] px-8 py-10 text-white shadow-xl lg:px-11">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[.22em] text-cyan-200">
              Relationships &amp; delivery
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight lg:text-5xl">
              Accounts
            </h1>
            <p className="mt-3 text-sm text-blue-100">
              Manage client accounts, projects and service delivery.
            </p>
          </div>
        </header>
        <nav
          aria-label="Accounts sections"
          className="relative z-20 mx-4 -mt-4 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"
        >
          {visibleTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => selectTab(tab.value)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-bold transition ${selectedTab === tab.value ? "bg-[#153E90] text-white shadow" : "text-slate-500 hover:bg-slate-100"}`}
            >
              <TimeOffIcon name={tab.icon as TimeOffIconName} className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <section className="mt-8">
          {loadingRole ? (
            <div className="h-96 animate-pulse rounded-3xl bg-white" />
          ) : selectedTab === "clients" ? (
            <ClientsWorkspace embedded />
          ) : (
            <ProjectsWorkspace embedded />
          )}
        </section>
      </div>
    </main>
  );
}

export default function AccountsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F8FAFC] px-5 py-7 sm:px-8">
          <div className="mx-auto h-[34rem] max-w-[1500px] animate-pulse rounded-[2rem] bg-white" />
        </main>
      }
    >
      <AccountsPageContent />
    </Suspense>
  );
}
