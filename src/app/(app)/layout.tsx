"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  OpenShortcutHelpButton,
  ShortcutProvider,
} from "@/components/shortcuts/ShortcutProvider";
import { isAdminLevelRole } from "@/lib/roles";

type IconName =
  | "dashboard"
  | "clients"
  | "projects"
  | "team"
  | "time"
  | "reports"
  | "invoices"
  | "settings";

type MenuItem = {
  name: string;
  path: string;
  roles: string[];
  icon: IconName;
  shortcutNumber: number;
};

type AccessState = "checking" | "allowed" | "mobile-blocked";

const allMenu: MenuItem[] = [
  {
    name: "Dashboard",
    path: "/dashboard",
    roles: ["Super Admin", "Admin", "Manager", "Employee"],
    icon: "dashboard",
    shortcutNumber: 1,
  },
  {
    name: "Timer",
    path: "/timer",
    roles: ["Super Admin", "Admin", "Manager", "Employee"],
    icon: "time",
    shortcutNumber: 2,
  },
  {
    name: "Team",
    path: "/team",
    roles: ["Super Admin", "Admin", "Manager", "Employee"],
    icon: "team",
    shortcutNumber: 3,
  },
  {
    name: "Invoices",
    path: "/invoices",
    roles: ["Super Admin"],
    icon: "invoices",
    shortcutNumber: 4,
  },
  {
    name: "Clients",
    path: "/clients",
    roles: ["Super Admin", "Admin", "Manager"],
    icon: "clients",
    shortcutNumber: 5,
  },
  {
    name: "Projects",
    path: "/projects",
    roles: ["Super Admin", "Admin", "Manager", "Employee"],
    icon: "projects",
    shortcutNumber: 6,
  },
  {
    name: "Reports",
    path: "/reports",
    roles: ["Super Admin", "Admin", "Manager", "Employee"],
    icon: "reports",
    shortcutNumber: 7,
  },
  {
    name: "Settings",
    path: "/settings",
    roles: ["Super Admin", "Admin"],
    icon: "settings",
    shortcutNumber: 8,
  },
];

const iconPaths: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z" />
    </>
  ),
  clients: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  projects: (
    <>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-10Z" />
      <path d="M3 10h18" />
    </>
  ),
  team: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
      <path d="M18 4.5a4 4 0 0 1 0 7M21 15.5a7 7 0 0 1 2 5.5" />
    </>
  ),
  time: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  reports: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  invoices: (
    <>
      <path d="M6 2h9l4 4v16l-3-2-3 2-3-2-3 2-3-2V4a2 2 0 0 1 2-2Z" />
      <path d="M14 2v5h5M8 11h7M8 15h7" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.14.4.36.75.66 1 .3.25.68.39 1.08.4H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </>
  ),
};

