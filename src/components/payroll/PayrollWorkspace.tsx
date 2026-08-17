"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import KairoButton from "@/components/ui/KairoButton";
import { downloadPayrollYtd, downloadPayslip, payrollRequest } from "@/lib/payroll/client";
import { currentFinancialYear, financialYearFromValue, financialYearOptions, isInFinancialYear } from "@/lib/payroll/financialYear";
import { payrollMonthLabel, payslipFilename } from "@/lib/payroll/filenames";
import { MANUAL_PAYROLL_FIELDS, type ManualPayrollField } from "@/lib/payroll/labels";
import { normalizePayrollNumber } from "@/lib/payroll/numbers";
import { payrollPfAmounts, salaryRegisterGrossPay } from "@/lib/payroll/exports";
import { isFinanceAdminRole } from "@/lib/roles";
import type { CompanyPayrollBankDetails, EmployeeBankDetails, PayrollEntry, PayrollRun, PayrollSettings, RecurringPayrollAdjustment, SalaryStructure } from "@/lib/payroll/types";
import { PayrollProcessing, PayrollReports } from "@/components/payroll/PayrollAdministration";
import SalaryStructures from "@/components/payroll/SalaryStructures";
import RecurringAdjustments from "@/components/payroll/RecurringAdjustments";
import PayrollPolicy from "@/components/payroll/PayrollPolicy";

type Employee = { id: string; employee_code: string; name: string; title: string | null; department: string | null };
type PayrollData = { role: string; ownEntries: PayrollEntry[]; runs?: PayrollRun[]; structures?: SalaryStructure[]; recurringAdjustments?: RecurringPayrollAdjustment[]; settings?: PayrollSettings; employees?: Employee[]; selectedRun?: PayrollRun | null; bankDetails?: EmployeeBankDetails[]; companyBankDetails?: CompanyPayrollBankDetails; audit?: Array<Record<string, unknown>> };
type Tab = "overview" | "history" | "policy" | "administration";
type AdministrationTab = "dashboard" | "structures" | "recurring" | "process" | "reports" | "settings";
const employeeTabs: Array<[Exclude<Tab, "administration">, string]> = [["overview", "My Payroll"], ["history", "Payroll History"], ["policy", "Policies"]];
const administrationTabs: Array<[AdministrationTab, string]> = [["dashboard", "Payroll Dashboard"], ["structures", "Salary Structures"], ["recurring", "Recurring Adjustments"], ["process", "Payroll Processing"], ["reports", "Reports"], ["settings", "Settings"]];
const money = (value: number) => `₹${Math.round(Number(value || 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const fieldClass = "mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none transition focus:border-[#153E90] focus:ring-2 focus:ring-blue-100";
const monthValue = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; };
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <section className={`relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_45px_-32px_rgba(15,23,42,.35)] ${className}`}>{children}</section>;

export default function PayrollWorkspace() {
  const [data, setData] = useState<PayrollData | null>(null); const [month, setMonth] = useState(monthValue()); const [tab, setTab] = useState<Tab>("overview"); const [administrationTab, setAdministrationTab] = useState<AdministrationTab>("dashboard"); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [editing, setEditing] = useState<PayrollEntry | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(""); try { setData(await payrollRequest<PayrollData>(`/api/payroll?month=${month}`)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load Payroll"); } finally { setLoading(false); } }, [month]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const administrationAccess = isFinanceAdminRole(data?.role);
  const salaryStructureAccess = isFinanceAdminRole(data?.role);
  async function action(payload: Record<string, unknown>, refresh = true) { setMessage(""); setError(""); try { await payrollRequest("/api/payroll", { method: "POST", body: JSON.stringify(payload) }); setMessage("Payroll updated successfully."); if (refresh) await load(); return true; } catch (cause) { setError(cause instanceof Error ? cause.message : "Payroll action failed"); return false; } }
  const latest = data?.ownEntries?.[0];
  return <div className="space-y-7">
    <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#0F172A] via-[#172554] to-[#153E90] px-8 py-10 text-white shadow-xl"><div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" /><p className="text-xs font-bold uppercase tracking-[.24em] text-cyan-200">Finance &amp; compensation</p><h1 className="mt-2 text-4xl font-bold tracking-tight lg:text-5xl">Payroll</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">Secure salary slips, payroll snapshots, statutory deductions, and controlled month-end processing.</p><span className="mt-5 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">{administrationAccess ? "Payroll administration workspace" : "Employee self-service"}</span></header>
    <nav aria-label="Payroll sections" className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      {employeeTabs.map(([value,label]) => <button key={value} onClick={() => setTab(value)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${tab === value ? "bg-[#153E90] text-white shadow" : "text-slate-500 hover:bg-slate-100"}`}>{label}</button>)}
      {administrationAccess ? <button onClick={() => setTab("administration")} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${tab === "administration" ? "bg-[#153E90] text-white shadow" : "text-slate-500 hover:bg-slate-100"}`}>Administration</button> : null}
    </nav>
    {error ? <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700">{error}</p> : null}{message ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 font-semibold text-emerald-700">{message}</p> : null}
    {loading ? <div className="grid gap-4 md:grid-cols-3">{[1,2,3].map((item) => <div key={item} className="h-36 animate-pulse rounded-3xl bg-slate-200" />)}</div> : !data ? null : <>
      {tab === "overview" ? <EmployeeOverview entry={latest} entries={data.ownEntries} /> : null}
      {tab === "history" ? <PayrollHistory entries={data.ownEntries} /> : null}
      {tab === "policy" ? <PayrollPolicy /> : null}
      {tab === "administration" && administrationAccess ? <div className="space-y-5">
        <nav aria-label="Payroll administration sections" className="flex gap-2 overflow-x-auto rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/90 via-white to-cyan-50/70 p-2 shadow-sm">
          {administrationTabs.filter(([value]) => value !== "structures" || salaryStructureAccess).map(([value, label]) => <button key={value} onClick={() => setAdministrationTab(value)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${administrationTab === value ? "bg-[#0F172A] text-white shadow" : "text-slate-600 hover:bg-white hover:text-[#153E90]"}`}>{label}</button>)}
        </nav>
        {administrationTab === "dashboard" ? <FinanceDashboard data={data} onViewProcessing={() => setAdministrationTab("process")} /> : null}
        {administrationTab === "structures" && salaryStructureAccess ? <SalaryStructures data={data} onRefresh={load} /> : null}
        {administrationTab === "recurring" && salaryStructureAccess ? <RecurringAdjustments role={data.role} employees={data.employees || []} adjustments={data.recurringAdjustments || []} onRefresh={load} /> : null}
        {administrationTab === "process" ? <PayrollProcessing key={`${month}:${data.selectedRun?.id || "new"}`} data={data} month={month} setMonth={setMonth} onAction={action} onRefresh={load} onEdit={setEditing} /> : null}
        {administrationTab === "reports" ? <PayrollReports data={data} /> : null}
        {administrationTab === "settings" && data.settings ? <Settings value={data.settings} bankDetails={data.companyBankDetails} financeAccess={salaryStructureAccess} onSave={action} /> : null}
      </div> : null}
    </>}
    {editing ? <EntryDialog key={editing.id} entry={editing} onClose={() => setEditing(null)} onSave={async (payload) => { await action(payload); setEditing(null); }} /> : null}
  </div>;
}

