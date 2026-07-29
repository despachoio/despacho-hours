"use client";

import { useMemo, useState } from "react";
import KairoButton from "@/components/ui/KairoButton";
import KairoCard from "./TimeOffPremiumCard";
import TimeOffStatusBadge from "./TimeOffStatusBadge";
import { cancelLeave, openLeaveAttachment, type LeaveRequest, type LeaveType } from "@/lib/time-off/client";
import TimeOffIcon from "./TimeOffIcon";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

export default function MyLeaveRequests({ requests, leaveTypes, onChanged }: { requests: LeaveRequest[]; leaveTypes: LeaveType[]; onChanged: () => void }) {
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("all");
  const [appliedType, setAppliedType] = useState("all");
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const pageSize = 10;
  const filtered = useMemo(() => requests.filter((request) => {
    return (appliedStatus === "all" || request.status === appliedStatus)
      && (appliedType === "all" || request.leave_type_id === appliedType)
      && (!appliedFromDate || request.end_date >= appliedFromDate)
      && (!appliedToDate || request.start_date <= appliedToDate);
  }), [appliedFromDate, appliedStatus, appliedToDate, appliedType, requests]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((Math.min(page, pages) - 1) * pageSize, Math.min(page, pages) * pageSize);

  async function cancel(request: LeaveRequest) {
    const message = request.status === "pending" ? "Cancel this pending leave request?" : "Request cancellation of this approved leave?";
    if (!window.confirm(message)) return;
    setProcessing(request.id); setError("");
    try { await cancelLeave(request.id); onChanged(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to cancel request."); } finally { setProcessing(null); }
  }

  function searchRequests() {
    if (fromDate && toDate && fromDate > toDate) {
      setError("The From date cannot be after the To date.");
      return;
    }
    setAppliedType(type);
    setAppliedStatus(status);
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
    setPage(1);
    setError("");
  }

  function resetFilters() {
    setType("all");
    setStatus("all");
    setFromDate("");
    setToDate("");
    setAppliedType("all");
    setAppliedStatus("all");
    setAppliedFromDate("");
    setAppliedToDate("");
    setPage(1);
    setError("");
  }

  function exportCsv() {
    const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      "Leave Type,Start Date,End Date,Working Days,Submitted,Status,Reason,Approval Comment",
      ...filtered.map((request) => [request.leave_types?.name, request.start_date, request.end_date, request.working_days, request.submitted_at, request.status, request.reason, request.manager_comment].map(quote).join(",")),
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "my-leave-requests.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <div className="space-y-5">
    <KairoCard className="overflow-hidden border-white/80 bg-gradient-to-br from-blue-50/80 via-white to-violet-50/60 shadow-[0_20px_55px_-35px_rgba(21,62,144,.65)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/80 px-5 py-4 sm:px-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#153E90] text-white shadow-lg shadow-blue-900/20"><TimeOffIcon name="search" className="h-5 w-5" /></span><div><h2 className="font-bold text-slate-950">Find my leave requests</h2><p className="text-xs text-slate-500">Choose the filters, then click Search to apply them.</p></div></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#153E90] shadow-sm">{filtered.length} results</span></div>
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_170px_170px_auto_auto_auto]">
      <select aria-label="Filter by leave type" value={type} onChange={(event) => setType(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 shadow-sm outline-none focus:border-[#153E90] focus:ring-2 focus:ring-blue-100"><option value="all">All leave types</option>{leaveTypes.map((leaveType) => <option key={leaveType.id} value={leaveType.id}>{leaveType.name}</option>)}</select>
      <select aria-label="Filter by request status" value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 shadow-sm outline-none focus:border-[#153E90] focus:ring-2 focus:ring-blue-100"><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option><option value="cancellation_requested">Cancellation Requested</option><option value="cancellation_rejected">Cancellation Rejected</option><option value="cancelled_by_admin">Cancelled by Admin</option></select>
      <input aria-label="From date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 shadow-sm outline-none focus:border-[#153E90] focus:ring-2 focus:ring-blue-100" />
      <input aria-label="To date" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 shadow-sm outline-none focus:border-[#153E90] focus:ring-2 focus:ring-blue-100" />
      <KairoButton type="button" onClick={searchRequests}>Search</KairoButton>
      <KairoButton type="button" variant="secondary" onClick={resetFilters}>Reset</KairoButton>
      <KairoButton type="button" variant="secondary" onClick={exportCsv}>Export CSV</KairoButton>
      </div>
    </KairoCard>
    {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}
    <KairoCard className="overflow-hidden border-white/80 shadow-[0_20px_55px_-38px_rgba(21,62,144,.65)]">
      <div className="border-b border-slate-100 bg-gradient-to-r from-white to-slate-50 px-6 py-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><TimeOffIcon name="document" className="h-5 w-5" /></span><div><h2 className="text-xl font-bold text-slate-950">My Requests</h2><p className="mt-1 text-sm text-slate-500">Requests submitted during the current calendar year.</p></div></div></div>
      <div className="divide-y divide-slate-100">
        {rows.length ? rows.map((request) => <article key={request.id}>
          <button type="button" onClick={() => setExpanded(expanded === request.id ? null : request.id)} aria-expanded={expanded === request.id} className="grid w-full gap-3 px-5 py-4 text-left transition hover:bg-slate-50 sm:grid-cols-[1.2fr_1fr_.65fr_.85fr_auto] sm:items-center">
            <div><p className="font-bold text-slate-950">{request.leave_types?.name || "Leave"}</p><p className="mt-1 line-clamp-1 text-xs text-slate-500">{request.reason}</p></div>
            <p className="text-sm font-medium text-slate-700">{formatDate(request.start_date)} – {formatDate(request.end_date)}</p>
            <p className="text-sm font-bold text-[#153E90]">{request.working_days} days</p>
            <TimeOffStatusBadge status={request.status} />
            <span className="text-slate-400">{expanded === request.id ? "−" : "+"}</span>
          </button>
          {expanded === request.id ? <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-slate-400">Submitted</dt><dd className="mt-1 font-bold">{formatDate(request.submitted_at)}</dd></div><div><dt className="text-slate-400">Calendar span</dt><dd className="mt-1 font-bold">{request.calendar_span_days} days</dd></div><div><dt className="text-slate-400">Holidays excluded</dt><dd className="mt-1 font-bold">{request.holidays_excluded}</dd></div><div><dt className="text-slate-400">Weekly offs excluded</dt><dd className="mt-1 font-bold">{request.weekly_offs_excluded}</dd></div></dl>
            <div className="mt-4 grid gap-4 lg:grid-cols-2"><div className="rounded-xl bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Reason</p><p className="mt-2 text-sm text-slate-700">{request.reason}</p></div><div className="rounded-xl bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Approval comment</p><p className="mt-2 text-sm text-slate-700">{request.manager_comment || "No comment yet."}</p></div></div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Leave-day breakdown</p><div className="mt-2 space-y-1 text-sm">{request.leave_request_days?.filter((day) => day.is_working_day).map((day) => <p key={day.id}>{formatDate(day.leave_date)} · {day.day_part.replaceAll("_", " ")}</p>)}</div></div>
              <div className="rounded-xl bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Request timeline</p><div className="mt-2 space-y-2 text-sm">{request.leave_request_actions?.map((action) => <p key={action.id}><span className="font-bold capitalize">{action.action.replaceAll("_", " ")}</span> · {new Date(action.created_at).toLocaleString("en-IN")}{action.comment ? ` · ${action.comment}` : ""}</p>)}</div></div>
            </div>
            {request.leave_attachments?.length ? <div className="mt-4 flex flex-wrap gap-2">{request.leave_attachments.map((file) => <button key={file.id} type="button" onClick={() => void openLeaveAttachment(file.storage_path)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-[#153E90]">View {file.file_name}</button>)}</div> : null}
            {request.administrative_override_required ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">Administrative override required.</p> : null}
            {request.status === "pending" || request.status === "approved" || request.status === "cancellation_rejected" ? <div className="mt-4"><KairoButton type="button" variant="secondary" disabled={processing === request.id} onClick={() => cancel(request)}>{processing === request.id ? "Processing…" : request.status === "pending" ? "Cancel Request" : "Request Cancellation"}</KairoButton></div> : null}
          </div> : null}
        </article>) : <div className="px-6 py-16 text-center"><p className="font-bold text-slate-700">No leave requests found</p><p className="mt-1 text-sm text-slate-400">Adjust the filters or create your first request.</p></div>}
      </div>
      {filtered.length > pageSize ? <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm"><span className="text-slate-500">Page {Math.min(page, pages)} of {pages}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button><button type="button" disabled={page >= pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button></div></div> : null}
    </KairoCard>
  </div>;
}
