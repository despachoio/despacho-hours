"use client";

import { useCallback, useEffect, useState } from "react";
import KairoButton from "@/components/ui/KairoButton";
import TimeOffDashboard from "./TimeOffDashboard";
import RequestLeaveDialog from "./RequestLeaveDialog";
import MyLeaveRequests from "./MyLeaveRequests";
import LeaveCalendar from "./LeaveCalendar";
import ApprovalCentre from "./ApprovalCentre";
import TimeOffAdmin from "./TimeOffAdmin";
import TimeOffPolicy from "./TimeOffPolicy";
import {
  loadTimeOffAdminData,
  loadTimeOffData,
  type TimeOffAdminData,
  type TimeOffData,
} from "@/lib/time-off/client";
import { businessDateKey } from "@/lib/metrics/date-ranges";
import TimeOffIcon, { type TimeOffIconName } from "./TimeOffIcon";

type Tab = "overview" | "requests" | "calendar" | "approvals" | "admin" | "policy";

export default function TimeOffWorkspace() {
  const currentYear = Number(businessDateKey().slice(0, 4));
  const year = currentYear;
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<TimeOffData | null>(null);
  const [adminData, setAdminData] = useState<TimeOffAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const next = await loadTimeOffData(year);
        if (cancelled) return;
        setData(next);
        const normalizedRole = String(next.profile.role || "").trim().toLowerCase();
        if (["super admin", "finance admin"].includes(normalizedRole)) {
          setAdminData(await loadTimeOffAdminData());
        } else setAdminData(null);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load Time Off.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [refreshKey, year]);

  const role = String(data?.profile.role || "").trim().toLowerCase();
  const isAdmin = ["admin", "super admin", "finance admin"].includes(role);
  const canAdminister = ["super admin", "finance admin"].includes(role);
  const canApprove = isAdmin || role === "manager";
  const tabs: Array<[Tab, string, number | null, TimeOffIconName]> = [
    ["overview", "Overview", null, "chart"],
    ["requests", "My Requests", data?.requests.length || 0, "document"],
    ["calendar", "Calendar", null, "calendar"],
    ...(canApprove ? [["approvals", "Approvals", data?.approvalQueue.length || 0, "check"] as [Tab, string, number, TimeOffIconName]] : []),
    ...(canAdminister ? [["admin", "Administration", null, "settings"] as [Tab, string, null, TimeOffIconName]] : []),
    ["policy", "Policy", null, "shield"],
  ];

  return <main className="min-h-screen bg-[#F8FAFC] px-5 py-7 sm:px-8">
    <div className="mx-auto max-w-[1500px]">
      <header className="relative min-h-[220px] overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#0F172A] via-[#172554] to-[#153E90] px-6 py-8 text-white shadow-xl shadow-slate-300/50 sm:px-8 sm:py-9 lg:px-12 lg:py-10">
        <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" /><div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="relative flex min-h-[156px] flex-col justify-between gap-8 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200">People & wellbeing</p><h1 className="mt-2 text-4xl font-bold tracking-tight lg:text-5xl">Time Off</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Plan leave, protect team capacity, and keep every policy decision clear and auditable.</p></div><span className="inline-flex w-fit rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-blue-100 backdrop-blur">{role || "employee"} experience</span></div>
      </header>

      <div className="relative z-10 mx-3 -mt-4 flex min-h-[64px] items-center gap-2 overflow-x-auto rounded-2xl border border-white/80 bg-white/95 p-2 shadow-[0_18px_45px_-28px_rgba(15,23,42,.7)] backdrop-blur sm:mx-6">{tabs.map(([value, label, count, icon]) => <button key={value} type="button" onClick={() => setTab(value)} className={`group flex h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition duration-200 ${tab === value ? "bg-gradient-to-r from-[#153E90] to-blue-700 text-white shadow-lg shadow-blue-900/20" : "text-slate-500 hover:bg-blue-50 hover:text-[#153E90]"}`}><TimeOffIcon name={icon} className="h-4 w-4" />{label}{count !== null ? <span className={`rounded-full px-2 py-0.5 text-[10px] ${tab === value ? "bg-white/15" : "bg-slate-100 group-hover:bg-white"}`}>{count}</span> : null}</button>)}</div>

      <div className="mt-7">
        {loading ? <LoadingState /> : error || !data ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"><p className="font-bold">Unable to load Time Off</p><p className="mt-1 text-sm">{error}</p><KairoButton type="button" className="mt-4" onClick={refresh}>Try Again</KairoButton></div> : <>{tab === "overview" ? <TimeOffDashboard dashboard={data.dashboard} requests={data.requests} upcomingRequests={data.upcomingRequests} holidays={data.holidays} notifications={data.notifications} onChanged={refresh} onRequestLeave={() => setRequestOpen(true)} /> : null}{tab === "requests" ? <MyLeaveRequests requests={data.requests} leaveTypes={data.leaveTypes} onChanged={refresh} /> : null}{tab === "calendar" ? <LeaveCalendar leave={data.calendar} holidays={data.holidays} /> : null}{tab === "approvals" && canApprove ? <ApprovalCentre requests={data.approvalQueue} managedEmployees={data.managedEmployees} managedRequests={data.managedRequests} calendar={data.calendar} balances={data.managerBalances} recent={data.recentTeamRequests} isAdmin={isAdmin} onChanged={refresh} /> : null}{tab === "admin" && canAdminister && adminData ? <TimeOffAdmin data={adminData} leaveTypes={data.leaveTypes} holidays={data.holidays} onChanged={refresh} /> : null}{tab === "policy" ? <TimeOffPolicy /> : null}<RequestLeaveDialog open={requestOpen} employeeId={data.profile.employee_id} employeeGender={data.profile.gender} leaveTypes={data.leaveTypes} isAdmin={isAdmin} onClose={() => setRequestOpen(false)} onSubmitted={refresh} /></>}
      </div>
    </div>
  </main>;
}

function LoadingState() {
  return <div role="status" aria-live="polite" className="space-y-5"><span className="sr-only">Loading Time Off</span><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-200" />)}</div><div className="grid gap-5 xl:grid-cols-2"><div className="h-80 animate-pulse rounded-2xl bg-slate-200" /><div className="h-80 animate-pulse rounded-2xl bg-slate-200" /></div></div>;
}