function EmployeeOverview({
  entry,
  entries,
}: {
  entry?: PayrollEntry;
  entries: PayrollEntry[];
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const financialYear = currentFinancialYear();

  const ytd = entries
    .filter((item) =>
      isInFinancialYear(item.payroll_month, financialYear.value),
    )
    .reduce(
      (sum, item) => ({
        earnings: sum.earnings + Number(item.total_earnings),
        deductions: sum.deductions + Number(item.total_deductions),
        net: sum.net + Number(item.net_salary),
      }),
      {
        earnings: 0,
        deductions: 0,
        net: 0,
      },
    );

  async function downloadLatestPayslip() {
    if (!entry || downloading) return;

    setDownloadError("");
    setDownloading(true);

    try {
      await downloadPayslip(
        entry.id,
        payslipFilename(entry.employee_code, entry.payroll_month),
      );
    } catch (cause) {
      setDownloadError(
        cause instanceof Error
          ? cause.message
          : "Unable to download payslip",
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Metric
          label={`${financialYear.label} Earnings`}
          value={money(ytd.earnings)}
          colour="text-emerald-700"
        />

        <Metric
          label={`${financialYear.label} Deductions`}
          value={money(ytd.deductions)}
          colour="text-rose-700"
        />

        <Metric
          label={`${financialYear.label} Net Pay`}
          value={money(ytd.net)}
          colour="text-[#153E90]"
        />
      </div>

      <Card className="p-7">
        {entry ? (
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Latest published salary slip
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                {payrollMonthLabel(entry.payroll_month)}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Net salary{" "}
                <strong className="text-[#153E90]">
                  {money(entry.net_salary)}
                </strong>
              </p>
            </div>

            <KairoButton
  type="button"
  disabled={downloading}
  className="!bg-[#153E90] !text-white hover:!bg-[#0F3276] disabled:!bg-slate-300 disabled:!text-slate-600 disabled:opacity-100"
  onClick={() => void downloadLatestPayslip()}
>
  {downloading ? "Downloading..." : "Download Payslip"}
</KairoButton>
          </div>
        ) : (
          <p className="py-14 text-center text-slate-400">
            No published salary slip is available yet.
          </p>
        )}

        {downloadError ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          >
            {downloadError}
          </p>
        ) : null}
      </Card>

      <Card className="p-7">
        <h2 className="text-xl font-bold">Form 16</h2>

        <p className="mt-2 text-slate-500">
          Annual Form 16 download will be available here.
        </p>

        <span className="mt-4 inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
          Coming Soon
        </span>
      </Card>
    </div>
  );
}
function Metric({ label,value,colour }: { label:string;value:string;colour:string }) { return <Card className="p-6"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">{label}</p><p className={`mt-4 text-2xl font-bold ${colour}`}>{value}</p></Card>; }
function PayrollHistory({ entries }: { entries: PayrollEntry[] }) {
  const defaultFinancialYear = useMemo(() => currentFinancialYear(), []);
  const [selectedYear, setSelectedYear] = useState("");
  const [appliedYear, setAppliedYear] = useState("");
  const [searched, setSearched] = useState(false);
  const [downloadingYtd, setDownloadingYtd] = useState(false);
  const [downloadingPayslipId, setDownloadingPayslipId] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const years = useMemo(() => financialYearOptions(entries.map((entry) => entry.payroll_month), defaultFinancialYear), [defaultFinancialYear, entries]);
  const results = useMemo(
    () => searched ? entries.filter((entry) => isInFinancialYear(entry.payroll_month, appliedYear)).sort((left, right) => left.payroll_month.localeCompare(right.payroll_month)) : [],
    [appliedYear, entries, searched],
  );

  function search() {
    if (!selectedYear) return;
    setDownloadError("");
    setAppliedYear(selectedYear);
    setSearched(true);
  }

  function reset() {
    setDownloadError("");
    setSelectedYear("");
    setAppliedYear("");
    setSearched(false);
  }

  async function downloadYtd() {
    if (!searched || !appliedYear || !results.length || downloadingYtd) return;
    setDownloadError("");
    setDownloadingYtd(true);
    try { await downloadPayrollYtd(appliedYear); }
    catch (cause) { setDownloadError(cause instanceof Error ? cause.message : "Unable to download YTD payroll report"); }
    finally { setDownloadingYtd(false); }
  }

  async function downloadHistoryPayslip(entry: PayrollEntry) {
    if (downloadingPayslipId) return;
    setDownloadError("");
    setDownloadingPayslipId(entry.id);
    try { await downloadPayslip(entry.id, payslipFilename(entry.employee_code, entry.payroll_month)); }
    catch (cause) { setDownloadError(cause instanceof Error ? cause.message : "Unable to download payslip"); }
    finally { setDownloadingPayslipId(""); }
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-blue-100 bg-gradient-to-r from-blue-50/90 via-white to-cyan-50/70 px-6 py-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#153E90]">Payroll archive</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">Find salary slips</h2>
            <p className="mt-1 text-sm text-slate-500">Choose a financial year, then search to view or export published payroll.</p>
          </div>
          <span className="rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-bold text-[#153E90] shadow-sm">{searched ? `${results.length} slips` : "Awaiting search"}</span>
        </div>
        <div className="flex flex-wrap items-end gap-3 px-6 py-5">
          <label className="w-44 text-sm font-bold text-slate-700">
            Financial Year
            <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none transition focus:border-[#153E90] focus:ring-2 focus:ring-blue-100">
              <option value="" disabled>Select Year</option>
              {years.map((year) => <option key={year.value} value={year.value}>{year.label}</option>)}
            </select>
          </label>
          <KairoButton type="button" disabled={!selectedYear} onClick={search}>Search</KairoButton>
          <KairoButton type="button" variant="secondary" onClick={reset}>Reset</KairoButton>
          <div className="ml-auto">
            <KairoButton type="button" disabled={!searched || !results.length || downloadingYtd} className="!bg-[#153E90] !text-white hover:!bg-[#0B2C68] disabled:!bg-slate-300 disabled:!text-slate-600 disabled:opacity-100" onClick={() => void downloadYtd()}>{downloadingYtd ? "Downloading..." : "Download YTD"}</KairoButton>
          </div>
        </div>
        {downloadError ? <p role="alert" className="mx-6 mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{downloadError}</p> : null}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50/70 via-white to-cyan-50/50 px-6 py-5">
          <div><h2 className="text-xl font-bold">Published Salary Slips</h2><p className="mt-1 text-sm text-slate-500">Search by financial year to view published salary slips.</p></div>
          {searched ? <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#153E90]">{financialYearFromValue(appliedYear)?.label || appliedYear} · {results.length} records</span> : null}
        </div>
        {!searched ? <Empty text="Select a financial year and click Search to view published salary slips." /> : results.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed text-sm">
              <colgroup><col className="w-[24%]" /><col className="w-[18%]" /><col className="w-[18%]" /><col className="w-[18%]" /><col className="w-[22%]" /></colgroup>
              <thead className="bg-[#153E90] text-xs uppercase tracking-wide text-white">
                <tr>
                  <th className="px-6 py-4">Month &amp; Year</th>
                  <th className="px-4 py-4 text-center">Gross Pay</th>
                  <th className="px-4 py-4 text-center">Deductions</th>
                  <th className="px-4 py-4 text-center">Net Salary</th>
                  <th className="px-6 py-4 text-center">Payslip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((entry) => (
                  <tr key={entry.id} className="bg-white transition hover:bg-blue-50/50">
                    <td className="whitespace-nowrap px-6 py-5 text-center font-bold text-slate-900">
  {payrollMonthLabel(entry.payroll_month)}
</td>
                    <td className="whitespace-nowrap px-4 py-5 text-center font-semibold text-slate-700">{money(salaryRegisterGrossPay(entry))}</td>
                    <td className="whitespace-nowrap px-4 py-5 text-center font-semibold text-rose-700">{money(entry.total_deductions)}</td>
                    <td className="whitespace-nowrap px-4 py-5 text-center font-bold text-[#153E90]">{money(entry.net_salary)}</td>
                    <td className="whitespace-nowrap px-6 py-5 text-center"><KairoButton type="button" disabled={Boolean(downloadingPayslipId)} className="!bg-[#153E90] !text-white hover:!bg-[#0B2C68] disabled:!bg-slate-300 disabled:!text-slate-600 disabled:opacity-100" onClick={() => void downloadHistoryPayslip(entry)}>{downloadingPayslipId === entry.id ? "Downloading..." : "Download PDF"}</KairoButton></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty text={`No published salary slips are available for ${financialYearFromValue(appliedYear)?.label || appliedYear}.`} />}
      </Card>
    </div>
  );
}
function Empty({text}:{text:string}) { return <p className="px-6 py-14 text-center text-sm text-slate-400">{text}</p>; }

function payrollRunBreakdown(run: PayrollRun) {
  const entries = run.entries || [];
  return entries.reduce((summary, entry) => {
    const pf = payrollPfAmounts(entry);
    return {
      employeePf: summary.employeePf + pf.employeePf,
      employerPf: summary.employerPf + pf.employerPf,
      employerEps: summary.employerEps + pf.employerEps,
      administrationCharges: summary.administrationCharges + pf.administrationCharges,
      edliCharges: summary.edliCharges + pf.edliCharges,
      totalPf: summary.totalPf + pf.totalPf,
      professionalTax: summary.professionalTax + Number(entry.professional_tax || 0),
      tds: summary.tds + Number(entry.tds || 0),
    };
  }, { employeePf: 0, employerPf: 0, employerEps: 0, administrationCharges: 0, edliCharges: 0, totalPf: 0, professionalTax: 0, tds: 0 });
}

type PayrollDashboardIconName = "calendar" | "status" | "processing-date" | "employees" | "gross" | "deductions" | "net";
type PayrollDashboardTone = "blue" | "cyan" | "emerald" | "violet" | "rose" | "amber" | "slate";

const dashboardToneClasses: Record<PayrollDashboardTone, { icon: string; value: string; accent: string }> = {
  blue: { icon: "bg-blue-50 text-[#153E90] ring-blue-100", value: "text-[#153E90]", accent: "from-[#153E90] to-blue-500" },
  cyan: { icon: "bg-cyan-50 text-cyan-700 ring-cyan-100", value: "text-cyan-800", accent: "from-cyan-600 to-sky-400" },
  emerald: { icon: "bg-emerald-50 text-emerald-700 ring-emerald-100", value: "text-emerald-800", accent: "from-emerald-600 to-teal-400" },
  violet: { icon: "bg-violet-50 text-violet-700 ring-violet-100", value: "text-violet-800", accent: "from-violet-600 to-fuchsia-400" },
  rose: { icon: "bg-rose-50 text-rose-700 ring-rose-100", value: "text-rose-800", accent: "from-rose-600 to-pink-400" },
  amber: { icon: "bg-amber-50 text-amber-700 ring-amber-100", value: "text-amber-800", accent: "from-amber-500 to-orange-400" },
  slate: { icon: "bg-slate-100 text-slate-700 ring-slate-200", value: "text-slate-900", accent: "from-slate-600 to-slate-400" },
};

function PayrollDashboardIcon({ name }: { name: PayrollDashboardIconName }) {
  const paths: Record<PayrollDashboardIconName, React.ReactNode> = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></>,
    status: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.7 2.7L16.5 9"/></>,
    "processing-date": <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M9 16l2 2 4-4"/></>,
    employees: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    gross: <><path d="M3 7h18v12H3zM3 10h18"/><path d="M7 15h4"/></>,
    deductions: <><path d="M4 7h16v12H4zM7 4h10v3"/><path d="M8 13h8M12 10v6"/></>,
    net: <><path d="M3 6h18v13H3zM3 10h18"/><path d="M7 15h2M15 15h2"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">{paths[name]}</svg>;
}

function ExecutiveMetricCard({ label, value, helper, icon, tone = "blue", badge }: { label: string; value: string; helper: string; icon: PayrollDashboardIconName; tone?: PayrollDashboardTone; badge?: { label: string; className: string } }) {
  const classes = dashboardToneClasses[tone];
  return <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_16px_35px_-28px_rgba(15,23,42,.55)] transition duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_20px_45px_-28px_rgba(21,62,144,.35)]">
    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${classes.accent}`} />
    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${classes.icon}`}><PayrollDashboardIcon name={icon}/></span>
    <p className="mt-5 text-[10px] font-bold uppercase tracking-[.17em] text-slate-400">{label}</p>
    {badge ? <span className={`mt-2 inline-flex rounded-full border px-3 py-1.5 text-sm font-bold ${badge.className}`}>{badge.label}</span> : <p className={`mt-2 break-words text-2xl font-bold tracking-tight ${classes.value}`}>{value}</p>}
    <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p>
  </article>;
}

function payrollStatusPresentation(status: PayrollRun["status"]) {
  if (status === "published") return { label: "Submitted", className: "border-emerald-200 bg-emerald-50 text-emerald-700", tone: "emerald" as const };
  if (status === "approved" || status === "locked") return { label: "Approved", className: "border-blue-200 bg-blue-50 text-[#153E90]", tone: "blue" as const };
  if (status === "under_review") return { label: "Processing", className: "border-amber-200 bg-amber-50 text-amber-700", tone: "amber" as const };
  return { label: "Generated", className: "border-slate-200 bg-slate-100 text-slate-700", tone: "slate" as const };
}

function payrollDateLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function FinanceDashboard({ data, onViewProcessing }: { data: PayrollData; onViewProcessing: () => void }) {
  const currentYear = useMemo(() => currentFinancialYear(), []);
  const years = useMemo(() => financialYearOptions((data.runs || []).map((run) => run.payroll_month), currentYear), [currentYear, data.runs]);
  const [selectedYear, setSelectedYear] = useState(currentYear.value);
  const runs = useMemo(() => (data.runs || []).filter((run) => isInFinancialYear(run.payroll_month, selectedYear)), [data.runs, selectedYear]);
  const latestRun = data.runs?.[0] || null;
  const latestBreakdown = useMemo(() => latestRun ? payrollRunBreakdown(latestRun) : null, [latestRun]);
  const totals = useMemo(() => runs.reduce((sum, run) => {
    const deductions = payrollRunBreakdown(run);
    return {
      processed: sum.processed + 1,
      net: sum.net + Number(run.net_payroll || 0),
      employeePf: sum.employeePf + deductions.employeePf,
      employerPf: sum.employerPf + deductions.employerPf,
      employerEps: sum.employerEps + deductions.employerEps,
      administrationCharges: sum.administrationCharges + deductions.administrationCharges,
      edliCharges: sum.edliCharges + deductions.edliCharges,
      totalPf: sum.totalPf + deductions.totalPf,
      professionalTax: sum.professionalTax + deductions.professionalTax,
      tds: sum.tds + deductions.tds,
    };
  }, { processed: 0, net: 0, employeePf: 0, employerPf: 0, employerEps: 0, administrationCharges: 0, edliCharges: 0, totalPf: 0, professionalTax: 0, tds: 0 }), [runs]);
  const latestStatus = latestRun ? payrollStatusPresentation(latestRun.status) : null;

  return <div className="space-y-8">
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-blue-50/80 via-white to-cyan-50/60 px-6 py-6">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#153E90]">Latest payroll snapshot</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Recently Processed Payroll</h2><p className="mt-1 text-sm text-slate-500">Summary of the latest payroll processed.</p></div>
        <KairoButton type="button" className="!bg-[#153E90] !text-white hover:!bg-[#0B2C68]" onClick={onViewProcessing}>View Payroll Processing</KairoButton>
      </div>
      {latestRun && latestBreakdown && latestStatus ? <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 xl:grid-cols-4">
        <ExecutiveMetricCard label="Payroll Month" value={payrollMonthLabel(latestRun.payroll_month)} helper="Latest payroll period" icon="calendar" tone="blue"/>
        <ExecutiveMetricCard label="Status" value={latestStatus.label} helper="Current payroll lifecycle status" icon="status" tone={latestStatus.tone} badge={{ label: latestStatus.label, className: latestStatus.className }}/>
        <ExecutiveMetricCard label="Salary Processing Date" value={payrollDateLabel(latestRun.processing_date)} helper="Scheduled bank processing date" icon="processing-date" tone="cyan"/>
        <ExecutiveMetricCard label="Employees Processed" value={String(latestRun.employee_count)} helper="Employees included in this run" icon="employees" tone="violet"/>
        <ExecutiveMetricCard label="Net Payroll" value={money(latestRun.net_payroll)} helper="Total amount payable to employees" icon="net" tone="blue"/>
        <ExecutiveMetricCard label="Total PF Amount" value={money(latestBreakdown.totalPf)} helper="Employee PF, Employer PF, Employer EPS, Admin Charges, and EDLI Charges" icon="gross" tone="emerald"/>
        <ExecutiveMetricCard label="Total TDS Amount" value={money(latestBreakdown.tds)} helper="Tax deducted at source for this run" icon="deductions" tone="rose"/>
        <ExecutiveMetricCard label="Total Professional Tax Amount" value={money(latestBreakdown.professionalTax)} helper="Professional tax for this run" icon="deductions" tone="amber"/>
      </div> : <Empty text="No payroll has been processed yet." />}
    </Card>

    <Card>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-blue-50/60 px-6 py-6">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#153E90]">Executive performance</p><h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">Financial Year Performance</h2><p className="mt-1 text-sm text-slate-500">Consolidated payroll performance for the selected financial year.</p></div>
        <label className="w-48 text-sm font-bold text-slate-700">Financial Year<select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium outline-none focus:border-[#153E90] focus:ring-2 focus:ring-blue-100">{years.map((year) => <option key={year.value} value={year.value}>{year.label}</option>)}</select></label>
      </div>
      <div className="px-6 pt-6"><div className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-[#153E90]">{selectedYear === currentYear.value ? "Current" : "Selected"} Financial Year · {financialYearFromValue(selectedYear)?.label || selectedYear}</div></div>
      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
        <ExecutiveMetricCard label="Payroll Runs" value={String(totals.processed)} helper="Payroll months processed" icon="calendar" tone="blue"/>
        <ExecutiveMetricCard label="Latest Payroll Period" value={runs[0] ? payrollMonthLabel(runs[0].payroll_month) : "—"} helper="Most recent payroll in this financial year" icon="calendar" tone="emerald"/>
        <ExecutiveMetricCard label="Net Payroll" value={money(totals.net)} helper="Financial-year employee payouts" icon="net" tone="blue"/>
        <ExecutiveMetricCard label="Total PF Amount" value={money(totals.totalPf)} helper="Employee PF, Employer PF, Employer EPS, Admin Charges, and EDLI Charges" icon="gross" tone="cyan"/>
        <ExecutiveMetricCard label="Total Professional Tax" value={money(totals.professionalTax)} helper="Financial-year professional tax" icon="deductions" tone="violet"/>
        <ExecutiveMetricCard label="Total TDS" value={money(totals.tds)} helper="Financial-year tax deducted at source" icon="deductions" tone="rose"/>
      </div>
    </Card>

    <Card>
      <div className="border-b border-slate-100 px-6 py-5"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#153E90]">Statutory overview</p><h3 className="mt-2 text-xl font-bold text-slate-950">Financial Year Contributions &amp; Taxes</h3><p className="mt-1 text-sm text-slate-500">Supporting statutory totals for {financialYearFromValue(selectedYear)?.label || selectedYear}.</p></div>
      <div className="grid grid-cols-1 gap-px bg-slate-200 sm:grid-cols-2 xl:grid-cols-7">
        {[["Employee PF", totals.employeePf, "text-cyan-700"], ["Employer PF", totals.employerPf, "text-violet-700"], ["Employer EPS", totals.employerEps, "text-indigo-700"], ["Admin Charges", totals.administrationCharges, "text-sky-700"], ["EDLI Charges", totals.edliCharges, "text-blue-700"], ["Professional Tax", totals.professionalTax, "text-rose-700"], ["TDS", totals.tds, "text-amber-700"]].map(([label, value, colour]) => <div key={String(label)} className="bg-white px-6 py-5"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">{label}</p><p className={`mt-2 text-xl font-bold ${colour}`}>{money(Number(value))}</p></div>)}
      </div>
    </Card>
  </div>;
}

type SettingsDraft = Record<"period_start_day" | "period_end_day" | "conveyance_allowance" | "professional_tax_threshold" | "professional_tax_amount", string> & { distributionMethod: PayrollSettings["payslip_distribution_method"]; payslipProtection: boolean; ytdProtection: boolean; performanceProtection: boolean; passwordRule: PayrollSettings["payslip_password_rule"]; emailSubject: string; emailTemplate: string };
const settingsDraft = (value: PayrollSettings): SettingsDraft => ({ period_start_day: String(value.period_start_day), period_end_day: String(value.period_end_day), conveyance_allowance: String(value.conveyance_allowance), professional_tax_threshold: String(value.professional_tax_threshold), professional_tax_amount: String(value.professional_tax_amount), distributionMethod: value.payslip_distribution_method || "notify_and_attach", payslipProtection: value.payslip_password_protection !== false, ytdProtection: value.ytd_password_protection !== false, performanceProtection: value.performance_password_protection !== false, passwordRule: value.payslip_password_rule || "employee_code_dob", emailSubject: value.payslip_email_subject || "Salary Slip - {{Month}} {{Year}}", emailTemplate: value.payslip_email_template || "" });
type BankSettingsDraft = { customerId: string; bankAccountNumber: string; ifscCode: string; branchCode: string; currency: string };
function SecurityToggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(checked:boolean)=>void}) {
  return <label className={`flex cursor-pointer items-center justify-between gap-4 rounded-2xl border p-4 text-sm font-bold transition ${checked?"border-[#153E90] bg-blue-50 text-[#153E90]":"border-slate-200 bg-slate-50 text-slate-600"}`}><span>{label}<span className="mt-1 block text-xs font-medium">{checked?"Enabled":"Disabled"}</span></span><input aria-label={label} type="checkbox" checked={checked} onChange={(event)=>onChange(event.target.checked)} className="h-5 w-5 accent-[#153E90]"/></label>;
}
function Settings({value,bankDetails,financeAccess,onSave}:{value:PayrollSettings;bankDetails?:CompanyPayrollBankDetails;financeAccess:boolean;onSave:(p:Record<string,unknown>)=>Promise<boolean>}) {
  const [form,setForm]=useState<SettingsDraft>(()=>settingsDraft(value));
  const [bank,setBank]=useState<BankSettingsDraft>(()=>({ customerId: bankDetails?.payroll_bank_customer_id || "", bankAccountNumber: bankDetails?.payroll_bank_account_number || "", ifscCode: bankDetails?.payroll_bank_ifsc_code || "", branchCode: bankDetails?.payroll_bank_branch_code || "", currency: bankDetails?.payroll_bank_currency || "INR" }));
  const saveSettings = () => onSave({ action:"save_settings", periodStartDay:normalizePayrollNumber(form.period_start_day), periodEndDay:normalizePayrollNumber(form.period_end_day), conveyanceAllowance:normalizePayrollNumber(form.conveyance_allowance), professionalTaxThreshold:normalizePayrollNumber(form.professional_tax_threshold), professionalTaxAmount:normalizePayrollNumber(form.professional_tax_amount), payslipDistributionMethod:form.distributionMethod, payslipPasswordProtection:form.payslipProtection, ytdPasswordProtection:form.ytdProtection, performancePasswordProtection:form.performanceProtection, payslipPasswordRule:form.passwordRule, payslipEmailSubject:form.emailSubject, payslipEmailTemplate:form.emailTemplate });
  return <div className="space-y-5"><Card className="p-7"><h2 className="text-xl font-bold">Payroll Settings</h2><p className="mt-2 text-slate-500">Configure the payroll period and statutory defaults.</p><div className="mt-6 grid gap-4 md:grid-cols-3">{[["Period start day","period_start_day"],["Period end day","period_end_day"],["Conveyance allowance","conveyance_allowance"],["PT threshold","professional_tax_threshold"],["PT amount","professional_tax_amount"]].map(([label,key])=><label key={key} className="text-sm font-bold">{label}<input type="number" value={form[key as "period_start_day" | "period_end_day" | "conveyance_allowance" | "professional_tax_threshold" | "professional_tax_amount"]} onChange={e=>setForm({...form,[key]:e.target.value})} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>)}</div></Card>
  <Card className="p-7"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#153E90]">Secure employee delivery</p><h2 className="mt-2 text-xl font-bold">Payslip Distribution</h2><p className="mt-2 text-slate-500">Control secure email delivery immediately after payroll submission.</p><fieldset className="mt-6 grid gap-3 lg:grid-cols-3"><legend className="mb-3 text-sm font-bold">Distribution Method</legend>{[["notify_only","Notify employee by email only"],["protected_pdf_only","Send password-protected PDF only"],["notify_and_attach","Notify employee + Attach password-protected PDF"]].map(([key,label])=><label key={key} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 text-sm font-bold ${form.distributionMethod === key ? "border-[#153E90] bg-blue-50 text-[#153E90]" : "border-slate-200"}`}><input type="radio" checked={form.distributionMethod === key} onChange={()=>setForm({...form,distributionMethod:key as PayrollSettings["payslip_distribution_method"]})}/>{label}</label>)}</fieldset><label className="mt-5 block text-sm font-bold">Email Subject<input value={form.emailSubject} onChange={e=>setForm({...form,emailSubject:e.target.value})} className={fieldClass}/></label><label className="mt-5 block text-sm font-bold">Email Template<textarea value={form.emailTemplate} onChange={e=>setForm({...form,emailTemplate:e.target.value})} className={`${fieldClass} min-h-56 leading-6`}/><span className="mt-2 block text-xs font-medium text-slate-500">Variables: {"{{EmployeeName}} {{PayrollMonth}} {{CompanyName}} {{PortalUrl}} {{PasswordRuleDescription}}"}</span></label></Card>
  <Card className="p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#153E90]">PDF Security</p><h2 className="mt-2 text-xl font-bold">Sensitive Employee Documents</h2><p className="mt-2 max-w-3xl text-slate-500">Apply one server-side password rule to portal downloads, historical documents, email attachments, YTD statements, and Performance reports.</p></div><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Finance Admin only</span></div><div className="mt-6 grid gap-4 lg:grid-cols-3"><SecurityToggle label="Password Protect Payslips" checked={form.payslipProtection} onChange={(checked)=>setForm({...form,payslipProtection:checked})}/><SecurityToggle label="Password Protect YTD Statements" checked={form.ytdProtection} onChange={(checked)=>setForm({...form,ytdProtection:checked})}/><SecurityToggle label="Password Protect Performance Reports" checked={form.performanceProtection} onChange={(checked)=>setForm({...form,performanceProtection:checked})}/></div><label className="mt-5 block max-w-xl text-sm font-bold">Password Rule<select value={form.passwordRule} onChange={e=>setForm({...form,passwordRule:e.target.value as PayrollSettings["payslip_password_rule"]})} className={fieldClass}><option value="employee_code_dob">Employee Code + DOB (DDMMYYYY)</option></select></label><div className="mt-5 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 p-5"><p className="text-xs font-bold uppercase tracking-wider text-[#153E90]">Example</p><p className="mt-2 text-sm text-slate-700">Employee Code: <strong>90001</strong> · DOB: <strong>18 June 1988</strong> · Result: <strong className="text-[#153E90]">9000118061988</strong></p><p className="mt-2 text-xs text-slate-500">Passwords are derived only when a document is generated. They are never stored or returned by an API.</p></div><KairoButton type="button" className="mt-6" onClick={()=>void saveSettings()}>Save PDF Security</KairoButton></Card>
  {financeAccess ? <Card className="p-7"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#153E90]">Bank transfer configuration</p><h2 className="mt-2 text-xl font-bold">Payroll Bank Account</h2><p className="mt-2 text-slate-500">Bank-upload master data used only for Finance payroll transfer exports.</p><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5"><label className="text-sm font-bold">Debit Account Number<input value={bank.bankAccountNumber} onChange={(event)=>setBank({...bank,bankAccountNumber:event.target.value})} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label><label className="text-sm font-bold">Branch Code<input value={bank.branchCode} onChange={(event)=>setBank({...bank,branchCode:event.target.value})} inputMode="text" className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label><label className="text-sm font-bold">Customer ID<input value={bank.customerId} onChange={(event)=>setBank({...bank,customerId:event.target.value})} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label><label className="text-sm font-bold">Debit IFSC<input value={bank.ifscCode} onChange={(event)=>setBank({...bank,ifscCode:event.target.value.toUpperCase()})} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 uppercase" /></label><label className="text-sm font-bold">Currency<input value={bank.currency} maxLength={3} onChange={(event)=>setBank({...bank,currency:event.target.value.toUpperCase()})} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 uppercase" /></label></div><KairoButton type="button" className="mt-6" onClick={()=>onSave({action:"save_payroll_bank_settings",customerId:bank.customerId,bankAccountNumber:bank.bankAccountNumber,ifscCode:bank.ifscCode,branchCode:bank.branchCode,currency:bank.currency})}>Save Bank Account</KairoButton></Card> : null}</div>;
}

type EntryDraft = Record<ManualPayrollField, string> & { notes: string };
const entryDraft = (entry: PayrollEntry): EntryDraft => ({ bonus:String(entry.bonus),leaveEncashment:String(entry.leave_encashment),lopDeduction:String(entry.lop_deduction),previousMonthAdjustment:String(entry.previous_month_adjustment),tds:String(entry.tds),notes:entry.manual_notes||"" });
function EntryDialog({entry,onClose,onSave}:{entry:PayrollEntry;onClose:()=>void;onSave:(p:Record<string,unknown>)=>Promise<void>}) {
  const [form,setForm]=useState<EntryDraft>(()=>entryDraft(entry)); const [busy,setBusy]=useState(false);
  async function save() { if (busy) return; setBusy(true); try { await onSave({action:"update_entry",entryId:entry.id,bonus:normalizePayrollNumber(form.bonus),leaveEncashment:normalizePayrollNumber(form.leaveEncashment),lopDeduction:normalizePayrollNumber(form.lopDeduction),previousMonthAdjustment:normalizePayrollNumber(form.previousMonthAdjustment),tds:normalizePayrollNumber(form.tds),notes:form.notes}); } finally { setBusy(false); } }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-5"><div aria-busy={busy} className={`relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-7 shadow-2xl transition ${busy ? "pointer-events-none select-none grayscale opacity-60" : ""}`}><div className="flex justify-between"><div><h2 className="text-2xl font-bold">Payroll Breakdown</h2><p className="mt-1 text-slate-500">{entry.employee_name} · Recommended LOP {money(entry.lop_recommended)}</p></div><button disabled={busy} onClick={onClose} className="h-10 w-10 rounded-xl bg-slate-100 text-xl">×</button></div><div className="mt-6 grid gap-4 md:grid-cols-2">{MANUAL_PAYROLL_FIELDS.map(({key,label})=>{ const component = key === "bonus" || key === "tds" ? key : null; const sources = (entry.recurring_adjustment_snapshot || []).filter((item) => item.component === component); const overridden = (entry.manual_override_fields || []).includes(key === "previousMonthAdjustment" ? "previous_month_adjustment" : key === "leaveEncashment" ? "leave_encashment" : key === "lopDeduction" ? "lop_deduction" : key); return <label key={key} className="text-sm font-bold">{label}<input disabled={busy} type="number" value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" />{sources.length ? <span className="mt-2 block rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-[#153E90]">Source: Recurring Adjustment{overridden ? " · Month-specific override" : ""}<br/>Period: {sources.map((item) => `${payrollMonthLabel(item.from_month)} – ${item.to_month ? payrollMonthLabel(item.to_month) : "Until disabled"}`).join(", ")}</span> : null}</label>; })}</div><textarea disabled={busy} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Adjustment notes" className="mt-4 min-h-24 w-full rounded-xl border border-slate-300 p-4"/><div className="mt-6 flex justify-end gap-3"><KairoButton type="button" variant="secondary" disabled={busy} onClick={onClose}>Cancel</KairoButton><KairoButton type="button" disabled={busy} onClick={()=>void save()}>{busy ? "Recalculating..." : "Recalculate & Save"}</KairoButton></div>{busy ? <div className="absolute inset-0 flex items-center justify-center bg-slate-200/45"><span className="rounded-full bg-slate-800 px-5 py-2 text-sm font-bold text-white shadow-lg">Recalculating payroll…</span></div> : null}</div></div>;
}
