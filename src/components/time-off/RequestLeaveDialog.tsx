"use client";

import { useEffect, useMemo, useState } from "react";
import KairoButton from "@/components/ui/KairoButton";
import KairoInput from "@/components/ui/KairoInput";
import KairoSelect from "@/components/ui/KairoSelect";
import KairoTextarea from "@/components/ui/KairoTextarea";
import {
  evaluateLeave,
  submitLeave,
  uploadLeaveAttachment,
  type LeaveType,
} from "@/lib/time-off/client";
import type { DayPart, PolicyEvaluation } from "@/lib/time-off/types";
import TimeOffIcon from "./TimeOffIcon";

export default function RequestLeaveDialog({
  open,
  employeeId,
  employeeGender,
  leaveTypes,
  isAdmin,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  employeeId: string;
  employeeGender: string | null;
  leaveTypes: LeaveType[];
  isAdmin: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startPart, setStartPart] = useState<DayPart>("full_day");
  const [endPart, setEndPart] = useState<DayPart>("full_day");
  const [reason, setReason] = useState("");
  const [handoverNotes, setHandoverNotes] = useState("");
  const [emergency, setEmergency] = useState(false);
  const [lopReasonCategory, setLopReasonCategory] = useState("general");
  const [overrideReason, setOverrideReason] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [evaluation, setEvaluation] = useState<PolicyEvaluation | null>(null);
  const [evaluationError, setEvaluationError] = useState("");
  const [confirmImpact, setConfirmImpact] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const eligibleLeaveTypes = useMemo(() => {
    const gender = String(employeeGender || "").trim().toLowerCase();
    return leaveTypes.filter((type) => {
      if (!type.is_active) return false;
      const eligibility = String(type.gender_eligibility || "All").trim().toLowerCase();
      return eligibility === "all" || eligibility === gender;
    });
  }, [employeeGender, leaveTypes]);
  const selectedType = useMemo(
    () => leaveTypes.find((type) => type.id === leaveTypeId) || null,
    [leaveTypeId, leaveTypes],
  );
  const singleDay = startDate && endDate && startDate === endDate;
  const requiresConfirmation = Boolean(
    evaluation?.extended_exception_consumed ||
    selectedType?.code === "LOP" ||
    evaluation?.override_required ||
    (evaluation && evaluation.projected_balance < 0),
  );

  function resetPolicyEvaluation() {
    setConfirmImpact(false);
    setEvaluation(null);
    setEvaluationError("");
  }

  useEffect(() => {
    if (!open) return;
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("keydown", escape);
    };
  }, [onClose, open, submitting]);

  useEffect(() => {
    if (!open || !leaveTypeId || !startDate || !endDate || endDate < startDate) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const result = await evaluateLeave({
          employeeId,
          leaveTypeId,
          startDate,
          endDate,
          startDayPart: startPart,
          endDayPart: singleDay ? startPart : endPart,
        });
        if (!cancelled) setEvaluation(result);
      } catch (cause) {
        if (!cancelled) setEvaluationError(cause instanceof Error ? cause.message : "Unable to calculate leave.");
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [employeeId, endDate, endPart, leaveTypeId, open, singleDay, startDate, startPart]);

  if (!open) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!evaluation?.valid) return;
    if (requiresConfirmation && !confirmImpact) {
      setError("Confirm the policy and balance impact before submitting.");
      return;
    }
    if (evaluation.override_required && isAdmin && !overrideReason.trim()) {
      setError("Enter an administrative override reason.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const request = await submitLeave({
        employeeId,
        leaveTypeId,
        startDate,
        endDate,
        startDayPart: startPart,
        endDayPart: singleDay ? startPart : endPart,
        reason,
        handoverNotes,
        emergency,
        lopReasonCategory: selectedType?.code === "LOP" ? lopReasonCategory : null,
        overrideReason: evaluation.override_required && isAdmin ? overrideReason : null,
      });
      if (attachment) await uploadLeaveAttachment(employeeId, request.id, attachment);
      onSubmitted();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to submit leave request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="request-leave-title" className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-[#153E90]"><TimeOffIcon name="calendar" className="h-5 w-5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#153E90]">Employee self-service</p><h2 id="request-leave-title" className="mt-1 text-2xl font-bold text-slate-950">Request Leave</h2></div></div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Close request leave dialog" className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xl text-slate-500 hover:bg-slate-200">×</button>
        </div>
        <form onSubmit={submit} className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[1.15fr_.85fr]">
          <div className="space-y-5">
            <KairoSelect autoFocus id="leave-type" label="Leave type" required value={leaveTypeId} onChange={(event) => { resetPolicyEvaluation(); setLeaveTypeId(event.target.value); }}>
              <option value="">Select leave type</option>
              {eligibleLeaveTypes.map((type) => <option key={type.id} value={type.id}>{type.name}{type.is_paid ? " · Paid" : " · Unpaid"}</option>)}
            </KairoSelect>
            <div className="grid gap-4 sm:grid-cols-2"><KairoInput id="leave-start" type="date" label="Start date" required value={startDate} onChange={(event) => { resetPolicyEvaluation(); setStartDate(event.target.value); if (!endDate || event.target.value > endDate) setEndDate(event.target.value); }} /><KairoInput id="leave-end" type="date" label="End date" required min={startDate || undefined} value={endDate} onChange={(event) => { resetPolicyEvaluation(); setEndDate(event.target.value); }} /></div>
            {singleDay ? <KairoSelect id="single-duration" label="Duration" value={startPart} onChange={(event) => { resetPolicyEvaluation(); setStartPart(event.target.value as DayPart); }}><option value="full_day">Full Day</option><option value="first_half">First Half</option><option value="second_half">Second Half</option></KairoSelect> : <div className="grid gap-4 sm:grid-cols-2"><KairoSelect id="start-duration" label="Start date duration" value={startPart} onChange={(event) => { resetPolicyEvaluation(); setStartPart(event.target.value as DayPart); }}><option value="full_day">Full Day</option><option value="second_half">Second Half</option></KairoSelect><KairoSelect id="end-duration" label="End date duration" value={endPart} onChange={(event) => { resetPolicyEvaluation(); setEndPart(event.target.value as DayPart); }}><option value="full_day">Full Day</option><option value="first_half">First Half</option></KairoSelect></div>}
            <KairoTextarea id="leave-reason" label="Reason" required maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why you need this time away." />
            <KairoTextarea id="handover-notes" label="Contact or handover notes" maxLength={2000} value={handoverNotes} onChange={(event) => setHandoverNotes(event.target.value)} placeholder="Add coverage, handover, or emergency contact information." />
            {selectedType?.code === "UL" ? <label className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900"><input type="checkbox" checked={emergency} onChange={(event) => setEmergency(event.target.checked)} className="h-4 w-4" />This is an emergency Unplanned Leave request</label> : null}
            {selectedType?.code === "LOP" ? <KairoSelect id="lop-reason" label="LOP reason category" value={lopReasonCategory} onChange={(event) => setLopReasonCategory(event.target.value)}><option value="general">General LOP</option><option value="monthly_paid_leave_limit_exceeded">Exceeded monthly Planned/Unplanned limit</option></KairoSelect> : null}
            <div><label htmlFor="leave-attachment" className="mb-2 block text-sm font-semibold text-slate-700">Supporting attachment <span className="font-normal text-slate-400">(optional, max 10 MB)</span></label><input id="leave-attachment" type="file" onChange={(event) => setAttachment(event.target.files?.[0] || null)} className="w-full rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-bold file:text-[#153E90]" /></div>
          </div>
          <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-2xl bg-[#0F172A] p-5 text-white"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-200">Live policy calculation</p>{evaluation ? <dl className="mt-5 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-slate-400">Calendar span</dt><dd className="mt-1 text-lg font-bold">{evaluation.calculated_duration.calendar_span_days} days</dd></div><div><dt className="text-slate-400">Chargeable leave</dt><dd className="mt-1 text-lg font-bold">{evaluation.calculated_duration.working_days} days</dd></div><div><dt className="text-slate-400">Holidays excluded</dt><dd className="mt-1 font-bold">{evaluation.calculated_duration.holidays_excluded}</dd></div><div><dt className="text-slate-400">Weekly offs excluded</dt><dd className="mt-1 font-bold">{evaluation.calculated_duration.weekly_offs_excluded}</dd></div><div><dt className="text-slate-400">Balance before</dt><dd className="mt-1 font-bold">{evaluation.balance_before_request} days</dd></div><div><dt className="text-slate-400">Projected balance</dt><dd className="mt-1 font-bold">{evaluation.projected_balance} days</dd></div><div><dt className="text-slate-400">Monthly applications</dt><dd className="mt-1 font-bold">{evaluation.selected_month_application_count}</dd></div><div><dt className="text-slate-400">Monthly paid usage</dt><dd className="mt-1 font-bold">{evaluation.selected_month_paid_days} days</dd></div><div><dt className="text-slate-400">Annual Unplanned</dt><dd className="mt-1 font-bold">{evaluation.annual_unplanned_used} / {evaluation.annual_unplanned_limit} days</dd></div><div><dt className="text-slate-400">LOP payroll equivalent</dt><dd className="mt-1 font-bold">{evaluation.lop_salary_deduction_days} days</dd></div></dl> : <p className="mt-4 text-sm text-slate-300">Select a leave type and dates to calculate the policy impact.</p>}</div>
            {evaluationError ? <Message tone="error" messages={[evaluationError]} /> : null}
            {evaluation?.blocking_errors.length ? <Message tone="error" messages={evaluation.blocking_errors} /> : null}
            {evaluation?.warnings.length ? <Message tone="warning" messages={evaluation.warnings} /> : null}
            {evaluation?.informational_messages.length ? <Message tone="info" messages={evaluation.informational_messages} /> : null}
            {evaluation?.override_required && isAdmin ? <KairoTextarea id="override-reason" label="Administrative override reason" required value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} /> : null}
            {requiresConfirmation ? <label className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-950"><input type="checkbox" checked={confirmImpact} onChange={(event) => setConfirmImpact(event.target.checked)} className="mt-0.5 h-4 w-4" />I understand and confirm the policy, balance, LOP, or extended-leave impact shown above.</label> : null}
            {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p> : null}
            <div className="flex gap-3"><KairoButton type="submit" disabled={submitting || !evaluation?.valid || (requiresConfirmation && !confirmImpact)} className="flex-1">{submitting ? "Submitting…" : "Submit Request"}</KairoButton><KairoButton type="button" variant="secondary" onClick={onClose} disabled={submitting}>Cancel</KairoButton></div>
          </aside>
        </form>
      </section>
    </div>
  );
}

function Message({ tone, messages }: { tone: "error" | "warning" | "info"; messages: string[] }) {
  const styles = tone === "error" ? "border-red-200 bg-red-50 text-red-800" : tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900";
  return <div className={`rounded-xl border p-4 text-sm ${styles}`}><p className="font-bold capitalize">{tone}</p><ul className="mt-2 space-y-1 pl-4">{messages.map((message) => <li key={message} className="list-disc">{message}</li>)}</ul></div>;
}
