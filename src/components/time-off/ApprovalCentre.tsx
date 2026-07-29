"use client";

import { useMemo, useState } from "react";
import KairoButton from "@/components/ui/KairoButton";
import KairoCard from "./TimeOffPremiumCard";
import KairoSelect from "@/components/ui/KairoSelect";
import TimeOffStatusBadge from "./TimeOffStatusBadge";
import { addLeaveComment, openLeaveAttachment, processLeave, type CalendarLeave, type LeaveRequest, type TimeOffManagedEmployee } from "@/lib/time-off/client";
import { businessDateKey } from "@/lib/metrics/date-ranges";
import { compareEmployeeCodes, employeeOptionLabel } from "@/lib/time-off/employee-order";
import TimeOffIcon from "./TimeOffIcon";

type ManagerBalance = { id: string; employee_id: string; leave_year: number; entitled_days: number; used_days: number; pending_days: number; available_days: number; employee_name: string; employee_title: string | null; employee_code: string | null; leave_type_name: string; leave_type_code: string };

export default function ApprovalCentre({ requests, managedEmployees, managedRequests, calendar, balances, recent, isAdmin, onChanged }: { requests: LeaveRequest[]; managedEmployees: TimeOffManagedEmployee[]; managedRequests: LeaveRequest[]; calendar: CalendarLeave[]; balances: ManagerBalance[]; recent: LeaveRequest[]; isAdmin: boolean; onChanged: () => void }) {
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [comment, setComment] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [balanceEmployee, setBalanceEmployee] = useState("");
  const [balanceType, setBalanceType] = useState("");
  const [appliedBalanceEmployee, setAppliedBalanceEmployee] = useState("");
  const [appliedBalanceType, setAppliedBalanceType] = useState("");
  const [balanceSearchApplied, setBalanceSearchApplied] = useState(false);
  const [today] = useState(() => businessDateKey());
  const conflicts = selected ? calendar.filter((leave) => leave.id !== selected.id && leave.status !== "rejected" && leave.start_date <= selected.end_date && leave.end_date >= selected.start_date) : [];
  const balanceEmployees = useMemo(() => Array.from(new Map(balances.map((balance) => [balance.employee_id, { id: balance.employee_id, name: balance.employee_name, code: balance.employee_code }])).values()).sort((a, b) => compareEmployeeCodes(a.code, b.code, a.name, b.name)), [balances]);
  const balanceTypes = useMemo(() => Array.from(new Map(balances.map((balance) => [balance.leave_type_code, { code: balance.leave_type_code, name: balance.leave_type_name }])).values()).sort((a, b) => a.name.localeCompare(b.name)), [balances]);
  const filteredBalances = useMemo(() => {
    if (!balanceSearchApplied) return [];
    return balances.filter((balance) => {
      if (appliedBalanceEmployee && balance.employee_id !== appliedBalanceEmployee) return false;
      if (appliedBalanceType && balance.leave_type_code !== appliedBalanceType) return false;
      return true;
    }).sort((left, right) => compareEmployeeCodes(left.employee_code, right.employee_code, left.employee_name, right.employee_name));
  }, [appliedBalanceEmployee, appliedBalanceType, balanceSearchApplied, balances]);

  function searchBalances() {
    setAppliedBalanceEmployee(balanceEmployee);
    setAppliedBalanceType(balanceType);
    setBalanceSearchApplied(true);
  }

  function resetBalanceSearch() {
    setBalanceEmployee("");
    setBalanceType("");
    setAppliedBalanceEmployee("");
    setAppliedBalanceType("");
    setBalanceSearchApplied(false);
  }

  async function decide(action: string) {
    if ((action === "reject" || action === "reject_cancellation") && !comment.trim()) { setError("A rejection comment is required."); return; }
    if (selected?.administrative_override_required && action === "approve" && isAdmin && !overrideReason.trim()) { setError("Enter an administrative override reason."); return; }
    if (!selected) return;
    if (!window.confirm(`Confirm ${action.replaceAll("_", " ")} for this request?`)) return;
    setProcessing(true); setError("");
    try { await processLeave(selected.id, action, comment, overrideReason); setSelected(null); setComment(""); setOverrideReason(""); onChanged(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to process request."); } finally { setProcessing(false); }
  }

  async function addComment() {
    if (!selected || !comment.trim()) { setError("Enter a comment first."); return; }
    setProcessing(true); setError("");
    try { await addLeaveComment(selected.id, selected.employee_id, comment); setComment(""); onChanged(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to add comment."); } finally { setProcessing(false); }
  }

  const upcoming = calendar.filter((leave) => ["approved", "cancellation_rejected"].includes(leave.status) && leave.start_date >= today).slice(0, 8);
  return <div className="grid gap-6 xl:grid-cols-[1fr_.85fr]">
    <KairoCard className="overflow-hidden border-white/80 shadow-[0_20px_55px_-38px_rgba(217,119,6,.55)]">
<div className="border-b border-amber-100 bg-gradient-to-r from-amber-50/90 via-white to-white px-6 py-5">
<div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><TimeOffIcon name="inbox" className="h-5 w-5" /></span><div><h2 className="text-xl font-bold">Requires My Action</h2>
<p className="mt-1 text-sm text-slate-500">Pending direct-report requests and cancellation approvals.</p></div></div>
</div>
<div className="divide-y divide-slate-100">{requests.length ? requests.map((request) => <button key={request.id} type="button" onClick={() => { setSelected(request); setError(""); }} className={`w-full px-6 py-4 text-left transition hover:bg-slate-50 ${selected?.id === request.id ? "bg-blue-50" : ""}`}>
<div className="flex items-start justify-between gap-4">
<div>
<p className="font-bold text-slate-950">{request.employees?.title} {request.employees?.name}</p>
<p className="mt-1 text-xs text-slate-500">{request.employees?.employee_code} · {request.employees?.department || "No department"}</p>
</div>
<TimeOffStatusBadge status={request.status} />
</div>
<div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
<span className="font-bold text-[#153E90]">{request.leave_types?.name}</span>
<span>{request.start_date} – {request.end_date}</span>
<span className="font-bold">{request.working_days} days</span>
</div>{request.administrative_override_required ? <p className="mt-3 text-xs font-bold text-red-600">Administrative override required</p> : null}</button>) : <div className="px-6 py-16 text-center text-sm text-slate-400">No requests currently require your action.</div>}</div>
</KairoCard>
    <KairoCard className="border-white/80 bg-gradient-to-br from-white to-emerald-50/40 p-6 shadow-[0_20px_55px_-38px_rgba(5,150,105,.55)]">{selected ? <div>
<p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#153E90]">Approval detail</p>
<h2 className="mt-2 text-xl font-bold text-slate-950">{selected.employees?.title} {selected.employees?.name}</h2>
<dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
<div>
<dt className="text-slate-400">Leave type</dt>
<dd className="mt-1 font-bold">{selected.leave_types?.name}</dd>
</div>
<div>
<dt className="text-slate-400">Duration</dt>
<dd className="mt-1 font-bold">{selected.working_days} working days</dd>
</div>
<div>
<dt className="text-slate-400">Current balance</dt>
<dd className="mt-1 font-bold">{selected.policy_snapshot?.balance_before_request ?? "—"}</dd>
</div>
<div>
<dt className="text-slate-400">Projected balance</dt>
<dd className="mt-1 font-bold">{selected.policy_snapshot?.projected_balance ?? "—"}</dd>
</div>
<div>
<dt className="text-slate-400">Monthly usage</dt>
<dd className="mt-1 font-bold">Policy checked</dd>
</div>
<div>
<dt className="text-slate-400">Team conflicts</dt>
<dd className={`mt-1 font-bold ${conflicts.length ? "text-amber-700" : "text-emerald-700"}`}>{conflicts.length ? `${conflicts.length} overlapping leave` : "No overlap"}</dd>
</div>
</dl>
<div className="mt-5 rounded-xl bg-slate-50 p-4">
<p className="text-xs font-bold uppercase tracking-wide text-slate-400">Reason</p>
<p className="mt-2 text-sm text-slate-700">{selected.reason}</p>
</div>{conflicts.length ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
<p className="font-bold">Team availability conflict</p>{conflicts.slice(0, 4).map((leave) => <p key={leave.id} className="mt-1">{leave.employee_name} · {leave.start_date} – {leave.end_date}</p>)}</div> : null}{selected.policy_snapshot?.warnings?.length ? <ul className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{selected.policy_snapshot.warnings.map((warning) => <li key={warning} className="ml-4 list-disc">{warning}</li>)}</ul> : null}{selected.leave_request_comments?.length ? <div className="mt-4 rounded-xl bg-slate-50 p-4">
<p className="text-xs font-bold uppercase text-slate-400">Comments</p>{selected.leave_request_comments.map((item) => <p key={item.id} className="mt-2 text-sm">
<span className="font-bold capitalize">{item.author_role}:</span> {item.comment}</p>)}</div> : null}{selected.leave_attachments?.length ? <div className="mt-4 flex flex-wrap gap-2">{selected.leave_attachments.map((file) => <button key={file.id} type="button" onClick={() => void openLeaveAttachment(file.storage_path)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-[#153E90]">View {file.file_name}</button>)}</div> : null}<label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="approval-comment">Comment</label>
<textarea id="approval-comment" value={comment} onChange={(event) => setComment(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-[#153E90]" />{selected.administrative_override_required && isAdmin ? <>
<label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="approval-override">Administrative override reason</label>
<textarea id="approval-override" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-red-200 p-3 outline-none focus:border-red-500" />
</> : null}{error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}<div className="mt-5 flex flex-wrap gap-3">
<KairoButton type="button" variant="secondary" disabled={processing || !comment.trim()} onClick={addComment}>Add Comment</KairoButton>{selected.status === "pending" ? <>
<KairoButton type="button" disabled={processing || (selected.administrative_override_required && !isAdmin)} onClick={() => decide("approve")}>Approve</KairoButton>
<KairoButton type="button" variant="danger" disabled={processing} onClick={() => decide("reject")}>Reject</KairoButton>
</> : <>
<KairoButton type="button" disabled={processing} onClick={() => decide("approve_cancellation")}>Approve Cancellation</KairoButton>
<KairoButton type="button" variant="danger" disabled={processing} onClick={() => decide("reject_cancellation")}>Reject Cancellation</KairoButton>
</>}</div>
</div> : <div className="flex min-h-80 items-center justify-center text-center">
<div>
<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-[#153E90]">✓</div>
<p className="mt-4 font-bold text-slate-700">Select a request</p>
<p className="mt-1 text-sm text-slate-400">Policy checks and approval actions will appear here.</p>
</div>
</div>}</KairoCard>
    <ManagedRequestSearch requests={managedRequests} employees={managedEmployees} />
    <KairoCard className="overflow-hidden border-white/80 shadow-[0_20px_55px_-38px_rgba(21,62,144,.7)] xl:col-span-2">
<div className="border-b px-6 py-5">
<div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold">Direct-Report Balances</h2>
<p className="mt-1 text-sm text-slate-500">Search and filter employees visible through your reporting hierarchy.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#153E90]">{balanceSearchApplied ? `${filteredBalances.length} records` : "Awaiting search"}</span></div>
<div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_auto_auto]"><KairoSelect id="balance-employee" label="Employee" value={balanceEmployee} onChange={(event) => setBalanceEmployee(event.target.value)}><option value="">All reporting employees</option>{balanceEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employeeOptionLabel(employee.code, employee.name)}</option>)}</KairoSelect><KairoSelect id="balance-type" label="Leave type" value={balanceType} onChange={(event) => setBalanceType(event.target.value)}><option value="">All leave types</option>{balanceTypes.map((type) => <option key={type.code} value={type.code}>{type.name}</option>)}</KairoSelect><div className="flex items-end"><KairoButton type="button" onClick={searchBalances}>Search</KairoButton></div><div className="flex items-end"><KairoButton type="button" variant="secondary" onClick={resetBalanceSearch}>Reset</KairoButton></div></div>
</div>
<div className="overflow-x-auto">
<table className="min-w-full text-left text-sm">
<thead className="bg-[#0F172A] text-xs uppercase text-slate-300">
<tr>
<th className="px-5 py-4">Employee Code</th>
<th className="px-5 py-4">Employee Name</th>
<th className="px-5 py-4">Leave Type</th>
<th className="px-5 py-4">Entitled</th>
<th className="px-5 py-4">Used</th>
<th className="px-5 py-4">Pending</th>
<th className="px-5 py-4">Available</th>
</tr>
</thead>
<tbody className="divide-y">{filteredBalances.map((balance) => <tr key={balance.id}>
<td className="px-5 py-4 font-bold text-[#153E90]">{balance.employee_code || "—"}</td>
<td className="px-5 py-4 font-bold">{balance.employee_title} {balance.employee_name}</td>
<td className="px-5 py-4">{balance.leave_type_name}</td>
<td className="px-5 py-4">{balance.entitled_days}</td>
<td className="px-5 py-4">{balance.used_days}</td>
<td className="px-5 py-4">{balance.pending_days}</td>
<td className="px-5 py-4 font-bold text-[#153E90]">{balance.available_days}</td>
</tr>)}{!balanceSearchApplied ? <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400">Select an employee and leave type, then click Search to view balances.</td></tr> : !filteredBalances.length ? <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400">No leave balances match the selected filters.</td></tr> : null}</tbody>
</table>
</div>
</KairoCard>
    <KairoCard className="p-6">
<h2 className="text-xl font-bold">Upcoming Team Leave</h2>
<div className="mt-4 space-y-3">{upcoming.map((leave) => <div key={leave.id} className="rounded-xl bg-slate-50 p-4">
<p className="font-bold">{leave.employee_name} · {leave.leave_type_name}</p>
<p className="mt-1 text-xs text-slate-500">{leave.start_date} – {leave.end_date}</p>
</div>)}{!upcoming.length ? <p className="text-sm text-slate-400">No upcoming direct-report leave.</p> : null}</div>
</KairoCard>
    <KairoCard className="p-6">
<h2 className="text-xl font-bold">Recently Processed</h2>
<div className="mt-4 space-y-3">{recent.slice(0, 8).map((request) => <div key={request.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
<div>
<p className="font-bold">{request.employees?.name} · {request.leave_types?.name}</p>
<p className="mt-1 text-xs text-slate-500">{request.start_date} – {request.end_date}</p>
</div>
<TimeOffStatusBadge status={request.status} />
</div>)}</div>
</KairoCard>
  </div>;
}

function ManagedRequestSearch({ requests, employees: managedEmployees }: { requests: LeaveRequest[]; employees: TimeOffManagedEmployee[] }) {
  const [employeeId, setEmployeeId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [applied, setApplied] = useState({ employeeId: "", leaveTypeId: "", status: "", fromDate: "", toDate: "" });
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const employees = useMemo(() => managedEmployees.map((employee) => ({
    id: employee.id,
    code: employee.employee_code,
    name: [employee.title, employee.name].filter(Boolean).join(" "),
  })).sort((left, right) => compareEmployeeCodes(left.code, right.code, left.name, right.name)), [managedEmployees]);
  const leaveTypes = useMemo(() => Array.from(new Map(requests.filter((request) => request.leave_types).map((request) => [request.leave_type_id, { id: request.leave_type_id, name: request.leave_types?.name || "Leave" }])).values()).sort((left, right) => left.name.localeCompare(right.name)), [requests]);
  const filtered = useMemo(() => searched ? requests.filter((request) => {
    if (applied.employeeId && request.employee_id !== applied.employeeId) return false;
    if (applied.leaveTypeId && request.leave_type_id !== applied.leaveTypeId) return false;
    if (applied.status && request.status !== applied.status) return false;
    if (applied.fromDate && request.end_date < applied.fromDate) return false;
    if (applied.toDate && request.start_date > applied.toDate) return false;
    return true;
  }).sort((left, right) => compareEmployeeCodes(left.employees?.employee_code, right.employees?.employee_code, left.employees?.name, right.employees?.name) || right.start_date.localeCompare(left.start_date)) : [], [applied, requests, searched]);

  function search() {
    if (fromDate && toDate && fromDate > toDate) {
      setError("The From date cannot be after the To date.");
      return;
    }
    setApplied({ employeeId, leaveTypeId, status, fromDate, toDate });
    setSearched(true);
    setError("");
  }

  function reset() {
    setEmployeeId(""); setLeaveTypeId(""); setStatus(""); setFromDate(""); setToDate("");
    setApplied({ employeeId: "", leaveTypeId: "", status: "", fromDate: "", toDate: "" });
    setSearched(false); setError("");
  }

  return <KairoCard className="overflow-hidden border-white/80 bg-gradient-to-br from-cyan-50/70 via-white to-blue-50/70 shadow-[0_20px_55px_-38px_rgba(14,116,144,.65)] xl:col-span-2">
    <div className="border-b border-white/80 px-6 py-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-700 text-white shadow-lg shadow-cyan-900/20"><TimeOffIcon name="people" className="h-5 w-5" /></span><div><h2 className="text-xl font-bold">Reporting Employee Requests</h2><p className="mt-1 text-sm text-slate-500">Search leave requests visible through your reporting access.</p></div></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-cyan-800 shadow-sm">{searched ? `${filtered.length} records` : "Awaiting search"}</span></div>
    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.25fr_1fr_1fr_170px_170px_auto_auto]">
      <select aria-label="Filter reporting requests by employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 shadow-sm"><option value="">All reporting employees</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employeeOptionLabel(employee.code, employee.name)}</option>)}</select>
      <select aria-label="Filter reporting requests by leave type" value={leaveTypeId} onChange={(event) => setLeaveTypeId(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 shadow-sm"><option value="">All leave types</option>{leaveTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select>
      <select aria-label="Filter reporting requests by status" value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 shadow-sm"><option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option><option value="cancellation_requested">Cancellation Requested</option><option value="cancellation_rejected">Cancellation Rejected</option><option value="cancelled_by_admin">Cancelled by Admin</option></select>
      <input aria-label="Reporting requests from date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 shadow-sm" />
      <input aria-label="Reporting requests to date" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 shadow-sm" />
      <KairoButton type="button" onClick={search}>Search</KairoButton><KairoButton type="button" variant="secondary" onClick={reset}>Reset</KairoButton>
    </div>{error ? <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}</div>
    <div className="max-h-[520px] overflow-auto"><table className="min-w-full text-left text-sm"><thead className="sticky top-0 bg-[#0F172A] text-xs uppercase tracking-wide text-slate-300"><tr><th className="px-5 py-4">Employee Code</th><th className="px-5 py-4">Employee Name</th><th className="px-5 py-4">Leave Type</th><th className="px-5 py-4">Dates</th><th className="px-5 py-4">Days</th><th className="px-5 py-4">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((request) => <tr key={request.id} className="bg-white/80 transition hover:bg-blue-50/60"><td className="px-5 py-4 font-bold text-[#153E90]">{request.employees?.employee_code || "—"}</td><td className="px-5 py-4 font-bold text-slate-900">{request.employees?.title} {request.employees?.name}</td><td className="px-5 py-4">{request.leave_types?.name}</td><td className="whitespace-nowrap px-5 py-4">{request.start_date} – {request.end_date}</td><td className="px-5 py-4 font-bold">{request.working_days}</td><td className="px-5 py-4"><TimeOffStatusBadge status={request.status} /></td></tr>)}{!searched ? <tr><td colSpan={6} className="bg-white px-6 py-14 text-center text-sm text-slate-400">Choose filters and click Search to view reporting employee requests.</td></tr> : !filtered.length ? <tr><td colSpan={6} className="bg-white px-6 py-14 text-center text-sm text-slate-400">No requests match the selected filters.</td></tr> : null}</tbody></table></div>
  </KairoCard>;
}
