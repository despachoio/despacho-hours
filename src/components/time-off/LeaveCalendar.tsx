"use client";

import { useMemo, useState } from "react";
import KairoCard from "@/components/ui/KairoCard";
import type { CalendarLeave, Holiday } from "@/lib/time-off/client";
import TimeOffIcon from "./TimeOffIcon";

function monthKey(date: Date) { return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`; }

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

  return <KairoCard className="overflow-hidden border-white/80 shadow-[0_24px_60px_-40px_rgba(21,62,144,.75)]">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/80 bg-gradient-to-r from-blue-50/90 via-white to-violet-50/70 px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><TimeOffIcon name="calendar" className="h-5 w-5" /></span><div><h2 className="text-xl font-bold text-slate-950">Leave Calendar</h2><p className="mt-1 text-sm text-slate-500">Personal leave, team availability, and company holidays.</p></div></div><div className="flex items-center gap-2 rounded-2xl bg-white p-1.5 shadow-sm"><button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)))} className="h-10 w-10 rounded-xl border border-slate-100 transition hover:bg-blue-50">←</button><span className="min-w-36 text-center font-bold">{title}</span><button type="button" aria-label="Next month" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)))} className="h-10 w-10 rounded-xl border border-slate-100 transition hover:bg-blue-50">→</button></div></div>
    <div className="border-b border-slate-100 bg-slate-50 px-6 py-3 text-xs font-bold text-slate-600"><div className="flex flex-wrap gap-4"><label className="flex items-center gap-2"><input type="checkbox" checked={showMine} onChange={(event) => setShowMine(event.target.checked)} />My Leave</label><label className="flex items-center gap-2"><input type="checkbox" checked={showTeam} onChange={(event) => setShowTeam(event.target.checked)} />Team Leave</label><label className="flex items-center gap-2"><input type="checkbox" checked={showHolidays} onChange={(event) => setShowHolidays(event.target.checked)} />Holidays</label><label className="flex items-center gap-2"><input type="checkbox" checked={showPending} onChange={(event) => setShowPending(event.target.checked)} />Pending</label><label className="flex items-center gap-2"><input type="checkbox" checked={showApproved} onChange={(event) => setShowApproved(event.target.checked)} />Approved</label></div></div>
    <div className="overflow-x-auto"><div className="min-w-[780px]"><div className="grid grid-cols-7 bg-slate-50 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="border-b border-r border-slate-100 px-2 py-3">{day}</div>)}</div><div className="grid grid-cols-7">{cells.map((day, index) => {
      const date = `${key}-${String(Math.max(day, 1)).padStart(2, "0")}`;
      const items = day > 0 && day <= daysInMonth ? monthLeave.filter((item) => item.start_date <= date && item.end_date >= date) : [];
      const dateHolidays = showHolidays && day > 0 && day <= daysInMonth ? holidays.filter((holiday) => holiday.holiday_date === date) : [];
      return <div key={`${key}-${index}`} className={`min-h-32 border-b border-r border-slate-100 p-2 ${day <= 0 || day > daysInMonth ? "bg-slate-50/70" : "bg-white"}`}>{day > 0 && day <= daysInMonth ? <><span className="text-xs font-bold text-slate-500">{day}</span><div className="mt-2 space-y-1">{dateHolidays.map((holiday) => <div key={holiday.id} title={holiday.name} className="truncate rounded-md bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700">◆ {holiday.name}</div>)}{items.slice(0, 3).map((item) => <div key={item.id} title={`${item.employee_name} · ${item.leave_type_name}`} className="truncate rounded-md px-2 py-1 text-[10px] font-bold text-white" style={{ backgroundColor: item.status === "pending" ? "#D97706" : item.colour }}>{item.is_own ? "You" : item.employee_name} · {item.leave_type_code}</div>)}{items.length > 3 ? <p className="text-[10px] font-bold text-slate-400">+{items.length - 3} more</p> : null}</div></> : null}</div>;
    })}</div></div></div>
  </KairoCard>;
}
