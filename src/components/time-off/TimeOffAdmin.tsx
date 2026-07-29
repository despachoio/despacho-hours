"use client";

import { useMemo, useState } from "react";
import KairoButton from "@/components/ui/KairoButton";
import KairoCard from "@/components/ui/KairoCard";
import KairoInput from "@/components/ui/KairoInput";
import KairoSelect from "@/components/ui/KairoSelect";
import KairoTextarea from "@/components/ui/KairoTextarea";
import {
  adjustLeaveBalance,
  closeEmployeeLeaveYear,
  deleteFutureHoliday,
  duplicateHolidayCalendar,
  loadYearEndPreview,
  loadTimeOffUsageRows,
  processLeaveEncashment,
  reverseLeaveYearClosure,
  saveHoliday,
  saveHolidayCalendar,
  saveLeavePolicy,
  saveLeaveType,
  savePolicyRule,
  type Holiday,
  type LeaveType,
  type TimeOffAdminData,
} from "@/lib/time-off/client";
import { businessDateKey } from "@/lib/metrics/date-ranges";
import { compareEmployeeCodes, employeeOptionLabel } from "@/lib/time-off/employee-order";
import TimeOffBalanceExportButtons from "./TimeOffBalanceExportButtons";
import TimeOffIcon, { type TimeOffIconName } from "./TimeOffIcon";

type AdminTab = "types" | "policies" | "holidays" | "balances" | "exceptions" | "year_end" | "reports" | "audit";

function sortedEmployees(employees: TimeOffAdminData["employees"]) {
  return [...employees].sort((left, right) => compareEmployeeCodes(
    left.employee_code,
    right.employee_code,
    left.name,
    right.name,
  ));
}

function employeeName(employee: TimeOffAdminData["employees"][number]) {
  return [employee.title, employee.name].filter(Boolean).join(" ");
}

