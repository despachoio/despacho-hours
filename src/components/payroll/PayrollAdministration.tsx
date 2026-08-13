"use client";

import { useMemo, useState } from "react";
import KairoButton from "@/components/ui/KairoButton";
import { downloadBankTransfer, downloadPayrollSummary, downloadPayrollYtd, downloadPayslip, processPayslipDistribution } from "@/lib/payroll/client";
import { currentFinancialYear, financialYearFromValue, financialYearOptions } from "@/lib/payroll/financialYear";
import {
  buildBankTransferFile,
  bankTransferSummary,
  employeeBankDetailsMap,
  salaryRegisterGrossPay,
  salaryRegisterHeaders,
  salaryRegisterRows,
  stripEmployeeTitle,
  summarizePayroll,
} from "@/lib/payroll/exports";
import { canApprovePayroll, canEditPayroll, canExportPayroll, canSubmitPayroll, payrollLifecycleStatus } from "@/lib/payroll/lifecycle";
import { payrollMonthLabel, payslipFilename } from "@/lib/payroll/filenames";
import type {
  CompanyPayrollBankDetails,
  EmployeeBankDetails,
  PayrollEntry,
  PayrollRun,
} from "@/lib/payroll/types";

type Employee = { id: string; employee_code: string; name: string };
type PayrollData = {
  role: string;
  runs?: PayrollRun[];
  employees?: Employee[];
  selectedRun?: PayrollRun | null;
  bankDetails?: EmployeeBankDetails[];
  companyBankDetails?: CompanyPayrollBankDetails;
};
type Action = (payload: Record<string, unknown>, refresh?: boolean) => Promise<boolean>;

