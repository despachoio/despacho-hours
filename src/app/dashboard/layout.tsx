"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type IconName =
  | "dashboard"
  | "clients"
  | "projects"
  | "team"
  | "time"
  | "reports"
  | "invoices";

type MenuItem = {
  name: string;
  path: string;
  roles: string[];
  icon: IconName;
};

const allMenu: MenuItem[] = [
  { name: "Dashboard", path: "/dashboard", roles: ["Admin", "Manager", "Employee"], icon: "dashboard" },
  { name: "Clients", path: "/dashboard/clients", roles: ["Admin", "Manager"], icon: "clients" },
  { name: "Projects", path: "/dashboard/projects", roles: ["Admin", "Manager", "Employee"], icon: "projects" },
  { name: "Team", path: "/dashboard/team", roles: ["Admin", "Manager"], icon: "team" },
  { name: "Time", path: "/dashboard/time", roles: ["Admin", "Manager", "Employee"], icon: "time" },
  { name: "Reports", path: "/dashboard/reports", roles: ["Admin", "Manager", "Employee"], icon: "reports" },
  { name: "Invoices", path: "/dashboard/invoices", roles: ["Admin"], icon: "invoices" },
];

const iconPaths: Record<IconName, ReactNode> = {
  dashboard: <><path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z" /></>,
  clients: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  projects: <><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-10Z" /><path d="M3 10h18" /></>,
  team: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /><path d="M18 4.5a4 4 0 0 1 0 7M21 15.5a7 7 0 0 1 2 5.5" /></>,
  time: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  reports: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  invoices: <><path d="M6 2h9l4 4v16l-3-2-3 2-3-2-3 2-3-2V4a2 2 0 0 1 2-2Z" /><path d="M14 2v5h5M8 11h7M8 15h7" /></>,
};

function NavigationIcon({ name }: { name: IconName }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      {iconPaths[name]}
    </svg>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function checkUser() {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.replace("/login");
        return;
      }

      setUserEmail(data.user.email || "");
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("user_id", data.user.id)
        .single();

      setUserName(profile?.full_name || data.user.email?.split("@")[0] || "");
      setUserRole(profile?.role || "User");
    }

    void checkUser();
  }, [router]);

  const menu = allMenu.filter((item) => item.roles.includes(userRole));

  useEffect(() => {
    if (!userRole) return;
    const allowed = allMenu.find((item) => item.path === pathname);
    if (allowed && !allowed.roles.includes(userRole)) router.replace("/dashboard/time");
  }, [pathname, router, userRole]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function navigate(path: string) {
    setIsMobileMenuOpen(false);
    router.push(path);
  }

  function isActive(path: string) {
    return path === "/dashboard"
      ? pathname === path
      : pathname === path || pathname.startsWith(`${path}/`);
  }

  const sidebar = (
    <aside className="relative flex h-full w-[288px] flex-col overflow-hidden border-r border-slate-200/80 bg-white shadow-[12px_0_40px_rgba(15,23,42,0.04)]">
      <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-blue-100/60 blur-3xl" />
      <div className="relative border-b border-slate-100 px-7 pb-6 pt-7">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => navigate("/dashboard")} className="rounded-xl text-left hover:opacity-80" aria-label="Go to dashboard">
            <Image src="/kairo-logo-full.png" alt="Kairo" width={164} height={48} priority className="h-auto w-[142px]" />
          </button>
          <button type="button" onClick={() => setIsMobileMenuOpen(false)} aria-label="Close navigation" className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 lg:hidden">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div className="mt-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
          <span className="h-px w-5 bg-[#153E90]" />
          The pulse of Despacho
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto px-4 py-6">
        <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Workspace</p>
        <nav className="mt-3 space-y-1.5" aria-label="Dashboard navigation">
          {menu.map((item) => {
            const active = isActive(item.path);
            return (
              <div key={item.path}>
              <button
                type="button"
                onClick={() => navigate(item.path)}
                aria-current={active ? "page" : undefined}
                className={`group relative flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-semibold transition-all ${
                  active
                    ? "bg-[#0F172A] text-white shadow-lg shadow-slate-900/15"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${active ? "bg-white/10 text-blue-200" : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-[#153E90]"}`}>
                  <NavigationIcon name={item.icon} />
                </span>
                <span>{item.name}</span>
                {active ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-300 shadow-[0_0_0_4px_rgba(147,197,253,0.12)]" /> : null}
              </button>
              {item.name === "Invoices" && active ? (
                <div className="ml-12 mt-1 space-y-1 border-l border-slate-200 pl-3">
                  <button type="button" onClick={() => navigate("/dashboard/invoices")} className={`block w-full rounded-lg px-3 py-2 text-left text-xs font-bold ${pathname === "/dashboard/invoices" ? "bg-blue-50 text-[#153E90]" : "text-slate-500 hover:bg-slate-50"}`}>All Invoices</button>
                  <button type="button" onClick={() => navigate("/dashboard/invoices/recurring")} className={`block w-full rounded-lg px-3 py-2 text-left text-xs font-bold ${pathname.startsWith("/dashboard/invoices/recurring") ? "bg-blue-50 text-[#153E90]" : "text-slate-500 hover:bg-slate-50"}`}>Recurring Invoices</button>
                </div>
              ) : null}
              </div>
            );
          })}
        </nav>
      </div>

      <div className="relative border-t border-slate-100 bg-slate-50/70 p-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#153E90] to-[#0F172A] text-sm font-bold text-white shadow-md shadow-blue-900/15">
              {getInitials(userName) || "K"}
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-950">{userName || "Kairo User"}</p>
              <p className="mt-0.5 truncate text-xs text-slate-400">{userEmail}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#153E90]">{userRole || "User"}</span>
            <button type="button" onClick={() => void logout()} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M10 17l5-5-5-5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /></svg>
              Sign out
            </button>
          </div>
        </div>
        <p className="mt-3 text-center text-[10px] font-medium tracking-wide text-slate-400">KAIRO · DESPACHO INC.</p>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{sidebar}</div>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close navigation" onClick={() => setIsMobileMenuOpen(false)} className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" />
          <div className="relative h-full w-[288px] max-w-[86vw]">{sidebar}</div>
        </div>
      ) : null}

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl lg:hidden">
        <button type="button" onClick={() => setIsMobileMenuOpen(true)} aria-label="Open navigation" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <Image src="/kairo-logo-full.png" alt="Kairo" width={126} height={38} className="h-auto w-[108px]" />
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F172A] text-xs font-bold text-white">{getInitials(userName) || "K"}</div>
      </header>

      <main className="min-h-screen lg:pl-[288px]">{children}</main>
    </div>
  );
}