export default function TimeOffAdmin({ data, leaveTypes, holidays, onChanged }: { data: TimeOffAdminData; leaveTypes: LeaveType[]; holidays: Holiday[]; onChanged: () => void }) {
  const [tab, setTab] = useState<AdminTab>("types");
  const tabs: Array<[AdminTab, string, TimeOffIconName]> = [["types", "Leave Types", "document"], ["policies", "Policies", "shield"], ["holidays", "Holiday Calendars", "calendar"], ["balances", "Balances & Adjustments", "wallet"], ["exceptions", "Extended Exceptions", "alert"], ["year_end", "Year-End & Encashment", "clock"], ["reports", "Reports", "chart"], ["audit", "Audit Log", "inbox"]];
  return <div className="space-y-5">
<div className="flex gap-2 overflow-x-auto rounded-2xl border border-white/80 bg-gradient-to-r from-slate-50 via-white to-blue-50/60 p-2 shadow-[0_18px_45px_-32px_rgba(15,23,42,.75)]">{tabs.map(([value, label, icon]) => <button key={value} type="button" onClick={() => setTab(value)} className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${tab === value ? "bg-gradient-to-r from-[#0F172A] to-[#153E90] text-white shadow-lg" : "text-slate-500 hover:bg-white hover:text-[#153E90] hover:shadow-sm"}`}><TimeOffIcon name={icon} className="h-4 w-4" />{label}</button>)}</div>{tab === "types" ? <LeaveTypesAdmin leaveTypes={leaveTypes} onChanged={onChanged} /> : null}{tab === "policies" ? <PolicyAdmin data={data} onChanged={onChanged} /> : null}{tab === "holidays" ? <HolidayAdmin data={data} holidays={holidays} onChanged={onChanged} /> : null}{tab === "balances" ? <AdjustmentAdmin data={data} leaveTypes={leaveTypes} onChanged={onChanged} /> : null}{tab === "exceptions" ? <ExtendedExceptionsAdmin data={data} /> : null}{tab === "year_end" ? <YearEndAdmin data={data} onChanged={onChanged} /> : null}{tab === "reports" ? <TimeOffReports data={data} holidays={holidays} /> : null}{tab === "audit" ? <AuditLog data={data} /> : null}</div>;
}

function LeaveTypesAdmin({ leaveTypes, onChanged }: { leaveTypes: LeaveType[]; onChanged: () => void }) {
  const empty = { name: "", code: "", description: "", is_paid: true, is_active: true, colour: "#153E90", gender_eligibility: "All", minimum_service_months: 0, maximum_days_per_request: null as number | null, annual_limit: null as number | null, monthly_limit: null as number | null, half_day_allowed: true, exclude_holidays: true, exclude_weekends: true, documents_required: false, negative_balance_allowed: false, manager_approval_required: true, display_order: 60 };
  const [form, setForm] = useState<Partial<LeaveType> & typeof empty>(empty);
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  async function save(event: React.FormEvent) { event.preventDefault(); setSaving(true); setMessage(""); try { await saveLeaveType(form); setForm(empty); setMessage("Leave type saved."); onChanged(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to save leave type."); } finally { setSaving(false); } }
  return <div className="grid gap-6 xl:grid-cols-[1fr_.8fr]">
<KairoCard className="overflow-hidden">
<div className="border-b px-6 py-5">
<h2 className="text-xl font-bold">Leave Types</h2>
<p className="mt-1 text-sm text-slate-500">Configure eligibility, limits, and calendar behaviour.</p>
</div>
<div className="divide-y">{leaveTypes.map((type) => <button type="button" key={type.id} onClick={() => setForm({ ...empty, ...type, description: type.description || "" })} className="flex w-full items-center gap-4 px-6 py-4 text-left hover:bg-slate-50">
<span className="h-10 w-2 rounded-full" style={{ backgroundColor: type.colour }} />
<div className="flex-1">
<p className="font-bold">{type.name} <span className="text-xs text-slate-400">{type.code}</span>
</p>
<p className="mt-1 text-xs text-slate-500">{type.is_paid ? "Paid" : "Unpaid"} · Half-day enabled · {type.is_active ? "Active" : "Inactive"}</p>
</div>
<span className="text-sm font-bold text-[#153E90]">Edit</span>
</button>)}</div>
</KairoCard>
<KairoCard className="p-6">
<h2 className="text-lg font-bold">{form.id ? "Edit leave type" : "Add leave type"}</h2>
<form onSubmit={save} className="mt-5 space-y-4">
<div className="grid gap-4 sm:grid-cols-2">
<KairoInput id="type-name" label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
<KairoInput id="type-code" label="Code" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
</div>
<KairoTextarea id="type-description" label="Description" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
<div className="grid gap-4 sm:grid-cols-2">
<KairoSelect id="type-gender" label="Gender eligibility" value={form.gender_eligibility} onChange={(e) => setForm({ ...form, gender_eligibility: e.target.value })}>
<option>All</option>
<option>Male</option>
<option>Female</option>
<option>Others</option>
</KairoSelect>
<KairoInput id="type-colour" type="color" label="Calendar colour" value={form.colour} onChange={(e) => setForm({ ...form, colour: e.target.value })} />
</div>
<div className="grid gap-4 sm:grid-cols-3">
<KairoInput id="type-service" type="number" min="0" label="Minimum service months" value={form.minimum_service_months} onChange={(e) => setForm({ ...form, minimum_service_months: Number(e.target.value) })} />
<KairoInput id="type-request-limit" type="number" min="0.5" step="0.5" label="Max days/request" value={form.maximum_days_per_request ?? ""} onChange={(e) => setForm({ ...form, maximum_days_per_request: e.target.value ? Number(e.target.value) : null })} />
<KairoInput id="type-annual-limit" type="number" min="0.5" step="0.5" label="Annual limit" value={form.annual_limit ?? ""} onChange={(e) => setForm({ ...form, annual_limit: e.target.value ? Number(e.target.value) : null })} />
<KairoInput id="type-monthly-limit" type="number" min="0.5" step="0.5" label="Monthly limit" value={form.monthly_limit ?? ""} onChange={(e) => setForm({ ...form, monthly_limit: e.target.value ? Number(e.target.value) : null })} />
<KairoInput id="type-display-order" type="number" min="0" label="Display order" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} />
</div>
<div className="grid gap-2 text-sm sm:grid-cols-2">{[["is_paid", "Paid leave"], ["is_active", "Active"], ["half_day_allowed", "Allow half-day"], ["exclude_holidays", "Exclude holidays"], ["exclude_weekends", "Exclude weekends"], ["documents_required", "Documents required"], ["negative_balance_allowed", "Allow negative balance"], ["manager_approval_required", "Manager approval required"]].map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-lg bg-slate-50 p-3">
<input type="checkbox" checked={Boolean(form[key as keyof typeof form])} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />{label}</label>)}</div>{message ? <p className="text-sm font-semibold text-slate-600">{message}</p> : null}<div className="flex gap-3">
<KairoButton type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</KairoButton>{form.id ? <KairoButton type="button" variant="secondary" onClick={() => setForm(empty)}>Cancel</KairoButton> : null}</div>
</form>
</KairoCard>
</div>;
}

function PolicyAdminLegacy({ data }: { data: TimeOffAdminData }) {
  return <div className="grid gap-6 xl:grid-cols-[.75fr_1.25fr]">
<KairoCard className="p-6">
<h2 className="text-xl font-bold">Policy Versions</h2>
<div className="mt-4 space-y-3">{data.policies.map((policy) => <article key={policy.id} className="rounded-xl border border-slate-200 p-4">
<div className="flex justify-between gap-3">
<div>
<p className="font-bold">{policy.name}</p>
<p className="mt-1 text-xs text-slate-500">Version {policy.version} · Effective {policy.effective_start_date}</p>
</div>
<span className={`h-fit rounded-full px-2 py-1 text-[10px] font-bold ${policy.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{policy.is_active ? "ACTIVE" : "INACTIVE"}</span>
</div>
</article>)}</div>
</KairoCard>
<KairoCard className="p-6">
<h2 className="text-xl font-bold">Policy Rules</h2>
<p className="mt-1 text-sm text-slate-500">Authoritative values used by the database policy engine.</p>
<div className="mt-5 grid gap-3 md:grid-cols-2">{data.policyRules.map((rule) => <article key={rule.id} className="rounded-xl bg-slate-50 p-4">
<p className="text-xs font-bold uppercase tracking-wide text-slate-400">{rule.rule_key.replaceAll("_", " ")}</p>
<p className="mt-2 text-xl font-bold text-[#153E90]">{String(rule.rule_value)}</p>
<p className="mt-1 text-xs text-slate-500">{rule.description}</p>
</article>)}</div>
</KairoCard>
</div>;
}

function HolidayAdminLegacy({ data, holidays, onChanged }: { data: TimeOffAdminData; holidays: Holiday[]; onChanged: () => void }) {
  const calendar = data.calendars.find((item) => item.id === holidays[0]?.holiday_calendars?.id) || data.calendars[0];
  const [date, setDate] = useState(""); const [name, setName] = useState(""); const [part, setPart] = useState<"full_day" | "first_half" | "second_half">("full_day"); const [message, setMessage] = useState("");
  async function add(event: React.FormEvent) { event.preventDefault(); if (!calendar) return; try { await saveHoliday({ holiday_calendar_id: calendar.id, holiday_date: date, name, day_part: part, is_recurring_annual: false }); setDate(""); setName(""); setMessage("Holiday added."); onChanged(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to add holiday."); } }
  function exportCalendar() { const csv = ["Date,Holiday,Duration,Calendar", ...holidays.map((holiday) => [holiday.holiday_date, `"${holiday.name.replaceAll('"', '""')}"`, holiday.day_part, `"${holiday.holiday_calendars?.name || ""}"`].join(","))].join("\n"); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = `holiday-calendar-${calendar?.calendar_year || "export"}.csv`; link.click(); URL.revokeObjectURL(link.href); }
  return <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
<KairoCard className="overflow-hidden">
<div className="flex items-center justify-between border-b px-6 py-5">
<div>
<h2 className="text-xl font-bold">{calendar?.name || "Holiday Calendar"}</h2>
<p className="mt-1 text-sm text-slate-500">{calendar?.audience} employees · {holidays.length} holidays</p>
</div>
<KairoButton type="button" variant="secondary" onClick={exportCalendar}>Export CSV</KairoButton>
</div>
<div className="divide-y">{holidays.map((holiday) => <article key={holiday.id} className="flex items-center gap-4 px-6 py-4">
<div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-blue-50 text-[#153E90]">
<span className="text-[9px] font-bold uppercase">{new Date(`${holiday.holiday_date}T00:00:00Z`).toLocaleString("en", { month: "short", timeZone: "UTC" })}</span>
<span className="text-lg font-bold">{holiday.holiday_date.slice(-2)}</span>
</div>
<div className="flex-1">
<p className="font-bold">{holiday.name}</p>
<p className="mt-1 text-xs capitalize text-slate-500">{holiday.day_part.replaceAll("_", " ")}</p>
</div>
</article>)}</div>
</KairoCard>
<KairoCard className="p-6">
<h2 className="text-lg font-bold">Add holiday</h2>
<form onSubmit={add} className="mt-5 space-y-4">
<KairoInput id="holiday-date" type="date" label="Holiday date" required value={date} onChange={(e) => setDate(e.target.value)} />
<KairoInput id="holiday-name" label="Holiday name" required value={name} onChange={(e) => setName(e.target.value)} />
<KairoSelect id="holiday-part" label="Duration" value={part} onChange={(e) => setPart(e.target.value as typeof part)}>
<option value="full_day">Full Day</option>
<option value="first_half">First Half</option>
<option value="second_half">Second Half</option>
</KairoSelect>{message ? <p className="text-sm font-semibold text-slate-600">{message}</p> : null}<KairoButton type="submit" disabled={!calendar}>Add Holiday</KairoButton>
</form>
</KairoCard>
</div>;
}

function AdjustmentAdminLegacy({ data, leaveTypes, onChanged }: { data: TimeOffAdminData; leaveTypes: LeaveType[]; onChanged: () => void }) {
  const [employeeId, setEmployeeId] = useState(""); const [typeId, setTypeId] = useState(""); const [amount, setAmount] = useState(""); const [reason, setReason] = useState(""); const [reference, setReference] = useState(""); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false); const year = Number(businessDateKey().slice(0, 4));
  async function save(event: React.FormEvent) { event.preventDefault(); setSaving(true); setMessage(""); try { await adjustLeaveBalance({ employeeId, leaveTypeId: typeId, leaveYear: year, adjustmentDays: Number(amount), effectiveDate: businessDateKey(), reason, reference }); setAmount(""); setReason(""); setReference(""); setMessage("Balance adjustment recorded with an audit trail."); onChanged(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to adjust balance."); } finally { setSaving(false); } }
  return <KairoCard className="mx-auto max-w-4xl p-6 sm:p-8">
<p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#153E90]">Audited operation</p>
<h2 className="mt-2 text-2xl font-bold">Manual Balance Adjustment</h2>
<p className="mt-2 text-sm text-slate-500">Every credit or debit records the acting user, previous balance, new balance, reason, and timestamp.</p>
<form onSubmit={save} className="mt-7 grid gap-5 sm:grid-cols-2">
<KairoSelect id="adjust-employee" label="Employee" required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
<option value="">Select employee</option>{sortedEmployees(data.employees.filter((employee) => employee.status === "active")).map((employee) => <option key={employee.id} value={employee.id}>{employeeOptionLabel(employee.employee_code, employeeName(employee))}</option>)}</KairoSelect>
<KairoSelect id="adjust-type" label="Leave type" required value={typeId} onChange={(e) => setTypeId(e.target.value)}>
<option value="">Select leave type</option>{leaveTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</KairoSelect>
<KairoInput id="adjust-amount" type="number" step="0.5" label="Adjustment days (+ credit / − debit)" required value={amount} onChange={(e) => setAmount(e.target.value)} />
<KairoInput id="adjust-reference" label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
<div className="sm:col-span-2">
<KairoTextarea id="adjust-reason" label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
</div>{message ? <p className="text-sm font-semibold text-slate-600 sm:col-span-2">{message}</p> : null}<div className="sm:col-span-2">
<KairoButton type="submit" disabled={saving}>{saving ? "Recording…" : "Confirm Adjustment"}</KairoButton>
</div>
</form>
</KairoCard>;
}

function YearEndAdminLegacy({ data, onChanged }: { data: TimeOffAdminData; onChanged: () => void }) {
  const currentYear = Number(businessDateKey().slice(0, 4)); const [year, setYear] = useState(currentYear - 1); const [employeeId, setEmployeeId] = useState(""); const [message, setMessage] = useState(""); const [processing, setProcessing] = useState(false); const selected = data.employees.find((employee) => employee.id === employeeId);
  async function close() { if (!employeeId || !window.confirm(`Close ${year} for ${selected?.name}? This creates an immutable year closure and encashment record.`)) return; setProcessing(true); setMessage(""); try { const result = await closeEmployeeLeaveYear(employeeId, year) as { encashable_leave_days?: number }; setMessage(`Year closed. Encashable leave: ${result.encashable_leave_days ?? 0} days.`); onChanged(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to close year."); } finally { setProcessing(false); } }
  return <KairoCard className="mx-auto max-w-4xl p-6 sm:p-8">
<p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#153E90]">Review-first workflow</p>
<h2 className="mt-2 text-2xl font-bold">Year-End Processing</h2>
<p className="mt-2 text-sm text-slate-500">Encashable leave = max(remaining eligible paid leave − actual LOP leave days, 0). The 1.5 payroll multiplier is stored separately.</p>
<div className="mt-7 grid gap-5 sm:grid-cols-2">
<KairoInput id="close-year" type="number" min="2000" max={currentYear - 1} label="Closed leave year" value={year} onChange={(e) => setYear(Number(e.target.value))} />
<KairoSelect id="close-employee" label="Employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
<option value="">Select employee</option>{sortedEmployees(data.employees.filter((employee) => employee.status === "active")).map((employee) => <option key={employee.id} value={employee.id}>{employeeOptionLabel(employee.employee_code, employeeName(employee))}</option>)}</KairoSelect>
</div>
<div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
<p className="font-bold">Before closing</p>
<ul className="mt-2 list-disc space-y-1 pl-5">
<li>Resolve pending requests and cancellation requests.</li>
<li>Review manual adjustments and actual LOP days.</li>
<li>Closure is idempotent and cannot be repeated for the same employee/year.</li>
</ul>
</div>{message ? <p className="mt-5 rounded-xl bg-slate-100 p-4 text-sm font-semibold">{message}</p> : null}<div className="mt-6">
<KairoButton type="button" disabled={!employeeId || processing} onClick={close}>{processing ? "Closing…" : "Confirm Year Closure"}</KairoButton>
</div>
</KairoCard>;
}

function AuditLog({ data }: { data: TimeOffAdminData }) {
  const [query, setQuery] = useState(""); const rows = useMemo(() => data.audit.filter((item) => !query || `${item.action} ${item.entity_type} ${item.actor_role} ${item.reason}`.toLowerCase().includes(query.toLowerCase())), [data.audit, query]);
  function exportCsv() { const csv = ["Timestamp,Actor Role,Action,Entity,Employee,Reason", ...rows.map((item) => [item.created_at, item.actor_role, item.action, item.entity_type, item.employee_id, `"${String(item.reason || "").replaceAll('"', '""')}"`].join(","))].join("\n"); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = "time-off-audit-log.csv"; link.click(); URL.revokeObjectURL(link.href); }
  return <KairoCard className="overflow-hidden">
<div className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-5">
<div>
<h2 className="text-xl font-bold">Immutable Audit Log</h2>
<p className="mt-1 text-sm text-slate-500">Administrative and request activity across Time Off.</p>
</div>
<div className="flex gap-3">
<input aria-label="Search audit log" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search audit" className="rounded-xl border px-4" />
<KairoButton type="button" variant="secondary" onClick={exportCsv}>Export CSV</KairoButton>
</div>
</div>
<div className="overflow-x-auto">
<table className="min-w-full text-left text-sm">
<thead className="bg-[#0F172A] text-xs uppercase tracking-wide text-slate-300">
<tr>
<th className="px-5 py-4">Timestamp</th>
<th className="px-5 py-4">Actor</th>
<th className="px-5 py-4">Action</th>
<th className="px-5 py-4">Entity</th>
<th className="px-5 py-4">Reason</th>
</tr>
</thead>
<tbody className="divide-y">{rows.map((item) => <tr key={item.id}>
<td className="whitespace-nowrap px-5 py-4">{new Date(item.created_at).toLocaleString("en-IN")}</td>
<td className="px-5 py-4 font-bold capitalize">{item.actor_role || "System"}</td>
<td className="px-5 py-4 font-bold text-[#153E90] capitalize">{item.action.replaceAll("_", " ")}</td>
<td className="px-5 py-4 capitalize">{item.entity_type.replaceAll("_", " ")}</td>
<td className="max-w-sm truncate px-5 py-4 text-slate-500">{item.reason || "—"}</td>
</tr>)}</tbody>
</table>
</div>
</KairoCard>;
}

function PolicyAdmin({ data, onChanged }: { data: TimeOffAdminData; onChanged: () => void }) {
  const first = data.policies[0];
  const [name, setName] = useState(first?.name || "");
  const [version, setVersion] = useState(first?.version || 1);
  const [start, setStart] = useState(first?.effective_start_date || businessDateKey());
  const [end, setEnd] = useState(first?.effective_end_date || "");
  const [active, setActive] = useState(first?.is_active ?? true);
  const [message, setMessage] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      await saveLeavePolicy({ id: first?.id, name, version, effective_start_date: start, effective_end_date: end || null, is_active: active });
      setMessage("Policy version saved with an audit record.");
      onChanged();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to save policy."); }
  }
  return <div className="space-y-6">
<PolicyAdminLegacy data={data} />
<KairoCard className="p-6">
<h2 className="text-xl font-bold">Edit Active Policy Version</h2>
<form onSubmit={save} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
<KairoInput id="policy-name" label="Policy name" required value={name} onChange={(event) => setName(event.target.value)} />
<KairoInput id="policy-version" type="number" min="1" label="Version" required value={version} onChange={(event) => setVersion(Number(event.target.value))} />
<KairoInput id="policy-start" type="date" label="Effective start" required value={start} onChange={(event) => setStart(event.target.value)} />
<KairoInput id="policy-end" type="date" label="Effective end" value={end} onChange={(event) => setEnd(event.target.value)} />
<label className="flex items-center gap-3 self-end rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold">
<input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />Active policy</label>
<div className="md:col-span-2 xl:col-span-5">
<KairoButton type="submit">Save Policy</KairoButton>{message ? <span className="ml-4 text-sm font-semibold text-slate-600">{message}</span> : null}</div>
</form>
</KairoCard>
<KairoCard className="p-6">
<h2 className="text-xl font-bold">Editable Policy Rules</h2>
<p className="mt-1 text-sm text-slate-500">Historical requests retain the approved policy snapshot.</p>
<div className="mt-5 grid gap-4 lg:grid-cols-2">{data.policyRules.map((rule) => <PolicyRuleEditor key={rule.id} rule={rule} onChanged={onChanged} />)}</div>
</KairoCard>
</div>;
}

function PolicyRuleEditor({ rule, onChanged }: { rule: TimeOffAdminData["policyRules"][number]; onChanged: () => void }) {
  const [value, setValue] = useState(typeof rule.rule_value === "object" ? JSON.stringify(rule.rule_value) : String(rule.rule_value));
  const [description, setDescription] = useState(rule.description || "");
  const [message, setMessage] = useState("");
  async function save() {
    let parsed: typeof rule.rule_value = value;
    if (value === "true" || value === "false") parsed = value === "true";
    else if (value.trim() && Number.isFinite(Number(value))) parsed = Number(value);
    else if (value.trim().startsWith("{") || value.trim().startsWith("[")) {
      try { parsed = JSON.parse(value) as typeof rule.rule_value; } catch { setMessage("Enter valid JSON."); return; }
    }
    try { await savePolicyRule(rule.id, parsed, description || null); setMessage("Saved"); onChanged(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to save"); }
  }
  return <div className="rounded-2xl border border-slate-200 p-4">
<p className="text-xs font-bold uppercase tracking-wide text-[#153E90]">{rule.rule_key.replaceAll("_", " ")}</p>
<input aria-label={`${rule.rule_key} value`} value={value} onChange={(event) => setValue(event.target.value)} className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2" />
<textarea aria-label={`${rule.rule_key} description`} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 min-h-16 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
<div className="mt-2 flex items-center gap-3">
<KairoButton type="button" variant="secondary" onClick={save}>Save Rule</KairoButton>{message ? <span className="text-xs font-semibold text-slate-500">{message}</span> : null}</div>
</div>;
}

function ExtendedExceptionsAdmin({ data }: { data: TimeOffAdminData }) {
  const rows = [...data.exceptions].sort((left, right) => {
    const leftEmployee = left.employees as { name?: string; employee_code?: string } | null;
    const rightEmployee = right.employees as { name?: string; employee_code?: string } | null;
    return compareEmployeeCodes(leftEmployee?.employee_code, rightEmployee?.employee_code, leftEmployee?.name, rightEmployee?.name);
  });
  return <KairoCard className="overflow-hidden">
<div className="border-b px-6 py-5">
<h2 className="text-xl font-bold">Extended Planned-Leave Exceptions</h2>
<p className="mt-1 text-sm text-slate-500">One annual exception per eligible employee, including its availability reason.</p>
</div>
<div className="overflow-x-auto">
<table className="min-w-full text-left text-sm">
<thead className="bg-[#0F172A] text-xs uppercase text-slate-300">
<tr>
<th className="px-5 py-4">Employee Code</th>
<th className="px-5 py-4">Employee Name</th>
<th className="px-5 py-4">Year</th>
<th className="px-5 py-4">Status</th>
<th className="px-5 py-4">Reason</th>
</tr>
</thead>
<tbody className="divide-y">{rows.map((item) => { const employee = item.employees as { name?: string; employee_code?: string } | null; return <tr key={String(item.id)}>
<td className="px-5 py-4 font-bold text-[#153E90]">{employee?.employee_code || "—"}</td>
<td className="px-5 py-4 font-bold">{employee?.name || "Unknown"}</td>
<td className="px-5 py-4">{String(item.leave_year)}</td>
<td className="px-5 py-4 font-bold capitalize">{String(item.status).replaceAll("_", " ")}</td>
<td className="px-5 py-4 text-slate-500">{String(item.unavailable_reason || "—")}</td>
</tr>; })}</tbody>
</table>
</div>
</KairoCard>;
}

function TimeOffReports({ data, holidays }: { data: TimeOffAdminData; holidays: Holiday[] }) {
  const year = Number(businessDateKey().slice(0, 4));
  const [kind, setKind] = useState("leave_usage_by_type");
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(`${year}-12-31`);
  const [message, setMessage] = useState("");
  const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  function download(name: string, rows: unknown[][]) {
    const csv = rows.map((row) => row.map(quote).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); link.download = name; link.click(); URL.revokeObjectURL(link.href);
  }
  async function exportReport() {
    setMessage("Preparing report…");
    try {
      if (kind === "balances") download("leave-balances.csv", [["Employee Code", "Employee Name", "Department", "Year", "Leave Type", "Entitled", "Used", "Pending", "Adjusted", "Available"], ...data.balances.map((row) => [row.employees?.employee_code, row.employees?.name, row.employees?.department, row.leave_year, row.leave_types?.name, row.entitled_days, row.used_days, row.pending_days, row.adjustment_days, row.available_days])]);
      else if (kind === "adjustments") download("leave-adjustments.csv", [["Timestamp", "Employee Code", "Employee Name", "Leave Type", "Year", "Days", "Previous", "New", "Reason", "Reference"], ...data.adjustments.map((row) => [row.created_at, row.employees?.employee_code, row.employees?.name, row.leave_types?.name, row.leave_year, row.adjustment_days, row.previous_balance, row.new_balance, row.reason, row.reference])]);
      else if (kind === "holidays") download("holiday-calendar.csv", [["Date", "Holiday", "Duration", "Audience"], ...holidays.map((holiday) => [holiday.holiday_date, holiday.name, holiday.day_part, holiday.holiday_calendars?.audience])]);
      else if (kind === "encashment") download("year-end-encashment.csv", [["Employee Code", "Employee Name", "Year", "Encashable Days", "Status", "Payroll Reference"], ...data.encashments.map((item) => { const employee = item.employees as { name?: string; employee_code?: string } | null; return [employee?.employee_code, employee?.name, item.leave_year, item.encashable_leave_days, item.status, item.payroll_reference]; })]);
      else {
        const usage = await loadTimeOffUsageRows(from, to);
        const approved = usage.filter((row) => ["approved", "cancellation_requested"].includes(row.status) && ["approved", "cancellation_rejected", "cancellation_requested"].includes(row.leave_requests?.status || ""));
        const selectedRows = kind === "pending_approvals"
          ? usage.filter((row) => row.leave_requests?.status === "pending")
          : approved.filter((row) => kind !== "unplanned" || row.leave_requests?.leave_types?.code === "UL").filter((row) => kind !== "upcoming" || row.leave_date >= businessDateKey());
        const group = new Map<string, number>();
        for (const row of selectedRows) {
          const request = row.leave_requests;
          const key = kind === "monthly_usage" ? row.leave_date.slice(0, 7)
            : kind === "department_trends" ? request?.employees?.department || "Unassigned"
            : kind === "manager_team" ? request?.employees?.reporting_manager_id || "No manager"
            : kind === "pending_approvals" ? `${request?.employees?.name}|${request?.leave_types?.name}|${request?.id}`
            : kind === "upcoming" ? `${request?.employees?.name}|${row.leave_date}|${request?.leave_types?.name}`
            : kind === "lop" ? (request?.leave_types?.code === "LOP" ? request.employees?.name || "Unknown" : "")
            : request?.leave_types?.name || "Unknown";
          if (key) group.set(key, (group.get(key) || 0) + Number(row.duration || 0));
        }
        const lopMultiplier = Number(data.policyRules.find((rule) => rule.rule_key === "lop_salary_multiplier")?.rule_value || 1.5);
        download(`${kind}.csv`, kind === "lop" ? [["Employee", "LOP Days", "Payroll Deduction Equivalent"], ...[...group.entries()].map(([key, days]) => [key, days, days * lopMultiplier])] : [["Group", "Leave Days"], ...[...group.entries()]]);
      }
      setMessage("Report downloaded. Access permissions were applied to the exported data.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to export report."); }
  }
  return <KairoCard className="p-6 sm:p-8">
<p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#153E90]">Authorised exports</p>
<h2 className="mt-2 text-2xl font-bold">Time Off Reports</h2>
<div className="mt-6 grid gap-4 md:grid-cols-4">
<KairoSelect id="report-kind" label="Report" value={kind} onChange={(event) => setKind(event.target.value)}>
<option value="leave_usage_by_type">Leave usage by type</option>
<option value="monthly_usage">Monthly leave usage</option>
<option value="unplanned">Unplanned Leave usage</option>
<option value="lop">LOP usage & payroll equivalent</option>
<option value="upcoming">Upcoming leave</option>
<option value="pending_approvals">Pending approvals</option>
<option value="department_trends">Department trends</option>
<option value="manager_team">Manager team report</option>
<option value="balances">Balance by employee</option>
<option value="adjustments">Adjustment history</option>
<option value="encashment">Year-end encashment</option>
<option value="holidays">Holiday calendar</option>
</KairoSelect>
<KairoInput id="report-from" type="date" label="From" value={from} onChange={(event) => setFrom(event.target.value)} />
<KairoInput id="report-to" type="date" label="To" value={to} onChange={(event) => setTo(event.target.value)} />
<div className="self-end">
<KairoButton type="button" onClick={exportReport}>Download CSV</KairoButton>
</div>
</div>{message ? <p className="mt-4 text-sm font-semibold text-slate-600">{message}</p> : null}</KairoCard>;
}

function YearEndAdmin({ data, onChanged }: { data: TimeOffAdminData; onChanged: () => void }) {
  const currentYear = Number(businessDateKey().slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const [employeeId, setEmployeeId] = useState("");
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState("");
  const activeEmployees = useMemo(() => sortedEmployees(data.employees.filter((employee) => employee.status === "active")), [data.employees]);
  const reviewYears = Array.from({ length: 6 }, (_, index) => currentYear - index);
  async function review() {
    if (!employeeId) return;
    try { setPreview(await loadYearEndPreview(employeeId, year)); setMessage(""); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to review year."); }
  }
  async function process(item: Record<string, unknown>) {
    const reference = window.prompt("Enter the payroll reference for this encashment:");
    if (!reference) return;
    try { await processLeaveEncashment(String(item.id), reference); setMessage("Encashment marked as processed."); onChanged(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to process encashment."); }
  }
  async function reverse(item: Record<string, unknown>) {
    const reason = window.prompt("Enter the mandatory reversal reason:");
    if (!reason) return;
    try { await reverseLeaveYearClosure(String(item.id), reason); setMessage("Year closure reversed with an audit trail."); onChanged(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to reverse closure."); }
  }
  return <div className="space-y-6">
<KairoCard className="p-6">
<h2 className="text-xl font-bold">Year-End Review</h2>
<p className="mt-1 text-sm text-slate-500">Review entitlement, usage, LOP, and encashment before closing.</p>
<div className="mt-5 grid gap-4 sm:grid-cols-3">
<KairoSelect id="review-employee" label="Employee" value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); setPreview(null); }}>
<option value="">Select active employee</option>{activeEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employeeOptionLabel(employee.employee_code, employeeName(employee))}</option>)}</KairoSelect>
<KairoSelect id="review-year" label="Leave year" value={year} onChange={(event) => { setYear(Number(event.target.value)); setPreview(null); }}>{reviewYears.map((reviewYear) => <option key={reviewYear} value={reviewYear}>{reviewYear}</option>)}</KairoSelect>
<div className="self-end">
<KairoButton type="button" onClick={review} disabled={!employeeId}>Review Calculation</KairoButton>
</div>
</div>{preview ? <dl className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[["Entitlement", "entitlement_days"], ["Used paid", "used_paid_days"], ["Pending", "pending_paid_days"], ["Remaining", "remaining_paid_leave_days"], ["LOP days", "lop_used_days"], ["LOP salary equivalent", "lop_salary_deduction_days"], ["Encashable", "encashable_estimate_days"], ["Carry forward", "carry_forward_days"], ["Expired", "expired_days"], ["Status", "processing_status"]].map(([label, key]) => <div key={key} className="rounded-xl bg-slate-50 p-4">
<dt className="text-[10px] font-bold uppercase text-slate-400">{label}</dt>
<dd className="mt-2 text-lg font-bold text-[#153E90]">{String(preview[key] ?? 0)}</dd>
</div>)}</dl> : null}</KairoCard>
<YearEndAdminLegacy data={data} onChanged={onChanged} />
<KairoCard className="overflow-hidden">
<div className="border-b px-6 py-5">
<h2 className="text-xl font-bold">Encashment Processing</h2>
</div>
<div className="overflow-x-auto">
<table className="min-w-full text-left text-sm">
<thead className="bg-[#0F172A] text-xs uppercase text-slate-300">
<tr>
<th className="px-5 py-4">Employee Code</th>
<th className="px-5 py-4">Employee Name</th>
<th className="px-5 py-4">Year</th>
<th className="px-5 py-4">Days</th>
<th className="px-5 py-4">Status</th>
<th className="px-5 py-4">Action</th>
</tr>
</thead>
<tbody className="divide-y">{[...data.encashments].sort((left, right) => { const a = left.employees as { name?: string; employee_code?: string } | null; const b = right.employees as { name?: string; employee_code?: string } | null; return compareEmployeeCodes(a?.employee_code, b?.employee_code, a?.name, b?.name); }).map((item) => { const employee = item.employees as { name?: string; employee_code?: string } | null; return <tr key={String(item.id)}>
<td className="px-5 py-4 font-bold text-[#153E90]">{employee?.employee_code || "—"}</td>
<td className="px-5 py-4 font-bold">{employee?.name}</td>
<td className="px-5 py-4">{String(item.leave_year)}</td>
<td className="px-5 py-4">{String(item.encashable_leave_days)}</td>
<td className="px-5 py-4 font-bold capitalize">{String(item.status)}</td>
<td className="px-5 py-4">{item.status === "pending" ? <KairoButton type="button" variant="secondary" onClick={() => process(item)}>Process</KairoButton> : null}</td>
</tr>; })}</tbody>
</table>
</div>
</KairoCard>
<KairoCard className="overflow-hidden">
<div className="border-b px-6 py-5">
<h2 className="text-xl font-bold">Closure History</h2>
</div>
<div className="divide-y">{[...data.closures].sort((left, right) => { const a = left.employees as { name?: string; employee_code?: string } | null; const b = right.employees as { name?: string; employee_code?: string } | null; return compareEmployeeCodes(a?.employee_code, b?.employee_code, a?.name, b?.name); }).map((item) => { const employee = item.employees as { name?: string; employee_code?: string } | null; return <div key={String(item.id)} className="flex flex-wrap items-center gap-4 px-6 py-4">
<div className="flex-1">
<p className="font-bold">{employeeOptionLabel(employee?.employee_code, employee?.name || "Unknown")} · {String(item.leave_year)}</p>
<p className="mt-1 text-xs text-slate-500">{String(item.status)} · Encashable {String(item.encashable_leave_days)} days</p>
</div>{item.status === "closed" ? <KairoButton type="button" variant="danger" onClick={() => reverse(item)}>Reverse Closure</KairoButton> : null}</div>; })}</div>
</KairoCard>{message ? <p className="rounded-xl bg-slate-100 p-4 text-sm font-semibold">{message}</p> : null}</div>;
}

function HolidayAdmin({ data, holidays, onChanged }: { data: TimeOffAdminData; holidays: Holiday[]; onChanged: () => void }) {
  const calendar = data.calendars.find((item) => item.id === holidays[0]?.holiday_calendars?.id) || data.calendars[0];
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [part, setPart] = useState<"full_day" | "first_half" | "second_half">("full_day");
  const [targetYear, setTargetYear] = useState((calendar?.calendar_year || Number(businessDateKey().slice(0, 4))) + 1);
  const [message, setMessage] = useState("");
  function select(holiday: Holiday) { setEditing(holiday); setName(holiday.name); setDate(holiday.holiday_date); setPart(holiday.day_part); }
  async function saveEdit(event: React.FormEvent) {
    event.preventDefault(); if (!editing || !calendar) return;
    try { await saveHoliday({ id: editing.id, holiday_calendar_id: calendar.id, holiday_date: date, name, day_part: part, is_recurring_annual: editing.is_recurring_annual, is_active: editing.is_active }); setEditing(null); setMessage("Holiday updated."); onChanged(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to update holiday."); }
  }
  async function deactivate(holiday: Holiday) {
    try { await saveHoliday({ id: holiday.id, holiday_calendar_id: holiday.holiday_calendars?.id || calendar?.id || "", holiday_date: holiday.holiday_date, name: holiday.name, day_part: holiday.day_part, is_recurring_annual: holiday.is_recurring_annual, is_active: false }); setMessage("Holiday marked inactive."); onChanged(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to deactivate holiday."); }
  }
  async function remove(holiday: Holiday) {
    if (!window.confirm(`Remove ${holiday.name}? Only future holidays can be removed.`)) return;
    try { await deleteFutureHoliday(holiday.id); setMessage("Future holiday removed."); onChanged(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to remove holiday."); }
  }
  async function importCsv(file: File) {
    if (!calendar) return;
    try {
      const lines = (await file.text()).split(/\r?\n/).filter(Boolean);
      const start = lines[0]?.toLowerCase().includes("date") ? 1 : 0;
      for (const line of lines.slice(start)) {
        const [holidayDate, holidayName, duration = "full_day"] = line.split(",").map((value) => value.trim().replace(/^"|"$/g, ""));
        if (holidayDate && holidayName) await saveHoliday({ holiday_calendar_id: calendar.id, holiday_date: holidayDate, name: holidayName, day_part: ["first_half", "second_half"].includes(duration) ? duration as typeof part : "full_day", is_recurring_annual: false });
      }
      setMessage("Holiday calendar imported."); onChanged();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to import calendar."); }
  }
  async function duplicate() {
    if (!calendar) return;
    try { await duplicateHolidayCalendar(calendar.id, targetYear, `Despacho Holiday Calendar ${targetYear}`); setMessage(`Calendar duplicated to ${targetYear}.`); onChanged(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to duplicate calendar."); }
  }
  return <div className="space-y-6">
<HolidayCalendarEditor data={data} onChanged={onChanged} />
<HolidayAdminLegacy data={data} holidays={holidays} onChanged={onChanged} />
<KairoCard className="p-6">
<h2 className="text-xl font-bold">Calendar Maintenance</h2>
<div className="mt-5 flex flex-wrap items-end gap-4">
<label className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-bold text-[#153E90]">Import CSV<input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importCsv(file); }} />
</label>
<KairoInput id="duplicate-year" type="number" min="2000" max="2200" label="Duplicate to year" value={targetYear} onChange={(event) => setTargetYear(Number(event.target.value))} />
<KairoButton type="button" variant="secondary" onClick={duplicate} disabled={!calendar}>Duplicate Calendar</KairoButton>
</div>
<div className="mt-6 divide-y rounded-2xl border border-slate-200">{holidays.map((holiday) => <div key={holiday.id} className="flex flex-wrap items-center gap-3 p-4">
<div className="flex-1">
<p className="font-bold">{holiday.name}</p>
<p className="text-xs text-slate-500">{holiday.holiday_date} · {holiday.day_part.replaceAll("_", " ")}</p>
</div>
<KairoButton type="button" variant="secondary" onClick={() => select(holiday)}>Edit</KairoButton>
<KairoButton type="button" variant="secondary" onClick={() => deactivate(holiday)}>Deactivate</KairoButton>
<KairoButton type="button" variant="danger" onClick={() => remove(holiday)}>Remove</KairoButton>
</div>)}</div>{editing ? <form onSubmit={saveEdit} className="mt-6 grid gap-4 md:grid-cols-4">
<KairoInput id="edit-holiday-date" type="date" label="Date" required value={date} onChange={(event) => setDate(event.target.value)} />
<KairoInput id="edit-holiday-name" label="Holiday" required value={name} onChange={(event) => setName(event.target.value)} />
<KairoSelect id="edit-holiday-part" label="Duration" value={part} onChange={(event) => setPart(event.target.value as typeof part)}>
<option value="full_day">Full Day</option>
<option value="first_half">First Half</option>
<option value="second_half">Second Half</option>
</KairoSelect>
<div className="flex items-end gap-2">
<KairoButton type="submit">Save</KairoButton>
<KairoButton type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</KairoButton>
</div>
</form> : null}{message ? <p className="mt-4 text-sm font-semibold text-slate-600">{message}</p> : null}</KairoCard>
</div>;
}

function HolidayCalendarEditor({ data, onChanged }: { data: TimeOffAdminData; onChanged: () => void }) {
  const current = data.calendars[0];
  const [name, setName] = useState(current?.name || "");
  const [year, setYear] = useState(current?.calendar_year || Number(businessDateKey().slice(0, 4)));
  const [audience, setAudience] = useState(current?.audience || "ALL");
  const [country, setCountry] = useState(current?.country || "");
  const [location, setLocation] = useState(current?.location || "");
  const [department, setDepartment] = useState(current?.department || "");
  const [notes, setNotes] = useState(current?.notes || "");
  const [active, setActive] = useState(current?.is_active ?? true);
  const [message, setMessage] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      await saveHolidayCalendar({ id: current?.id, name, calendar_year: year, audience, country: country || null, location: location || null, department: department || null, notes: notes || null, is_active: active });
      setMessage("Holiday calendar saved with an audit record.");
      onChanged();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to save holiday calendar."); }
  }

  return <KairoCard className="p-6"><h2 className="text-xl font-bold">Calendar Configuration</h2><p className="mt-1 text-sm text-slate-500">Assign the calendar to the organisation, a department, country, or location.</p><form onSubmit={save} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><KairoInput id="calendar-name" label="Calendar name" required value={name} onChange={(event) => setName(event.target.value)} /><KairoInput id="calendar-year" type="number" min="2000" max="2200" label="Calendar year" required value={year} onChange={(event) => setYear(Number(event.target.value))} /><KairoSelect id="calendar-audience" label="Audience" value={audience} onChange={(event) => setAudience(event.target.value)}><option value="ALL">All employees</option><option value="DEPARTMENT">Department</option><option value="COUNTRY">Country</option><option value="LOCATION">Location</option></KairoSelect><KairoSelect id="calendar-department" label="Department" value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">Any department</option><option>Operations</option><option>Admin</option><option>HR</option><option>Finance</option><option>Management</option></KairoSelect><KairoInput id="calendar-country" label="Country" value={country} onChange={(event) => setCountry(event.target.value)} /><KairoInput id="calendar-location" label="Location / team" value={location} onChange={(event) => setLocation(event.target.value)} /><KairoInput id="calendar-notes" label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} /><label className="flex items-center gap-3 self-end rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />Active calendar</label><div className="md:col-span-2 xl:col-span-4"><KairoButton type="submit">Save Calendar</KairoButton>{message ? <span className="ml-4 text-sm font-semibold text-slate-600">{message}</span> : null}</div></form></KairoCard>;
}

function AdjustmentAdmin({ data, leaveTypes, onChanged }: { data: TimeOffAdminData; leaveTypes: LeaveType[]; onChanged: () => void }) {
  const currentYear = Number(businessDateKey().slice(0, 4));
  const [employeeId, setEmployeeId] = useState("");
  const [leaveTypeCode, setLeaveTypeCode] = useState("");
  const [leaveYear, setLeaveYear] = useState(currentYear);
  const [appliedEmployeeId, setAppliedEmployeeId] = useState("");
  const [appliedLeaveTypeCode, setAppliedLeaveTypeCode] = useState("");
  const [appliedLeaveYear, setAppliedLeaveYear] = useState(currentYear);
  const [searched, setSearched] = useState(false);
  const activeEmployees = useMemo(() => sortedEmployees(data.employees.filter((employee) => employee.status === "active")), [data.employees]);
  const years = useMemo(() => Array.from(new Set([currentYear, ...data.balances.map((row) => row.leave_year)])).sort((a, b) => b - a), [currentYear, data.balances]);
  const filteredBalances = useMemo(() => searched ? data.balances.filter((row) => {
    if (appliedEmployeeId && row.employee_id !== appliedEmployeeId) return false;
    if (appliedLeaveTypeCode && row.leave_types?.code !== appliedLeaveTypeCode) return false;
    return row.leave_year === appliedLeaveYear;
  }).sort((left, right) => compareEmployeeCodes(left.employees?.employee_code, right.employees?.employee_code, left.employees?.name, right.employees?.name)) : [], [appliedEmployeeId, appliedLeaveTypeCode, appliedLeaveYear, data.balances, searched]);
  function search() { setAppliedEmployeeId(employeeId); setAppliedLeaveTypeCode(leaveTypeCode); setAppliedLeaveYear(leaveYear); setSearched(true); }
  function reset() { setEmployeeId(""); setLeaveTypeCode(""); setLeaveYear(currentYear); setAppliedEmployeeId(""); setAppliedLeaveTypeCode(""); setAppliedLeaveYear(currentYear); setSearched(false); }
  return <div className="space-y-6">
<KairoCard className="overflow-hidden">
<div className="border-b px-6 py-5">
<div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold">Employee Leave Balances</h2>
<p className="mt-1 text-sm text-slate-500">Filter active employees, leave types, and leave year before viewing or exporting balances.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#153E90]">{searched ? `${filteredBalances.length} records` : "Awaiting search"}</span></div>
<div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_.65fr_auto_auto]"><KairoSelect id="admin-balance-employee" label="Employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">All active employees</option>{activeEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employeeOptionLabel(employee.employee_code, employeeName(employee))}</option>)}</KairoSelect><KairoSelect id="admin-balance-type" label="Leave type" value={leaveTypeCode} onChange={(event) => setLeaveTypeCode(event.target.value)}><option value="">All leave types</option>{leaveTypes.map((type) => <option key={type.id} value={type.code}>{type.name}</option>)}</KairoSelect><KairoSelect id="admin-balance-year" label="Year" value={leaveYear} onChange={(event) => setLeaveYear(Number(event.target.value))}>{years.map((year) => <option key={year} value={year}>{year}</option>)}</KairoSelect><div className="flex items-end"><KairoButton type="button" onClick={search}>Search</KairoButton></div><div className="flex items-end"><KairoButton type="button" variant="secondary" onClick={reset}>Reset</KairoButton></div></div>
<div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-sm font-semibold text-slate-600">Exports contain only the results applied with Search.</p><TimeOffBalanceExportButtons rows={filteredBalances} year={appliedLeaveYear} /></div>
</div>
<div className="max-h-[520px] overflow-auto">
<table className="min-w-full text-left text-sm">
<thead className="sticky top-0 bg-[#0F172A] text-xs uppercase text-slate-300">
<tr>
<th className="px-5 py-4">Employee Code</th>
<th className="px-5 py-4">Employee Name</th>
<th className="px-5 py-4">Year</th>
<th className="px-5 py-4">Type</th>
<th className="px-5 py-4">Entitled</th>
<th className="px-5 py-4">Used</th>
<th className="px-5 py-4">Pending</th>
<th className="px-5 py-4">Adjusted</th>
<th className="px-5 py-4">Available</th>
</tr>
</thead>
<tbody className="divide-y">{filteredBalances.map((row) => <tr key={row.id}>
<td className="px-5 py-4 font-bold text-[#153E90]">{row.employees?.employee_code || "—"}</td>
<td className="px-5 py-4 font-bold">{row.employees?.name}</td>
<td className="px-5 py-4">{row.leave_year}</td>
<td className="px-5 py-4">{row.leave_types?.name}</td>
<td className="px-5 py-4">{row.entitled_days}</td>
<td className="px-5 py-4">{row.used_days}</td>
<td className="px-5 py-4">{row.pending_days}</td>
<td className="px-5 py-4">{row.adjustment_days}</td>
<td className="px-5 py-4 font-bold text-[#153E90]">{row.available_days}</td>
</tr>)}{!searched ? <tr><td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-400">Choose filters and click Search to view employee leave balances.</td></tr> : !filteredBalances.length ? <tr><td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-400">No leave balances match the selected filters.</td></tr> : null}</tbody>
</table>
</div>
</KairoCard>
<AdjustmentAdminLegacy data={data} leaveTypes={leaveTypes} onChanged={onChanged} />
<KairoCard className="overflow-hidden">
<div className="border-b px-6 py-5">
<h2 className="text-xl font-bold">Adjustment History</h2>
</div>
<div className="overflow-x-auto">
<table className="min-w-full text-left text-sm">
<thead className="bg-[#0F172A] text-xs uppercase text-slate-300">
<tr>
<th className="px-5 py-4">Timestamp</th>
<th className="px-5 py-4">Employee Code</th>
<th className="px-5 py-4">Employee Name</th>
<th className="px-5 py-4">Type</th>
<th className="px-5 py-4">Change</th>
<th className="px-5 py-4">Previous → New</th>
<th className="px-5 py-4">Reason</th>
</tr>
</thead>
<tbody className="divide-y">{[...data.adjustments].sort((left, right) => compareEmployeeCodes(left.employees?.employee_code, right.employees?.employee_code, left.employees?.name, right.employees?.name)).map((row) => <tr key={row.id}>
<td className="whitespace-nowrap px-5 py-4">{new Date(row.created_at).toLocaleString("en-IN")}</td>
<td className="px-5 py-4 font-bold text-[#153E90]">{row.employees?.employee_code || "—"}</td>
<td className="px-5 py-4 font-bold">{row.employees?.name}</td>
<td className="px-5 py-4">{row.leave_types?.name}</td>
<td className="px-5 py-4 font-bold">{row.adjustment_days > 0 ? "+" : ""}{row.adjustment_days}</td>
<td className="px-5 py-4">{row.previous_balance} → {row.new_balance}</td>
<td className="px-5 py-4 text-slate-500">{row.reason}</td>
</tr>)}</tbody>
</table>
</div>
</KairoCard>
</div>;
}