const money = (value: number) => `₹${Math.round(Number(value || 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <section className={`relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_45px_-32px_rgba(15,23,42,.35)] ${className}`}>{children}</section>;
const fieldClass = "mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none transition focus:border-[#153E90] focus:ring-2 focus:ring-blue-100";

function Metric({ label, value, colour }: { label: string; value: string; colour: string }) {
  return <Card className="p-6"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">{label}</p><p className={`mt-4 text-2xl font-bold capitalize ${colour}`}>{value}</p></Card>;
}

async function downloadSalaryRegister(run: PayrollRun, bankDetails: EmployeeBankDetails[]) {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet([salaryRegisterHeaders, ...salaryRegisterRows(run, bankDetails)]);
  sheet["!cols"] = [12, 24, 22, 16, 22, 14, 18, 16, 12, 14, 14, 12, 16].map((wch) => ({ wch }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Salary Register");
  XLSX.writeFile(book, `Salary_Register_${run.payroll_month.slice(0, 7)}.xlsx`);
}

const localDateValue = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export function PayrollProcessing({ data, month, setMonth, onAction, onRefresh, onEdit }: { data: PayrollData; month: string; setMonth: (value: string) => void; onAction: Action; onRefresh: () => Promise<void>; onEdit: (entry: PayrollEntry) => void }) {
  const run = data.selectedRun || null;
  const [busy, setBusy] = useState("");
  const [processingDate, setProcessingDate] = useState(run?.processing_date || localDateValue());
  const [exportError, setExportError] = useState("");
  const [confirmingBankExport, setConfirmingBankExport] = useState(false);
  const [distribution, setDistribution] = useState<{ open: boolean; completed: number; total: number; failed: Array<{ entryId: string; message: string }> }>({ open: false, completed: 0, total: 0, failed: [] });

  async function execute(name: string, payload: Record<string, unknown>) {
    if (busy) return;
    setBusy(name);
    setExportError("");
    try { await onAction(payload); } finally { setBusy(""); }
  }

  function exportBankFile() {
    if (!run) return;
    setExportError("");
    try {
      buildBankTransferFile(run, data.bankDetails || [], data.companyBankDetails || {
        payroll_bank_customer_id: null,
        payroll_bank_account_number: null,
        payroll_bank_ifsc_code: null,
        payroll_bank_branch_code: null,
        payroll_bank_currency: null,
      });
      setConfirmingBankExport(true);
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : "Unable to create the bank transfer file.");
    }
  }

  async function cancel() {
    if (!run) return;
    const reason = window.prompt("Reason for cancelling payroll");
    if (!reason?.trim()) return;
    await execute("cancel", { action: "cancel", runId: run.id, reason });
  }

  async function submitAndDistribute() {
    if (!run || busy) return;
    setBusy("submit");
    setDistribution({ open: true, completed: 0, total: run.entries?.length || 0, failed: [] });
    try {
      const submitted = await onAction({ action: "submit", runId: run.id }, false);
      if (!submitted) { setDistribution((current) => ({ ...current, total: 0, failed: [{ entryId: "", message: "Payroll submission failed. Payslips were not distributed." }] })); return; }
      for (const entry of run.entries || []) {
        try { await processPayslipDistribution(entry.id); }
        catch (cause) { setDistribution((current) => ({ ...current, failed: [...current.failed, { entryId: entry.id, message: cause instanceof Error ? cause.message : "Distribution failed" }] })); }
        finally { setDistribution((current) => ({ ...current, completed: current.completed + 1 })); }
      }
    } finally { setBusy(""); }
  }

  async function retryFailed() {
    if (!distribution.failed.length || busy) return;
    const failed = [...distribution.failed];
    setBusy("retry");
    setDistribution((current) => ({ ...current, completed: 0, total: failed.length, failed: [] }));
    for (const item of failed) {
      try { await processPayslipDistribution(item.entryId, "resend"); }
      catch (cause) { setDistribution((current) => ({ ...current, failed: [...current.failed, { entryId: item.entryId, message: cause instanceof Error ? cause.message : "Retry failed" }] })); }
      finally { setDistribution((current) => ({ ...current, completed: current.completed + 1 })); }
    }
    setBusy("");
  }

  const lifecycle = run ? payrollLifecycleStatus(run.status) : null;
  const runSummary = useMemo(
    () => summarizePayroll(run?.entries || []),
    [run?.entries],
  );
  const failedDistributionEntries = useMemo(() => {
    const failedIds = new Set((run?.distributions || []).filter((item) => item.email_status === "failed").map((item) => item.payroll_entry_id));
    return (run?.entries || []).filter((entry) => failedIds.has(entry.id));
  }, [run?.distributions, run?.entries]);
  const generatedCount = (run?.distributions || []).filter((item) => item.payslip_status === "generated").length;
  const emailedCount = (run?.distributions || []).filter((item) => item.email_status === "completed").length;
  async function resumeFailed() {
    if (!failedDistributionEntries.length || busy) return;
    setBusy("retry");
    setDistribution({ open: true, completed: 0, total: failedDistributionEntries.length, failed: [] });
    for (const entry of failedDistributionEntries) {
      try { await processPayslipDistribution(entry.id, "resend"); }
      catch (cause) { setDistribution((current) => ({ ...current, failed: [...current.failed, { entryId: entry.id, message: cause instanceof Error ? cause.message : "Retry failed" }] })); }
      finally { setDistribution((current) => ({ ...current, completed: current.completed + 1 })); }
    }
    setBusy("");
  }
  return <div className="space-y-5">
    <Card className="p-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="w-52 text-sm font-bold">Payroll Month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className={fieldClass} /></label>
        <label className="w-56 text-sm font-bold">Payroll Processing Date<input type="date" required disabled={Boolean(run)} value={processingDate} onChange={(event) => setProcessingDate(event.target.value)} className={`${fieldClass} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`} /></label>
        {!run ? <KairoButton type="button" disabled={Boolean(busy) || !processingDate} onClick={() => void execute("generate", { action: "generate", payrollMonth: month, processingDate })}>{busy === "generate" ? "Generating..." : "Generate Payroll"}</KairoButton> : null}
        {run && canEditPayroll(run.status) ? <KairoButton type="button" disabled={Boolean(busy)} onClick={() => void execute("reprocess", { action: "reprocess", payrollMonth: month })}>{busy === "reprocess" ? "Reprocessing..." : "Reprocess Payroll"}</KairoButton> : null}
        {run && canApprovePayroll(run.status) ? <KairoButton type="button" disabled={Boolean(busy)} onClick={() => void execute("approve", { action: "approve", runId: run.id })}>{busy === "approve" ? "Approving..." : "Approve Payroll"}</KairoButton> : null}
        {run && canSubmitPayroll(run.status) ? <KairoButton type="button" disabled={Boolean(busy)} onClick={() => void submitAndDistribute()}>{busy === "submit" ? "Submitting..." : "Submit Payroll"}</KairoButton> : null}
        {run?.status === "published" && failedDistributionEntries.length ? <KairoButton type="button" disabled={Boolean(busy)} onClick={() => void resumeFailed()}>Retry Failed Emails ({failedDistributionEntries.length})</KairoButton> : null}
        {run ? <KairoButton type="button" variant="danger" disabled={Boolean(busy)} onClick={() => void cancel()}>{busy === "cancel" ? "Cancelling..." : "Cancel Payroll"}</KairoButton> : null}
        {run && canExportPayroll(run.status) ? <div className="ml-auto flex flex-wrap gap-3"><KairoButton type="button" disabled={Boolean(busy)} onClick={() => void downloadSalaryRegister(run, data.bankDetails || [])}>Download Salary Register</KairoButton>{data.role === "finance admin" ? <KairoButton type="button" variant="secondary" disabled={Boolean(busy)} onClick={exportBankFile}>Export Bank Transfer File</KairoButton> : null}</div> : null}
      </div>
      {exportError && !confirmingBankExport ? <p role="alert" className="mt-4 whitespace-pre-line rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{exportError}</p> : null}
    </Card>
    {run ? <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Employees Processed" value={String(run.employee_count)} colour="text-[#153E90]"/><Metric label="Net Payroll" value={money(run.net_payroll)} colour="text-emerald-700"/><Metric label="Total PF Amount" value={money(runSummary.totalPf)} colour="text-cyan-700"/><Metric label="Total PT Amount" value={money(runSummary.professionalTax)} colour="text-rose-700"/><Metric label="TDS Amount" value={money(runSummary.tds)} colour="text-amber-700"/><Metric label="Status" value={lifecycle || "Generated"} colour="text-violet-700"/><Metric label="Payslip Status" value={run.status === "published" ? `${generatedCount}/${run.employee_count} Generated` : "Pending submission"} colour="text-blue-700"/><Metric label="Email Status" value={run.status === "published" ? failedDistributionEntries.length ? `${failedDistributionEntries.length} Failed` : `${emailedCount}/${run.employee_count} Completed` : "Pending submission"} colour={failedDistributionEntries.length ? "text-rose-700" : "text-emerald-700"}/></div>
      <SalaryRegister run={run} bankDetails={data.bankDetails || []} editable={canEditPayroll(run.status)} onEdit={onEdit} />
    </> : null}
    {run && confirmingBankExport ? <BankExportDialog run={run} bank={data.companyBankDetails!} busy={busy === "bank-export"} error={exportError} onClose={() => { setConfirmingBankExport(false); setExportError(""); }} onGenerate={async () => { setBusy("bank-export"); setExportError(""); try { await downloadBankTransfer(run.id); setConfirmingBankExport(false); } catch (cause) { setExportError(cause instanceof Error ? cause.message : "Unable to create the bank transfer file."); } finally { setBusy(""); } }} /> : null}
    {distribution.open ? <DistributionDialog state={distribution} busy={Boolean(busy)} onRetry={() => void retryFailed()} onClose={() => { setDistribution((current) => ({ ...current, open: false })); void onRefresh(); }} /> : null}
  </div>;
}

function DistributionDialog({ state, busy, onRetry, onClose }: { state: { completed: number; total: number; failed: Array<{ message: string }> }; busy: boolean; onRetry: () => void; onClose: () => void }) {
  const finished = state.total === 0 ? state.failed.length > 0 : state.completed >= state.total;
  const successful = state.completed - state.failed.length;
  const stages = [
    ["Processing Payroll", true],
    ["Generating Payslips", state.completed > 0 || finished],
    ["Password Protecting PDFs", state.completed > 0 || finished],
    ["Sending Emails", finished],
  ] as const;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-5"><section role="dialog" aria-modal="true" className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl"><header className="bg-gradient-to-r from-[#0F172A] to-[#153E90] px-7 py-6 text-white"><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-200">Payslip distribution</p><h2 className="mt-2 text-2xl font-bold">{finished ? "Payslip Distribution Complete" : "Submitting Payroll..."}</h2></header><div className="space-y-4 p-7"><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-gradient-to-r from-[#153E90] to-cyan-500 transition-all duration-700" style={{ width: `${state.total ? Math.round(state.completed / state.total * 100) : 0}%` }}/></div><p className="text-center text-xl font-bold text-[#153E90]">{state.completed} / {state.total} completed</p><div className="grid gap-2 sm:grid-cols-2">{stages.map(([label, complete], index) => <div key={label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"><span className={`grid size-6 place-items-center rounded-full ${complete ? "bg-emerald-100 text-emerald-700" : index === 3 && !finished ? "animate-pulse bg-blue-100 text-[#153E90]" : "bg-slate-200 text-slate-500"}`}>{complete ? "✓" : "·"}</span>{label}</div>)}</div><div className="grid grid-cols-2 gap-3"><Metric label="Successful" value={String(successful)} colour="text-emerald-700"/><Metric label="Failed" value={String(state.failed.length)} colour="text-rose-700"/></div>{state.failed.length ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{state.failed[0].message}{state.failed.length > 1 ? ` · ${state.failed.length - 1} more` : ""}</p> : null}</div><footer className="flex justify-end gap-3 border-t border-slate-100 px-7 py-5">{finished && state.failed.length ? <KairoButton type="button" disabled={busy} onClick={onRetry}>Retry Failed Emails</KairoButton> : null}<KairoButton type="button" variant="secondary" disabled={!finished || busy} onClick={onClose}>Close</KairoButton></footer></section></div>;
}

function BankExportDialog({ run, bank, busy, error, onClose, onGenerate }: { run: PayrollRun; bank: CompanyPayrollBankDetails; busy: boolean; error: string; onClose: () => void; onGenerate: () => Promise<void> }) {
  const summary = bankTransferSummary(run, bank);
  const displayDate = new Date(`${run.processing_date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
  const details = [
    ["Payroll Month", payrollMonthLabel(run.payroll_month)],
    ["Salary Processing Date", displayDate],
    ["Employees", String(summary.employeeCount)],
    ["Total Transfer", money(summary.total)],
    ["Debit Account", summary.maskedDebitAccount],
    ["Branch Code", bank.payroll_bank_branch_code || "-"],
    ["Customer ID", bank.payroll_bank_customer_id || "-"],
  ];
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-5"><section role="dialog" aria-modal="true" aria-labelledby="bank-export-title" className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl"><header className="bg-gradient-to-r from-[#0F172A] via-[#153E90] to-[#155E75] px-7 py-6 text-white"><p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-200">Secure payroll export</p><h2 id="bank-export-title" className="mt-2 text-2xl font-bold">Generate Bank Transfer TXT</h2><p className="mt-2 text-sm text-blue-100">Confirm the approved payroll and debit-account summary before download.</p></header><div className="grid gap-3 p-7 sm:grid-cols-2">{details.map(([label,value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">{label}</p><p className="mt-1 font-bold text-slate-900">{value}</p></div>)}</div>{error ? <p role="alert" className="mx-7 mb-5 whitespace-pre-line rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}<footer className="flex justify-end gap-3 border-t border-slate-100 px-7 py-5"><KairoButton type="button" variant="secondary" disabled={busy} onClick={onClose}>Cancel</KairoButton><KairoButton type="button" disabled={busy} onClick={() => void onGenerate()}>{busy ? "Generating..." : "Generate TXT File"}</KairoButton></footer></section></div>;
}

