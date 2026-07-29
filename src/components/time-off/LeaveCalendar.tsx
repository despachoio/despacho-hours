"use client";

import { useMemo, useState } from "react";
import KairoCard from "@/components/ui/KairoCard";
import type { CalendarLeave, Holiday } from "@/lib/time-off/client";
import TimeOffIcon from "./TimeOffIcon";

function monthKey(date: Date) { return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`; }

function tileColour(colour?: string) {
  return /^#[0-9a-f]{6}$/i.test(colour || "") ? `${colour}30` : "#E0E7FF";
}

function tileBorderColour(colour?: string) {
  return /^#[0-9a-f]{6}$/i.test(colour || "") ? `${colour}55` : "#C7D2FE";
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
  const daysInPreviousMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 0)).getUTCDate();
  const monthLeave = useMemo(() => leave.filter((item) => item.end_date >= `${key}-01` && item.start_date <= `${key}-${String(daysInMonth).padStart(2, "0")}` && ((item.is_own && showMine) || (!item.is_own && showTeam)) && (showPending || item.status !== "pending") && (showApproved || !["approved", "cancellation_rejected"].includes(item.status))), [daysInMonth, key, leave, showApproved, showMine, showPending, showTeam]);
  const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => index - firstDay + 1);
  const title = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(month);
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return <KairoCard className="overflow-hidden border-blue-100 p-0 shadow-[0_28px_75px_-42px_rgba(21,62,144,.85)]">
    <div className="relative flex flex-wrap items-center justify-between gap-5 overflow-hidden border-b border-white/10 bg-gradient-to-r from-slate-950 via-indigo-950 to-blue-950 px-5 py-6 text-white sm:px-7">
      <span className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl" />
      <span className="pointer-events-none absolute -bottom-32 left-1/3 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="relative flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-blue-100 shadow-xl ring-1 ring-inset ring-white/10 backdrop-blur"><TimeOffIcon name="calendar" className="h-6 w-6" /></span><div><h2 className="text-xl font-bold">Leave Calendar</h2><p className="mt-1 text-sm text-slate-300">Personal leave, team availability, and company holidays.</p></div></div>
      <div className="relative flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 p-1.5 text-white shadow-[0_18px_40px_-20px_rgba(0,0,0,.8)] ring-1 ring-inset ring-white/10 backdrop-blur"><button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)))} className="h-10 w-10 rounded-xl bg-white/10 font-bold transition hover:bg-white hover:text-[#153E90]">←</button><span className="min-w-36 text-center font-bold tracking-tight">{title}</span><button type="button" aria-label="Next month" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)))} className="h-10 w-10 rounded-xl bg-white/10 font-bold transition hover:bg-white hover:text-[#153E90]">→</button></div>
    </div>
    <div className="border-b border-blue-100 bg-gradient-to-r from-slate-50 via-white to-blue-50 px-5 py-4 text-xs font-bold text-slate-700 sm:px-7"><div className="flex flex-wrap gap-2.5"><label className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 transition ${showMine ? "border-blue-200 bg-blue-50 text-blue-800 shadow-sm ring-1 ring-blue-100" : "border-slate-200 bg-white text-slate-500"}`}><input className="accent-blue-700" type="checkbox" checked={showMine} onChange={(event) => setShowMine(event.target.checked)} />My Leave</label><label className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 transition ${showTeam ? "border-cyan-200 bg-cyan-50 text-cyan-800 shadow-sm ring-1 ring-cyan-100" : "border-slate-200 bg-white text-slate-500"}`}><input className="accent-cyan-700" type="checkbox" checked={showTeam} onChange={(event) => setShowTeam(event.target.checked)} />Team Leave</label><label className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 transition ${showHolidays ? "border-violet-200 bg-violet-50 text-violet-800 shadow-sm ring-1 ring-violet-100" : "border-slate-200 bg-white text-slate-500"}`}><input className="accent-violet-700" type="checkbox" checked={showHolidays} onChange={(event) => setShowHolidays(event.target.checked)} />Holidays</label><label className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 transition ${showPending ? "border-amber-200 bg-amber-50 text-amber-800 shadow-sm ring-1 ring-amber-100" : "border-slate-200 bg-white text-slate-500"}`}><input className="accent-amber-700" type="checkbox" checked={showPending} onChange={(event) => setShowPending(event.target.checked)} />Pending</label><label className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 transition ${showApproved ? "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-100" : "border-slate-200 bg-white text-slate-500"}`}><input className="accent-emerald-700" type="checkbox" checked={showApproved} onChange={(event) => setShowApproved(event.target.checked)} />Approved</label></div></div>
    <div className="overflow-x-auto bg-[#f2f3ff] p-3 sm:p-6"><div className="min-w-[840px]"><div className="mb-3 grid grid-cols-7 overflow-hidden rounded-full bg-gradient-to-r from-indigo-200/90 via-violet-100 to-indigo-200/90 px-3 text-center text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-950 shadow-sm ring-1 ring-indigo-200">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => <div key={day} className={`relative px-2 py-3 ${index < 6 ? "after:absolute after:right-0 after:top-2.5 after:h-4 after:w-px after:bg-indigo-400/50" : ""}`}>{day}</div>)}</div><div className="grid grid-cols-7 gap-2.5">{cells.map((day, index) => {
      const date = `${key}-${String(Math.max(day, 1)).padStart(2, "0")}`;
      const items = day > 0 && day <= daysInMonth ? monthLeave.filter((item) => item.start_date <= date && item.end_date >= date) : [];
      const dateHolidays = showHolidays && day > 0 && day <= daysInMonth ? holidays.filter((holiday) => holiday.holiday_date === date) : [];
      const inMonth = day > 0 && day <= daysInMonth;
      const weekend = index % 7 === 0 || index % 7 === 6;
      const isToday = inMonth && date === todayKey;
      const displayDay = day < 1 ? daysInPreviousMonth + day : day > daysInMonth ? day - daysInMonth : day;
      const highlightColour = dateHolidays.length ? "#7C3AED" : items[0] ? (items[0].status === "pending" ? "#D97706" : items[0].colour || "#2563EB") : undefined;
      return <div key={`${key}-${index}`} className={`relative flex min-h-36 flex-col rounded-2xl border p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${!inMonth ? "border-white/70 bg-white/45 text-indigo-400" : highlightColour ? "text-slate-900" : "border-white bg-white/95 text-slate-700"} ${isToday ? "z-[1] ring-2 ring-cyan-500 ring-offset-2 ring-offset-[#f2f3ff]" : ""}`} style={inMonth && highlightColour ? { backgroundColor: tileColour(highlightColour), borderColor: tileBorderColour(highlightColour) } : undefined}><div className="flex items-center justify-between"><span className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-sm font-bold ${isToday ? "bg-gradient-to-br from-blue-700 to-cyan-500 text-white shadow-md shadow-cyan-200" : inMonth && weekend ? "text-indigo-700" : ""}`}>{displayDay}</span>{isToday ? <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-700">Today</span> : null}</div>{inMonth ? <div className="mt-auto space-y-1.5 pt-3">{dateHolidays.map((holiday) => <div key={holiday.id} title={holiday.name} className="truncate rounded-lg border border-white/70 bg-white/65 px-2 py-1.5 text-[10px] font-bold text-violet-800 shadow-sm backdrop-blur">◆ {holiday.name}</div>)}{items.slice(0, 3).map((item) => {
        const colour = item.status === "pending" ? "#D97706" : item.colour || "#153E90";
        return <div key={item.id} title={`${item.employee_name} · ${item.leave_type_name}`} className="truncate rounded-lg border-l-[3px] bg-white/70 px-2 py-1.5 text-[10px] font-bold shadow-sm backdrop-blur" style={{ borderColor: colour, color: colour }}>{item.is_own ? "You" : item.employee_name} · {item.leave_type_code}</div>;
      })}{items.length > 3 ? <p className="rounded-md bg-white/70 px-2 py-1 text-[10px] font-bold text-slate-500">+{items.length - 3} more</p> : null}</div> : null}</div>;
    })}</div></div></div>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 bg-white px-6 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-500"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-violet-500" />Company holiday</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-amber-500" />Pending leave</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Approved leave</span><span className="ml-auto normal-case tracking-normal text-slate-400">Colours reflect each leave type.</span></div>
  </KairoCard>;
}