function NavigationIcon({ name }: { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
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

function isMobileBrowser() {
  const userAgent = navigator.userAgent || "";
  const reportsMobileDevice =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
      userAgent,
    );
  const isIPadRequestingDesktopSite =
    /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;

  return reportsMobileDevice || isIPadRequestingDesktopSite;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  useEffect(() => {
    async function checkUser() {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("user_id", data.user.id)
        .single();

      const resolvedRole = String(profile?.role || "User").trim();
      setUserName(profile?.full_name || data.user.email?.split("@")[0] || "");
      setUserRole(resolvedRole);
      setAccessState(
        isMobileBrowser() && !isAdminLevelRole(resolvedRole)
          ? "mobile-blocked"
          : "allowed",
      );
    }

    void checkUser();
  }, [router]);

  const menu = allMenu.filter((item) => item.roles.includes(userRole));

  useEffect(() => {
    if (!userRole || accessState !== "allowed") return;
    const allowed = allMenu.find((item) => item.path === pathname);
    if (allowed && !allowed.roles.includes(userRole))
      router.replace("/timer");
  }, [accessState, pathname, router, userRole]);

  useEffect(() => {
    if (!isProfileMenuOpen) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (
        event.target instanceof Element &&
        !event.target.closest("[data-profile-menu]")
      ) {
        setIsProfileMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsProfileMenuOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isProfileMenuOpen]);

  async function logout() {
    setIsProfileMenuOpen(false);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function navigate(path: string) {
    setIsProfileMenuOpen(false);
    setIsMobileMenuOpen(false);
    router.push(path);
  }

  function isActive(path: string) {
    return path === "/dashboard"
      ? pathname === path
      : pathname === path || pathname.startsWith(`${path}/`);
  }

  const sidebar = (
    <aside className="relative flex h-full w-[288px] flex-col overflow-hidden border-r border-slate-200 bg-white shadow-[12px_0_40px_rgba(15,23,42,0.04)]">
      <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-blue-100/60 blur-3xl" />
      <div className="relative border-b border-slate-100 px-7 pb-6 pt-7">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="rounded-xl text-left transition-opacity duration-200 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#153E90]/30"
            aria-label="Go to dashboard"
          >
            <Image
              src="/kairo-logo-full.png"
              alt="Kairo"
              width={164}
              height={48}
              priority
              className="h-auto w-[142px]"
            />
          </button>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close navigation"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="mt-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-800">
          <span className="h-px w-5 bg-[#153E90]" />
          The pulse of Despacho
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto px-4 py-6">
        <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          Workspace
        </p>
        <nav className="mt-3 space-y-1.5" aria-label="Dashboard navigation">
          {menu.map((item) => {
            const active = isActive(item.path);
            return (
              <div key={item.path}>
                <button
                  type="button"
                  onClick={() => navigate(item.path)}
                  aria-keyshortcuts={`Alt+${item.shortcutNumber}`}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#153E90]/30 ${
                    active
                      ? "bg-[#153E90] text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${active ? "bg-white/10 text-blue-200" : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-[#153E90]"}`}
                  >
                    <NavigationIcon name={item.icon} />
                  </span>
                  <span>{item.name}</span>
                  {active ? (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-300 shadow-[0_0_0_4px_rgba(147,197,253,0.12)]" />
                  ) : null}
                </button>
              </div>
            );
          })}
        </nav>
      </div>

      <div className="relative border-t border-slate-100 bg-slate-50/70 p-4">
        <div className="relative" data-profile-menu>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={isProfileMenuOpen}
            onClick={() => setIsProfileMenuOpen((open) => !open)}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#153E90]/35"
          >
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#153E90] text-xs font-bold text-white shadow-sm">
              {getInitials(userName) || "K"}
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-950">
                {userName || "Kairo User"}
              </p>
              <span className="mt-1 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#153E90]">
                {userRole || "User"}
              </span>
            </div>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isProfileMenuOpen ? "rotate-180" : ""}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {isProfileMenuOpen ? (
            <div
              role="menu"
              aria-label="Profile menu"
              className="absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10"
            >
              {isAdminLevelRole(userRole) ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => navigate("/settings")}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                >
                  <NavigationIcon name="settings" />
                  Settings
                </button>
              ) : null}
              <OpenShortcutHelpButton className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none" />
              <button
                type="button"
                role="menuitem"
                onClick={() => void logout()}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 focus:bg-red-50 focus:outline-none"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-5 w-5"
                >
                  <path d="M10 17l5-5-5-5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                </svg>
                Sign out
              </button>
            </div>
          ) : null}
        </div>
        <p className="mt-3 text-center text-[10px] font-medium tracking-wide text-slate-400">
          KAIRO · DESPACHO INC.
        </p>
      </div>
    </aside>
  );

  if (accessState === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-6">
        <div role="status" className="text-center" aria-live="polite">
          <Image
            src="/kairo-logo-full.png"
            alt="Kairo"
            width={164}
            height={48}
            priority
            className="mx-auto h-auto w-[142px]"
          />
          <div className="mx-auto mt-6 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#153E90]" />
          <p className="mt-4 text-sm font-semibold text-slate-500">
            Verifying access…
          </p>
        </div>
      </main>
    );
  }

  if (accessState === "mobile-blocked") {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f8fafc] px-5 py-10">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-slate-200/70 blur-3xl" />
        <section className="relative w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-2xl shadow-slate-300/40 sm:p-10">
          <Image
            src="/kairo-logo-full.png"
            alt="Kairo"
            width={190}
            height={56}
            priority
            className="mx-auto h-auto w-[164px]"
          />
          <div className="mx-auto mt-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-[#153E90] ring-1 ring-blue-100">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-8 w-8"
            >
              <rect x="3" y="4" width="18" height="12" rx="2" />
              <path d="M8 20h8M12 16v4" />
            </svg>
          </div>
          <p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-[#153E90]">
            Desktop access required
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Kairo is not available on mobile for your role.
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Manager and Employee accounts must use Kairo from a desktop or
            laptop browser. Please switch devices to continue.
          </p>
          <div className="mt-6 inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
            Signed in as {userRole || "User"}
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-8 w-full rounded-2xl bg-[#153E90] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:bg-[#123578] focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-200"
          >
            Sign out
          </button>
        </section>
      </main>
    );
  }

  return (
    <ShortcutProvider
      role={userRole}
      navigationItems={menu.map(({ name, path, shortcutNumber }) => ({
        name,
        path,
        shortcutNumber,
      }))}
    >
      <div className="min-h-screen bg-[#f8fafc]">
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        {sidebar}
      </div>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
          />
          <div className="relative h-full w-[288px] max-w-[86vw]">
            {sidebar}
          </div>
        </div>
      ) : null}

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl lg:hidden">
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="Open navigation"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-5 w-5"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <Image
          src="/kairo-logo-full.png"
          alt="Kairo"
          width={126}
          height={38}
          className="h-auto w-[108px]"
        />
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F172A] text-xs font-bold text-white">
          {getInitials(userName) || "K"}
        </div>
      </header>

      <main className="min-h-screen lg:pl-[288px]">{children}</main>
      </div>
    </ShortcutProvider>
  );
}