function SalaryRegister({ run, bankDetails, editable, onEdit }: { run: PayrollRun; bankDetails: EmployeeBankDetails[]; editable: boolean; onEdit: (entry: PayrollEntry) => void }) {
  const detailsByEmployee = useMemo(() => employeeBankDetailsMap(bankDetails), [bankDetails]);
  const submitted = run.status === "published";
  const headers = [...salaryRegisterHeaders, ...(editable || submitted ? ["Actions"] : [])];
  const [actionId, setActionId] = useState("");
  async function payslipAction(entry: PayrollEntry, action: "download" | "resend" | "regenerate") { if (actionId) return; setActionId(`${entry.id}:${action}`); try { if (action === "download") await downloadPayslip(entry.id, payslipFilename(entry.employee_code, entry.payroll_month)); else await processPayslipDistribution(entry.id, action); } finally { setActionId(""); } }
  return <Card><div className="border-b border-slate-100 bg-gradient-to-r from-blue-50/70 via-white to-cyan-50/50 px-6 py-5"><h2 className="text-xl font-bold">Salary Register</h2><p className="mt-1 text-sm text-slate-500">Payroll snapshot for {payrollMonthLabel(run.payroll_month)}.</p></div><div className="overflow-x-auto"><table className="min-w-[1750px] text-sm"><thead className="bg-[#0F172A] text-left text-xs uppercase text-slate-300"><tr>{headers.map((header) => <th key={header} className="px-4 py-4">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{run.entries?.map((entry) => { const bank = detailsByEmployee.get(entry.employee_id); return <tr key={entry.id} className="hover:bg-blue-50/40"><td className="px-4 py-4 font-bold text-[#153E90]">{entry.employee_code}</td><td className="px-4 py-4 font-bold">{stripEmployeeTitle(entry.employee_name)}</td><td className="px-4 py-4">{bank?.bank_name || "-"}</td><td className="px-4 py-4 font-mono">{bank?.ifsc_code || "-"}</td><td className="px-4 py-4 font-mono">{bank?.bank_account_number || "-"}</td><td className="px-4 py-4">{money(entry.bonus)}</td><td className="px-4 py-4">{money(entry.leave_encashment)}</td><td className="px-4 py-4">{money(salaryRegisterGrossPay(entry))}</td><td className="px-4 py-4">{money(entry.professional_tax)}</td><td className="px-4 py-4" title={`Recommended ${money(entry.lop_recommended)}`}>{money(entry.lop_deduction)}</td><td className="px-4 py-4">{money(entry.previous_month_adjustment)}</td><td className="px-4 py-4">{money(entry.tds)}</td><td className="px-4 py-4 font-bold text-[#153E90]">{money(entry.net_salary)}</td>{editable ? <td className="px-4 py-4"><button type="button" onClick={() => onEdit(entry)} className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-[#153E90]">Edit</button></td> : submitted ? <td className="px-4 py-4"><div className="flex flex-wrap gap-2"><button disabled={Boolean(actionId)} onClick={() => void payslipAction(entry,"download")} className="rounded-full bg-[#153E90] px-3 py-2 text-xs font-bold text-white">Download Payslip</button><button disabled={Boolean(actionId)} onClick={() => void payslipAction(entry,"resend")} className="rounded-full bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Resend Email</button><button disabled={Boolean(actionId)} onClick={() => void payslipAction(entry,"regenerate")} className="rounded-full bg-violet-700 px-3 py-2 text-xs font-bold text-white">Regenerate Payslip</button></div></td> : null}</tr>; })}</tbody></table></div></Card>;
}

type ReportFilters = { financialYear: string; fromMonth: string; toMonth: string; employeeId: string };
const defaultReportFilters = (): ReportFilters => { const year = currentFinancialYear(); const date = new Date(); const current = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; const month = year.months.includes(current) ? current : year.months[0]; return { financialYear: year.value, fromMonth: month, toMonth: month, employeeId: "all" }; };

export function PayrollReports({ data }: { data: PayrollData }) {
  const years = useMemo(() => financialYearOptions((data.runs || []).map((run) => run.payroll_month)), [data.runs]);
  const [filters, setFilters] = useState(defaultReportFilters);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const financialYear = financialYearFromValue(filters.financialYear) || currentFinancialYear();
  const entries = useMemo(() => (data.runs || []).flatMap((run) => run.entries || []).filter((entry) => entry.status === "published" && entry.payroll_month.slice(0, 7) >= filters.fromMonth && entry.payroll_month.slice(0, 7) <= filters.toMonth && (filters.employeeId === "all" || entry.employee_id === filters.employeeId)), [data.runs, filters.employeeId, filters.fromMonth, filters.toMonth]);

  function updateYear(value: string) { const year = financialYearFromValue(value); if (year) setFilters((current) => ({ ...current, financialYear: value, fromMonth: year.months[0], toMonth: year.months.at(-1)! })); }
  function reset() { setFilters(defaultReportFilters()); setError(""); }
  async function perform(name: string, operation: () => Promise<void>) { if (busy) return; setBusy(name); setError(""); try { await operation(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to download payroll report"); } finally { setBusy(""); } }
  async function payslips() { for (const entry of entries) await downloadPayslip(entry.id, payslipFilename(entry.employee_code, entry.payroll_month)); }
  async function ytd() { const employeeIds = filters.employeeId === "all" ? [...new Set(entries.map((entry) => entry.employee_id))] : [filters.employeeId]; for (const employeeId of employeeIds) await downloadPayrollYtd(filters.financialYear, { employeeId, fromMonth: filters.fromMonth, toMonth: filters.toMonth }); }
  async function distribute(action: "resend" | "regenerate") { for (const entry of entries) await processPayslipDistribution(entry.id, action); }

  return <div className="space-y-5">
    <Card><div className="border-b border-slate-100 bg-gradient-to-r from-blue-50/70 via-white to-cyan-50/50 px-6 py-5"><h2 className="text-xl font-bold">Employee Payroll</h2><p className="mt-1 text-sm text-slate-500">Download submitted payslips or a YTD statement for a selected financial-year range.</p></div><div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4"><Select label="Financial Year" value={filters.financialYear} onChange={updateYear} options={years.map((year) => [year.value, year.label])}/><Select label="From Month" value={filters.fromMonth} onChange={(value) => setFilters((current) => ({ ...current, fromMonth: value }))} options={financialYear.months.map((month) => [month, payrollMonthLabel(month)])}/><Select label="To Month" value={filters.toMonth} onChange={(value) => setFilters((current) => ({ ...current, toMonth: value }))} options={financialYear.months.map((month) => [month, payrollMonthLabel(month)])}/><Select label="Employee" value={filters.employeeId} onChange={(value) => setFilters((current) => ({ ...current, employeeId: value }))} options={[["all", "All Employees"], ...(data.employees || []).map((employee) => [employee.id, `${employee.employee_code} · ${employee.name}`])]}/></div><div className="flex flex-wrap gap-3 border-t border-slate-100 px-6 py-5"><KairoButton type="button" disabled={!entries.length || Boolean(busy) || filters.fromMonth > filters.toMonth} onClick={() => void perform("payslips", payslips)}>{busy === "payslips" ? "Downloading..." : "Download Payslip"}</KairoButton><KairoButton type="button" disabled={!entries.length || Boolean(busy) || filters.fromMonth > filters.toMonth} onClick={() => void perform("ytd", ytd)}>{busy === "ytd" ? "Downloading..." : "Download YTD"}</KairoButton>{filters.employeeId !== "all" ? <><KairoButton type="button" disabled={!entries.length || Boolean(busy)} onClick={() => void perform("resend", () => distribute("resend"))}>{busy === "resend" ? "Sending..." : "Resend Email"}</KairoButton><KairoButton type="button" disabled={!entries.length || Boolean(busy)} onClick={() => void perform("regenerate", () => distribute("regenerate"))}>{busy === "regenerate" ? "Regenerating..." : "Regenerate Payslip"}</KairoButton></> : null}<KairoButton type="button" variant="secondary" disabled={Boolean(busy)} onClick={reset}>Reset</KairoButton><span className="self-center text-sm text-slate-500">{entries.length} submitted payroll records</span></div>{error ? <p role="alert" className="mx-6 mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}</Card>
    {data.role === "finance admin" ? <PayrollSummaryReport filters={filters} years={years.map((year) => [year.value, year.label])} busy={busy} perform={perform} /> : null}
  </div>;
}

function PayrollSummaryReport({ filters, years, busy, perform }: { filters: ReportFilters; years: string[][]; busy: string; perform: (name: string, operation: () => Promise<void>) => Promise<void> }) {
  const [summary, setSummary] = useState({ financialYear: filters.financialYear, fromMonth: filters.fromMonth, toMonth: filters.toMonth });
  const year = financialYearFromValue(summary.financialYear) || currentFinancialYear();
  function updateYear(value: string) { const next = financialYearFromValue(value); if (next) setSummary({ financialYear: value, fromMonth: next.months[0], toMonth: next.months.at(-1)! }); }
  return <Card><div className="border-b border-slate-100 bg-gradient-to-r from-blue-50/70 via-white to-cyan-50/50 px-6 py-5"><h2 className="text-xl font-bold">Payroll Summary</h2><p className="mt-1 text-sm text-slate-500">Finance-only aggregate payroll reporting.</p></div><div className="grid gap-4 p-6 md:grid-cols-3"><Select label="Financial Year" value={summary.financialYear} onChange={updateYear} options={years}/><Select label="From Month" value={summary.fromMonth} onChange={(value) => setSummary((current) => ({ ...current, fromMonth: value }))} options={year.months.map((month) => [month, payrollMonthLabel(month)])}/><Select label="To Month" value={summary.toMonth} onChange={(value) => setSummary((current) => ({ ...current, toMonth: value }))} options={year.months.map((month) => [month, payrollMonthLabel(month)])}/></div><div className="flex gap-3 border-t border-slate-100 px-6 py-5"><KairoButton type="button" disabled={Boolean(busy) || summary.fromMonth > summary.toMonth} onClick={() => void perform("summary-xlsx", () => downloadPayrollSummary(summary.financialYear, summary.fromMonth, summary.toMonth, "xlsx"))}>{busy === "summary-xlsx" ? "Downloading..." : "Download Excel"}</KairoButton><KairoButton type="button" disabled={Boolean(busy) || summary.fromMonth > summary.toMonth} onClick={() => void perform("summary-pdf", () => downloadPayrollSummary(summary.financialYear, summary.fromMonth, summary.toMonth, "pdf"))}>{busy === "summary-pdf" ? "Downloading..." : "Download PDF"}</KairoButton></div></Card>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <label className="text-sm font-bold text-slate-700">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}
