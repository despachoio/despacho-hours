"use client";

import { useMemo, useState } from "react";
import KairoButton from "@/components/ui/KairoButton";
import { downloadBankTransfer, downloadPayrollSummary, downloadPayrollYtd, downloadPayslip } from "@/lib/payroll/client";
import { currentFinancialYear, financialYearFromValue, financialYearOptions } from "@/lib/payroll/financialYear";
import {
  buildBankTransferFile,
  bankTransferSummary,
  employeeBankDetailsMap,
  salaryRegisterGrossPay,
  salaryRegisterHeaders,
  salaryRegisterRows,
  stripEmployeeTitle,
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
type Action = (payload: Record<string, unknown>) => Promise<void>;

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

export function PayrollProcessing({ data, month, setMonth, onAction, onEdit }: { data: PayrollData; month: string; setMonth: (value: string) => void; onAction: Action; onEdit: (entry: PayrollEntry) => void }) {
  const run = data.selectedRun || null;
  const [busy, setBusy] = useState("");
  const [processingDate, setProcessingDate] = useState(run?.processing_date || localDateValue());
  const [exportError, setExportError] = useState("");
  const [confirmingBankExport, setConfirmingBankExport] = useState(false);

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

  const lifecycle = run ? payrollLifecycleStatus(run.status) : null;
  return <div className="space-y-5">
    <Card className="p-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="w-52 text-sm font-bold">Payroll Month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className={fieldClass} /></label>
        <label className="w-56 text-sm font-bold">Payroll Processing Date<input type="date" required disabled={Boolean(run)} value={processingDate} onChange={(event) => setProcessingDate(event.target.value)} className={`${fieldClass} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`} /></label>
        {!run ? <KairoButton type="button" disabled={Boolean(busy) || !processingDate} onClick={() => void execute("generate", { action: "generate", payrollMonth: month, processingDate })}>{busy === "generate" ? "Generating..." : "Generate Payroll"}</KairoButton> : null}
        {run && canEditPayroll(run.status) ? <KairoButton type="button" disabled={Boolean(busy)} onClick={() => void execute("reprocess", { action: "reprocess", payrollMonth: month })}>{busy === "reprocess" ? "Reprocessing..." : "Reprocess Payroll"}</KairoButton> : null}
        {run && canApprovePayroll(run.status) ? <KairoButton type="button" disabled={Boolean(busy)} onClick={() => void execute("approve", { action: "approve", runId: run.id })}>{busy === "approve" ? "Approving..." : "Approve Payroll"}</KairoButton> : null}
        {run && canSubmitPayroll(run.status) ? <KairoButton type="button" disabled={Boolean(busy)} onClick={() => void execute("submit", { action: "submit", runId: run.id })}>{busy === "submit" ? "Submitting..." : "Submit Payroll"}</KairoButton> : null}
        {run ? <KairoButton type="button" variant="danger" disabled={Boolean(busy)} onClick={() => void cancel()}>{busy === "cancel" ? "Cancelling..." : "Cancel Payroll"}</KairoButton> : null}
        {run && canExportPayroll(run.status) ? <div className="ml-auto flex flex-wrap gap-3"><KairoButton type="button" disabled={Boolean(busy)} onClick={() => void downloadSalaryRegister(run, data.bankDetails || [])}>Download Salary Register</KairoButton>{data.role === "finance admin" ? <KairoButton type="button" variant="secondary" disabled={Boolean(busy)} onClick={exportBankFile}>Export Bank Transfer File</KairoButton> : null}</div> : null}
      </div>
      {exportError && !confirmingBankExport ? <p role="alert" className="mt-4 whitespace-pre-line rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{exportError}</p> : null}
    </Card>
    {run ? <>
      <div className="grid gap-3 md:grid-cols-3"><Metric label="Employees Processed" value={String(run.employee_count)} colour="text-[#153E90]"/><Metric label="Net Payroll" value={money(run.net_payroll)} colour="text-emerald-700"/><Metric label="Status" value={lifecycle || "Generated"} colour="text-violet-700"/></div>
      <SalaryRegister run={run} bankDetails={data.bankDetails || []} editable={canEditPayroll(run.status)} onEdit={onEdit} />
    </> : null}
    {run && confirmingBankExport ? <BankExportDialog run={run} bank={data.companyBankDetails!} busy={busy === "bank-export"} error={exportError} onClose={() => { setConfirmingBankExport(false); setExportError(""); }} onGenerate={async () => { setBusy("bank-export"); setExportError(""); try { await downloadBankTransfer(run.id); setConfirmingBankExport(false); } catch (cause) { setExportError(cause instanceof Error ? cause.message : "Unable to create the bank transfer file."); } finally { setBusy(""); } }} /> : null}
  </div>;
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
  const headers = [...salaryRegisterHeaders, ...(editable ? ["Actions"] : [])];
  return <Card><div className="border-b border-slate-100 bg-gradient-to-r from-blue-50/70 via-white to-cyan-50/50 px-6 py-5"><h2 className="text-xl font-bold">Salary Register</h2><p className="mt-1 text-sm text-slate-500">Payroll snapshot for {payrollMonthLabel(run.payroll_month)}.</p></div><div className="overflow-x-auto"><table className="min-w-[1750px] text-sm"><thead className="bg-[#0F172A] text-left text-xs uppercase text-slate-300"><tr>{headers.map((header) => <th key={header} className="px-4 py-4">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{run.entries?.map((entry) => { const bank = detailsByEmployee.get(entry.employee_id); return <tr key={entry.id} className="hover:bg-blue-50/40"><td className="px-4 py-4 font-bold text-[#153E90]">{entry.employee_code}</td><td className="px-4 py-4 font-bold">{stripEmployeeTitle(entry.employee_name)}</td><td className="px-4 py-4">{bank?.bank_name || "-"}</td><td className="px-4 py-4 font-mono">{bank?.ifsc_code || "-"}</td><td className="px-4 py-4 font-mono">{bank?.bank_account_number || "-"}</td><td className="px-4 py-4">{money(entry.bonus)}</td><td className="px-4 py-4">{money(entry.leave_encashment)}</td><td className="px-4 py-4">{money(salaryRegisterGrossPay(entry))}</td><td className="px-4 py-4">{money(entry.professional_tax)}</td><td className="px-4 py-4" title={`Recommended ${money(entry.lop_recommended)}`}>{money(entry.lop_deduction)}</td><td className="px-4 py-4">{money(entry.previous_month_adjustment)}</td><td className="px-4 py-4">{money(entry.tds)}</td><td className="px-4 py-4 font-bold text-[#153E90]">{money(entry.net_salary)}</td>{editable ? <td className="px-4 py-4"><button type="button" onClick={() => onEdit(entry)} className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-[#153E90] transition hover:border-[#153E90] hover:bg-[#153E90] hover:text-white">Edit</button></td> : null}</tr>; })}</tbody></table></div></Card>;
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
