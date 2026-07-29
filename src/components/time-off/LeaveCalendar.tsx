"use client";

import { useMemo, useState } from "react";
import KairoCard from "@/components/ui/KairoCard";
import type { CalendarLeave, Holiday } from "@/lib/time-off/client";
import TimeOffIcon from "./TimeOffIcon";

function monthKey(date: Date) { return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`; }

function softColour(colour?: string) {
  return /^#[0-9a-f]{6}$/i.test(colour || "") ? `${colour}18` : "#DBEAFE";
}

export default function LeaveCalendar({ leave, holidays }: { leave: CalendarLeave[]; holidays: Holiday[] }) {
  const now = new Date();
  const [month, setMonth] = useState(() => new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)));
  const [showMine, setShowMine] = useState(true);
  const [showTeam, setShowTeam] = useState(true);
  const [showHolidays, setShowHolidays] = useState(true);
  const [showPending, setShowPending] = useState(true);
  const [showApproved, setShowApproved] = useState(true);
  const key = monthKey(month);
  const firstDay = month.getUTCDay();
  const daysInMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const monthLeave = useMemo(() => leave.filter((item) => item.end_date >= `${key}-01` && item.start_date <= `${key}-${String(daysInMonth).padStart(2, "0")}` && ((item.is_own && showMine) || (!item.is_own && showTeam)) && (showPending || item.status !== "pending") && (showApproved || !["approved", "cancellation_rejected"].includes(item.status))), [daysInMonth, key, leave, showApproved, showMine, showPending, showTeam]);
  const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => index - firstDay + 1);
  const title = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(month);
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return <KairoCard className="overflow-hidden border-blue-100 p-0 shadow-[0_28px_75px_-42px_rgba(21,62,144,.85)]">
    <div className="relative flex flex-wrap items-center justify-between gap-5 overflow-hidden bg-gradient-to-r from-[#0F172A] via-[#153E90] to-violet-700 px-5 py-5 text-white sm:px-7">
      <span className="pointer-events-none absolute -right-14 -top-20 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="relative flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-cyan-100 shadow-lg backdrop-blur"><TimeOffIcon name="calendar" className="h-6 w-6" /></span><div><h2 className="text-xl font-bold">Leave Calendar</h2><p className="mt-1 text-sm text-blue-100">Personal leave, team availability, and company holidays.</p></div></div>
      <div className="relative flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 p-1.5 shadow-xl backdrop-blur"><button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)))} className="h-10 w-10 rounded-xl bg-white/10 font-bold transition hover:bg-white hover:text-[#153E90]">←</button><span className="min-w-36 text-center font-bold">{title}</span><button type="button" aria-label="Next month" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)))} className="h-10 w-10 rounded-xl bg-white/10 font-bold transition hover:bg-white hover:text-[#153E90]">→</button></div>
    </div>
    <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-violet-50 px-5 py-4 text-xs font-bold text-slate-700 sm:px-7"><div className="flex flex-wrap gap-2.5"><label className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 transition ${showMine ? "border-blue-200 bg-blue-100 text-blue-800 shadow-sm" : "border-slate-200 bg-white text-slate-500"}`}><input className="accent-blue-600" type="checkbox" checked={showMine} onChange={(event) => setShowMine(event.target.checked)} />My Leave</label><label className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 transition ${showTeam ? "border-cyan-200 bg-cyan-100 text-cyan-800 shadow-sm" : "border-slate-200 bg-white text-slate-500"}`}><input className="accent-cyan-600" type="checkbox" checked={showTeam} onChange={(event) => setShowTeam(event.target.checked)} />Team Leave</label><label className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 transition ${showHolidays ? "border-violet-200 bg-violet-100 text-violet-800 shadow-sm" : "border-slate-200 bg-white text-slate-500"}`}><input className="accent-violet-600" type="checkbox" checked={showHolidays} onChange={(event) => setShowHolidays(event.target.checked)} />Holidays</label><label className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 transition ${showPending ? "border-amber-200 bg-amber-100 text-amber-800 shadow-sm" : "border-slate-200 bg-white text-slate-500"}`}><input className="accent-amber-600" type="checkbox" checked={showPending} onChange={(event) => setShowPending(event.target.checked)} />Pending</label><label className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 transition ${showApproved ? "border-emerald-200 bg-emerald-100 text-emerald-800 shadow-sm" : "border-slate-200 bg-white text-slate-500"}`}><input className="accent-emerald-600" type="checkbox" checked={showApproved} onChange={(event) => setShowApproved(event.target.checked)} />Approved</label></div></div>
    <div className="overflow-x-auto bg-slate-50/60 p-3 sm:p-5"><div className="min-w-[840px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="grid grid-cols-7 bg-gradient-to-r from-slate-900 via-[#153E90] to-violet-800 text-center text-[10px] font-bold uppercase tracking-[0.15em] text-white">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => <div key={day} className={`border-r border-white/10 px-2 py-3.5 ${index === 0 || index === 6 ? "bg-white/10 text-cyan-100" : ""}`}>{day}</div>)}</div><div className="grid grid-cols-7">{cells.map((day, index) => {
      const date = `${key}-${String(Math.max(day, 1)).padStart(2, "0")}`;
      const items = day > 0 && day <= daysInMonth ? monthLeave.filter((item) => item.start_date <= date && item.end_date >= date) : [];
      const dateHolidays = showHolidays && day > 0 && day <= daysInMonth ? holidays.filter((holiday) => holiday.holiday_date === date) : [];
      const inMonth = day > 0 && day <= daysInMonth;
      const weekend = index % 7 === 0 || index % 7 === 6;
      const isToday = inMonth && date === todayKey;
      return <div key={`${key}-${index}`} className={`relative min-h-36 border-b border-r border-slate-100 p-2.5 transition ${!inMonth ? "bg-slate-50/80" : weekend ? "bg-blue-50/35 hover:bg-blue-50/70" : "bg-white hover:bg-slate-50"} ${isToday ? "ring-2 ring-inset ring-blue-500" : ""}`}>{inMonth ? <><div className="flex items-center justify-between"><span className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-bold ${isToday ? "bg-blue-600 text-white shadow-md shadow-blue-200" : weekend ? "text-blue-700" : "text-slate-600"}`}>{day}</span>{isToday ? <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600">Today</span> : null}</div><div className="mt-2 space-y-1.5">{dateHolidays.map((holiday) => <div key={holiday.id} title={holiday.name} className="truncate rounded-lg border border-violet-200 bg-gradient-to-r from-violet-100 to-fuchsia-50 px-2 py-1.5 text-[10px] font-bold text-violet-800 shadow-sm">◆ {holiday.name}</div>)}{items.slice(0, 3).map((item) => {
        const colour = item.status === "pending" ? "#D97706" : item.colour || "#153E90";
        return <div key={item.id} title={`${item.employee_name} · ${item.leave_type_name}`} className="truncate rounded-lg border-l-[3px] px-2 py-1.5 text-[10px] font-bold shadow-sm" style={{ borderColor: colour, backgroundColor: softColour(colour), color: colour }}>{item.is_own ? "You" : item.employee_name} · {item.leave_type_code}</div>;
      })}{items.length > 3 ? <p className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">+{items.length - 3} more</p> : null}</div></> : null}</div>;
    })}</div></div></div>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 bg-white px-6 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-violet-500" />Company holiday</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-amber-500" />Pending leave</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Approved leave</span><span className="ml-auto normal-case tracking-normal text-slate-400">Colours reflect each leave type.</span></div>
  </KairoCard>;
}
