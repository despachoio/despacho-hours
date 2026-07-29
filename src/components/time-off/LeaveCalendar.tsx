"use client";

import { useMemo, useState } from "react";
import KairoCard from "@/components/ui/KairoCard";
import type { CalendarLeave, Holiday } from "@/lib/time-off/client";

function monthKey(date: Date) { return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`; }

export default function LeaveCalendar({ leave, holidays }: { leave: CalendarLeave[]; holidays: Holiday[] }) {
  const now = new Date();
  const [month, setMonth] = useState(() => new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)));
  const [showMine, setShowMine] = useState(true);
  const [showTeam, setShowTeam] = useState(true);
  const [showHolidays, setShowHolidays] = useState(true);
  const [showPending, setShowPending] = useState(true);
  const [showApproved, setShowApproved] = useState(true);
  const [leaveType, setLeaveType] = useState("all");
  const [department, setDepartment] = useState("all");
  const [manager, setManager] = useState("all");
  const [employee, setEmployee] = useState("all");
  const key = monthKey(month);
  const firstDay = month.getUTCDay();
  const daysInMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const monthLeave = useMemo(() => leave.filter((item) => item.end_date >= `${key}-01` && item.start_date <= `${key}-${String(daysInMonth).padStart(2, "0")}` && ((item.is_own && showMine) || (!item.is_own && showTeam)) && (showPending || item.status !== "pending") && (showApproved || !["approved", "cancellation_rejected"].includes(item.status)) && (leaveType === "all" || item.leave_type_code === leaveType) && (department === "all" || item.department === department) && (manager === "all" || item.reporting_manager_id === manager) && (employee === "all" || item.employee_id === employee)), [daysInMonth, department, employee, key, leave, leaveType, manager, showApproved, showMine, showPending, showTeam]);
  const types = Array.from(new Map(leave.map((item) => [item.leave_type_code, item.leave_type_name])).entries());
  const departments = Array.from(new Set(leave.map((item) => item.department).filter(Boolean))) as string[];
  const managers = Array.from(new Map(leave.filter((item) => item.reporting_manager_id).map((item) => [item.reporting_manager_id as string, item.manager_name || "Manager"])).entries());
  const employees = Array.from(new Map(leave.map((item) => [item.employee_id, item.employee_name])).entries());
  const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => index - firstDay + 1);
  const title = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(month);

  return <KairoCard className="overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="text-xl font-bold text-slate-950">Leave Calendar</h2><p className="mt-1 text-sm text-slate-500">Personal leave, team availability, and company holidays.</p></div><div className="flex items-center gap-2"><button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)))} className="h-10 w-10 rounded-xl border">←</button><span className="min-w-36 text-center font-bold">{title}</span><button type="button" aria-label="Next month" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)))} className="h-10 w-10 rounded-xl border">→</button></div></div>
    <div className="border-b border-slate-100 bg-slate-50 px-6 py-3 text-xs font-bold text-slate-600"><div className="flex flex-wrap gap-4"><label className="flex items-center gap-2"><input type="checkbox" checked={showMine} onChange={(event) => setShowMine(event.target.checked)} />My Leave</label><label className="flex items-center gap-2"><input type="checkbox" checked={showTeam} onChange={(event) => setShowTeam(event.target.checked)} />Team Leave</label><label className="flex items-center gap-2"><input type="checkbox" checked={showHolidays} onChange={(event) => setShowHolidays(event.target.checked)} />Holidays</label><label className="flex items-center gap-2"><input type="checkbox" checked={showPending} onChange={(event) => setShowPending(event.target.checked)} />Pending</label><label className="flex items-center gap-2"><input type="checkbox" checked={showApproved} onChange={(event) => setShowApproved(event.target.checked)} />Approved</label></div><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><select aria-label="Filter calendar by leave type" value={leaveType} onChange={(event) => setLeaveType(event.target.value)} className="rounded-lg border bg-white px-3 py-2"><option value="all">All leave types</option>{types.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select><select aria-label="Filter calendar by department" value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-lg border bg-white px-3 py-2"><option value="all">All departments</option>{departments.map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Filter calendar by manager" value={manager} onChange={(event) => setManager(event.target.value)} className="rounded-lg border bg-white px-3 py-2"><option value="all">All managers</option>{managers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><select aria-label="Filter calendar by employee" value={employee} onChange={(event) => setEmployee(event.target.value)} className="rounded-lg border bg-white px-3 py-2"><option value="all">All employees</option>{employees.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div></div>
    <div className="overflow-x-auto"><div className="min-w-[780px]"><div className="grid grid-cols-7 bg-slate-50 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="border-b border-r border-slate-100 px-2 py-3">{day}</div>)}</div><div className="grid grid-cols-7">{cells.map((day, index) => {
      const date = `${key}-${String(Math.max(day, 1)).padStart(2, "0")}`;
      const items = day > 0 && day <= daysInMonth ? monthLeave.filter((item) => item.start_date <= date && item.end_date >= date) : [];
      const dateHolidays = showHolidays && day > 0 && day <= daysInMonth ? holidays.filter((holiday) => holiday.holiday_date === date) : [];
      return <div key={`${key}-${index}`} className={`min-h-32 border-b border-r border-slate-100 p-2 ${day <= 0 || day > daysInMonth ? "bg-slate-50/70" : "bg-white"}`}>{day > 0 && day <= daysInMonth ? <><span className="text-xs font-bold text-slate-500">{day}</span><div className="mt-2 space-y-1">{dateHolidays.map((holiday) => <div key={holiday.id} title={holiday.name} className="truncate rounded-md bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700">◆ {holiday.name}</div>)}{items.slice(0, 3).map((item) => <div key={item.id} title={`${item.employee_name} · ${item.leave_type_name}`} className="truncate rounded-md px-2 py-1 text-[10px] font-bold text-white" style={{ backgroundColor: item.status === "pending" ? "#D97706" : item.colour }}>{item.is_own ? "You" : item.employee_name} · {item.leave_type_code}</div>)}{items.length > 3 ? <p className="text-[10px] font-bold text-slate-400">+{items.length - 3} more</p> : null}</div></> : null}</div>;
    })}</div></div></div>
  </KairoCard>;
}
