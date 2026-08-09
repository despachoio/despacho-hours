"use client";

import { useMemo, useState } from "react";
import KairoButton from "@/components/ui/KairoButton";
import { downloadPayrollSummary, downloadPayrollYtd, downloadPayslip } from "@/lib/payroll/client";
import { currentFinancialYear, financialYearFromValue, financialYearOptions } from "@/lib/payroll/financialYear";
import { salaryRegisterHeaders, salaryRegisterRows } from "@/lib/payroll/exports";
import { canApprovePayroll, canEditPayroll, canExportPayroll, canSubmitPayroll, payrollLifecycleStatus } from "@/lib/payroll/lifecycle";
import { payrollMonthLabel, payslipFilename } from "@/lib/payroll/filenames";
import { PAYROLL_LABELS } from "@/lib/payroll/labels";
import type { PayrollEntry, PayrollRun } from "@/lib/payroll/types";

type Employee = { id: string; employee_code: string; name: string };
type PayrollData = { role: string; runs?: PayrollRun[]; employees?: Employee[]; selectedRun?: PayrollRun | null; bankDetails?: Array<Record<string, unknown>> };
type Action = (payload: Record<string, unknown>) => Promise<void>;

const money = (value: number) => `₹${Math.round(Number(value || 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <section className={`relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_45px_-32px_rgba(15,23,42,.35)] ${className}`}>{children}</section>;
const fieldClass = "mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none transition focus:border-[#153E90] focus:ring-2 focus:ring-blue-100";

function Metric({ label, value, colour }: { label: string; value: string; colour: string }) {
  return <Card className="p-6"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">{label}</p><p className={`mt-4 text-2xl font-bold capitalize ${colour}`}>{value}</p></Card>;
}

function saveBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function downloadSalaryRegister(run: PayrollRun) {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet([salaryRegisterHeaders, ...salaryRegisterRows(run)]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Salary Register");
  XLSX.writeFile(book, `Salary_Register_${run.payroll_month.slice(0, 7)}.xlsx`);
}

function downloadBankFile(run: PayrollRun, bankDetails: Array<Record<string, unknown>>) {
  const details = new Map(bankDetails.map((row) => [String(row.employee_id), row]));
  const rows = (run.entries || []).map((entry) => {
    const bank = details.get(entry.employee_id) || {};
    return [entry.employee_code, entry.employee_name, bank.bank_account_number || "", bank.ifsc_code || "", entry.net_salary].join("\t");
  });
  const content = [["Employee Code", "Beneficiary", "Account Number", "IFSC", "Amount"].join("\t"), ...rows].join("\n");
  saveBlob(new Blob([content], { type: "text/plain;charset=utf-8" }), `Bank_Transfer_${run.payroll_month.slice(0, 7)}.txt`);
}

export function PayrollProcessing({ data, month, setMonth, onAction, onEdit }: { data: PayrollData; month: string; setMonth: (value: string) => void; onAction: Action; onEdit: (entry: PayrollEntry) => void }) {
  const run = data.selectedRun || null;
  const [busy, setBusy] = useState("");

  async function execute(name: string, payload: Record<string, unknown>) {
    if (busy) return;
    setBusy(name);
    try { await onAction(payload); } finally { setBusy(""); }
  }

  async function cancel() {
    if (!run) return;
    const reason = window.prompt("Reason for cancelling payroll");
    if (!reason?.trim()) return;
    await execute("cancel", { action: "cancel", runId: run.id, reason });
  }

  const lifecycle = run ? payrollLifecycleStatus(run.status) : null;
  return <div className="space-y-5">
    <Card className="p-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="w-52 text-sm font-bold">Payroll Month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className={fieldClass} /></label>
        {!run ? <KairoButton type="button" disabled={Boolean(busy)} onClick={() => void execute("generate", { action: "generate", payrollMonth: month })}>{busy === "generate" ? "Generating..." : "Generate Payroll"}</KairoButton> : null}
        {run && canEditPayroll(run.status) ? <KairoButton type="button" disabled={Boolean(busy)} onClick={() => void execute("reprocess", { action: "reprocess", payrollMonth: month })}>{busy === "reprocess" ? "Reprocessing..." : "Reprocess Payroll"}</KairoButton> : null}
        {run && canApprovePayroll(run.status) ? <KairoButton type="button" disabled={Boolean(busy)} onClick={() => void execute("approve", { action: "approve", runId: run.id })}>{busy === "approve" ? "Approving..." : "Approve Payroll"}</KairoButton> : null}
        {run && canSubmitPayroll(run.status) ? <KairoButton type="button" disabled={Boolean(busy)} onClick={() => void execute("submit", { action: "submit", runId: run.id })}>{busy === "submit" ? "Submitting..." : "Submit Payroll"}</KairoButton> : null}
        {run ? <KairoButton type="button" variant="danger" disabled={Boolean(busy)} onClick={() => void cancel()}>{busy === "cancel" ? "Cancelling..." : "Cancel Payroll"}</KairoButton> : null}
        {run && canExportPayroll(run.status) ? <div className="ml-auto flex flex-wrap gap-3"><KairoButton type="button" disabled={Boolean(busy)} onClick={() => void downloadSalaryRegister(run)}>Download Salary Register</KairoButton><KairoButton type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => downloadBankFile(run, data.bankDetails || [])}>Export Bank Transfer File</KairoButton></div> : null}
      </div>
    </Card>
    {run ? <>
      <div className="grid gap-4 md:grid-cols-4"><Metric label="Employees Processed" value={String(run.employee_count)} colour="text-[#153E90]"/><Metric label="Gross Payroll" value={money(run.gross_payroll)} colour="text-emerald-700"/><Metric label="Net Payroll" value={money(run.net_payroll)} colour="text-blue-700"/><Metric label="Status" value={lifecycle || "Generated"} colour="text-violet-700"/></div>
      <SalaryRegister run={run} editable={canEditPayroll(run.status)} onEdit={onEdit} />
    </> : null}
  </div>;
}

function SalaryRegister({ run, editable, onEdit }: { run: PayrollRun; editable: boolean; onEdit: (entry: PayrollEntry) => void }) {
  const headers = ["Employee Code", "Employee Name", "Department", "Bonus", "Leave Encashment", "Gross Pay", "PT", PAYROLL_LABELS.lop, "Previous Month Adjustment", PAYROLL_LABELS.tds, "Net Pay", ...(editable ? ["Actions"] : [])];
  return <Card><div className="border-b border-slate-100 bg-gradient-to-r from-blue-50/70 via-white to-cyan-50/50 px-6 py-5"><h2 className="text-xl font-bold">Salary Register</h2><p className="mt-1 text-sm text-slate-500">Payroll snapshot for {payrollMonthLabel(run.payroll_month)}.</p></div><div className="overflow-x-auto"><table className="min-w-[1350px] text-sm"><thead className="bg-[#0F172A] text-left text-xs uppercase text-slate-300"><tr>{headers.map((header) => <th key={header} className="px-4 py-4">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{run.entries?.map((entry) => <tr key={entry.id} className="hover:bg-blue-50/40"><td className="px-4 py-4 font-bold text-[#153E90]">{entry.employee_code}</td><td className="px-4 py-4 font-bold">{entry.employee_name}</td><td className="px-4 py-4">{entry.department || "-"}</td><td className="px-4 py-4">{money(entry.bonus)}</td><td className="px-4 py-4">{money(entry.leave_encashment)}</td><td className="px-4 py-4">{money(entry.gross_salary)}</td><td className="px-4 py-4">{money(entry.professional_tax)}</td><td className="px-4 py-4" title={`Recommended ${money(entry.lop_recommended)}`}>{money(entry.lop_deduction)}</td><td className="px-4 py-4">{money(entry.previous_month_adjustment)}</td><td className="px-4 py-4">{money(entry.tds)}</td><td className="px-4 py-4 font-bold text-[#153E90]">{money(entry.net_salary)}</td>{editable ? <td className="px-4 py-4"><button type="button" onClick={() => onEdit(entry)} className="font-bold text-[#153E90] hover:underline">Edit</button></td> : null}</tr>)}</tbody></table></div></Card>;
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

  return <div className="space-y-5">
    <Card><div className="border-b border-slate-100 bg-gradient-to-r from-blue-50/70 via-white to-cyan-50/50 px-6 py-5"><h2 className="text-xl font-bold">Employee Payroll</h2><p className="mt-1 text-sm text-slate-500">Download submitted payslips or a YTD statement for a selected financial-year range.</p></div><div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4"><Select label="Financial Year" value={filters.financialYear} onChange={updateYear} options={years.map((year) => [year.value, year.label])}/><Select label="From Month" value={filters.fromMonth} onChange={(value) => setFilters((current) => ({ ...current, fromMonth: value }))} options={financialYear.months.map((month) => [month, payrollMonthLabel(month)])}/><Select label="To Month" value={filters.toMonth} onChange={(value) => setFilters((current) => ({ ...current, toMonth: value }))} options={financialYear.months.map((month) => [month, payrollMonthLabel(month)])}/><Select label="Employee" value={filters.employeeId} onChange={(value) => setFilters((current) => ({ ...current, employeeId: value }))} options={[["all", "All Employees"], ...(data.employees || []).map((employee) => [employee.id, `${employee.employee_code} · ${employee.name}`])]}/></div><div className="flex flex-wrap gap-3 border-t border-slate-100 px-6 py-5"><KairoButton type="button" disabled={!entries.length || Boolean(busy) || filters.fromMonth > filters.toMonth} onClick={() => void perform("payslips", payslips)}>{busy === "payslips" ? "Downloading..." : "Download Payslip"}</KairoButton><KairoButton type="button" disabled={!entries.length || Boolean(busy) || filters.fromMonth > filters.toMonth} onClick={() => void perform("ytd", ytd)}>{busy === "ytd" ? "Downloading..." : "Download YTD"}</KairoButton><KairoButton type="button" variant="secondary" disabled={Boolean(busy)} onClick={reset}>Reset</KairoButton><span className="self-center text-sm text-slate-500">{entries.length} submitted payroll records</span></div>{error ? <p role="alert" className="mx-6 mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}</Card>
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
