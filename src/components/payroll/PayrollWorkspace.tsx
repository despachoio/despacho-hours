"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import KairoButton from "@/components/ui/KairoButton";
import { downloadPayrollYtd, downloadPayslip, payrollRequest } from "@/lib/payroll/client";
import { currentFinancialYear, financialYearFromValue, financialYearOptions, isInFinancialYear } from "@/lib/payroll/financialYear";
import { payrollMonthLabel, payslipFilename } from "@/lib/payroll/filenames";
import { MANUAL_PAYROLL_FIELDS, type ManualPayrollField } from "@/lib/payroll/labels";
import { normalizePayrollNumber } from "@/lib/payroll/numbers";
import { isAdminLevelRole } from "@/lib/roles";
import type { CompanyPayrollBankDetails, EmployeeBankDetails, PayrollEntry, PayrollRun, PayrollSettings, SalaryStructure } from "@/lib/payroll/types";
import { PayrollProcessing, PayrollReports } from "@/components/payroll/PayrollAdministration";

type Employee = { id: string; employee_code: string; name: string; title: string | null; department: string | null };
type PayrollData = { role: string; ownEntries: PayrollEntry[]; runs?: PayrollRun[]; structures?: SalaryStructure[]; settings?: PayrollSettings; employees?: Employee[]; selectedRun?: PayrollRun | null; bankDetails?: EmployeeBankDetails[]; companyBankDetails?: CompanyPayrollBankDetails; audit?: Array<Record<string, unknown>> };
type Tab = "overview" | "history" | "administration";
type AdministrationTab = "dashboard" | "structures" | "process" | "reports" | "settings";
const employeeTabs: Array<[Exclude<Tab, "administration">, string]> = [["overview", "My Payroll"], ["history", "Payroll History"]];
const administrationTabs: Array<[AdministrationTab, string]> = [["dashboard", "Payroll Dashboard"], ["structures", "Salary Structures"], ["process", "Payroll Processing"], ["reports", "Reports"], ["settings", "Settings"]];
const money = (value: number) => `₹${Math.round(Number(value || 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const monthValue = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; };
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <section className={`relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_45px_-32px_rgba(15,23,42,.35)] ${className}`}>{children}</section>;

export default function PayrollWorkspace() {
  const [data, setData] = useState<PayrollData | null>(null); const [month, setMonth] = useState(monthValue()); const [tab, setTab] = useState<Tab>("overview"); const [administrationTab, setAdministrationTab] = useState<AdministrationTab>("dashboard"); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [editing, setEditing] = useState<PayrollEntry | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(""); try { setData(await payrollRequest<PayrollData>(`/api/payroll?month=${month}`)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load Payroll"); } finally { setLoading(false); } }, [month]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const administrationAccess = isAdminLevelRole(data?.role);
  async function action(payload: Record<string, unknown>) { setMessage(""); setError(""); try { await payrollRequest("/api/payroll", { method: "POST", body: JSON.stringify(payload) }); setMessage("Payroll updated successfully."); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Payroll action failed"); } }
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
      {tab === "administration" && administrationAccess ? <div className="space-y-5">
        <nav aria-label="Payroll administration sections" className="flex gap-2 overflow-x-auto rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/90 via-white to-cyan-50/70 p-2 shadow-sm">
          {administrationTabs.map(([value, label]) => <button key={value} onClick={() => setAdministrationTab(value)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${administrationTab === value ? "bg-[#0F172A] text-white shadow" : "text-slate-600 hover:bg-white hover:text-[#153E90]"}`}>{label}</button>)}
        </nav>
        {administrationTab === "dashboard" ? <FinanceDashboard data={data} /> : null}
        {administrationTab === "structures" ? <Structures data={data} onSave={action} /> : null}
        {administrationTab === "process" ? <PayrollProcessing key={`${month}:${data.selectedRun?.id || "new"}`} data={data} month={month} setMonth={setMonth} onAction={action} onEdit={setEditing} /> : null}
        {administrationTab === "reports" ? <PayrollReports data={data} /> : null}
        {administrationTab === "settings" && data.settings ? <Settings value={data.settings} onSave={action} /> : null}
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
                  <th className="px-4 py-4 text-center">Gross Salary</th>
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
                    <td className="whitespace-nowrap px-4 py-5 text-center font-semibold text-slate-700">{money(entry.gross_salary)}</td>
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
function Title({ title,subtitle }: {title:string;subtitle:string}) { return <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50/70 via-white to-cyan-50/50 px-6 py-5"><h2 className="text-xl font-bold">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>; }
function Empty({text}:{text:string}) { return <p className="px-6 py-14 text-center text-sm text-slate-400">{text}</p>; }

function FinanceDashboard({ data }: { data: PayrollData }) { const run = data.selectedRun || data.runs?.[0]; const generated = data.runs?.filter(item => ["draft", "under_review"].includes(item.status)).length || 0; const approved = data.runs?.filter(item => ["approved","locked"].includes(item.status)).length || 0; const submitted = data.runs?.filter(item => item.status === "published").length || 0; return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Employees Processed" value={String(run?.employee_count || 0)} colour="text-[#153E90]"/><Metric label="Gross Payroll" value={money(run?.gross_payroll || 0)} colour="text-emerald-700"/><Metric label="Net Payroll" value={money(run?.net_payroll || 0)} colour="text-blue-700"/><Metric label="Employer PF" value={money(run?.employer_pf_total || 0)} colour="text-violet-700"/><Metric label="Employer EPS" value={money(run?.employer_eps_total || 0)} colour="text-indigo-700"/><Metric label="Generated Runs" value={String(generated)} colour="text-amber-700"/><Metric label="Approved Runs" value={String(approved)} colour="text-cyan-700"/><Metric label="Submitted Runs" value={String(submitted)} colour="text-emerald-700"/></div>; }

function Structures({ data,onSave }: { data:PayrollData;onSave:(payload:Record<string,unknown>)=>Promise<void> }) { const [employeeId,setEmployeeId]=useState(""); const [gross,setGross]=useState(""); const [effective,setEffective]=useState(new Date().toISOString().slice(0,10)); return <div className="space-y-5"><Card className="p-6"><h2 className="text-xl font-bold">Create Salary Structure</h2><div className="mt-5 grid gap-3 md:grid-cols-4"><select value={employeeId} onChange={e=>setEmployeeId(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3"><option value="">Select active employee</option>{data.employees?.map(e=><option key={e.id} value={e.id}>{e.employee_code} · {e.name}</option>)}</select><input type="number" placeholder="Monthly gross salary" value={gross} onChange={e=>setGross(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3" /><input type="date" value={effective} onChange={e=>setEffective(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3" /><KairoButton type="button" disabled={!employeeId||!gross} onClick={()=>onSave({action:"save_structure",employeeId,grossSalary:normalizePayrollNumber(gross),effectiveFrom:effective})}>Save Structure</KairoButton></div></Card><Card><Title title="Active Salary Structures" subtitle="One versioned active structure per employee." /><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-[#0F172A] text-left text-xs uppercase text-slate-300"><tr><th className="px-5 py-4">Employee</th><th>Version</th><th>Gross Salary</th><th>Effective From</th></tr></thead><tbody className="divide-y">{data.structures?.map(s=><tr key={s.id}><td className="px-5 py-4 font-bold">{s.employees?.employee_code} · {s.employees?.name}</td><td>v{s.version}</td><td>{money(s.gross_salary)}</td><td>{s.effective_from}</td></tr>)}</tbody></table></div></Card></div>; }
type SettingsDraft = Record<"period_start_day" | "period_end_day" | "conveyance_allowance" | "professional_tax_threshold" | "professional_tax_amount", string>;
const settingsDraft = (value: PayrollSettings): SettingsDraft => ({ period_start_day: String(value.period_start_day), period_end_day: String(value.period_end_day), conveyance_allowance: String(value.conveyance_allowance), professional_tax_threshold: String(value.professional_tax_threshold), professional_tax_amount: String(value.professional_tax_amount) });
function Settings({value,onSave}:{value:PayrollSettings;onSave:(p:Record<string,unknown>)=>Promise<void>}) { const [form,setForm]=useState<SettingsDraft>(()=>settingsDraft(value)); return <Card className="p-7"><h2 className="text-xl font-bold">Payroll Settings</h2><p className="mt-2 text-slate-500">Configure the payroll period and statutory defaults.</p><div className="mt-6 grid gap-4 md:grid-cols-3">{[["Period start day","period_start_day"],["Period end day","period_end_day"],["Conveyance allowance","conveyance_allowance"],["PT threshold","professional_tax_threshold"],["PT amount","professional_tax_amount"]].map(([label,key])=><label key={key} className="text-sm font-bold">{label}<input type="number" value={form[key as keyof SettingsDraft]} onChange={e=>setForm({...form,[key]:e.target.value})} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>)}</div><KairoButton type="button" className="mt-6" onClick={()=>onSave({action:"save_settings",periodStartDay:normalizePayrollNumber(form.period_start_day),periodEndDay:normalizePayrollNumber(form.period_end_day),conveyanceAllowance:normalizePayrollNumber(form.conveyance_allowance),professionalTaxThreshold:normalizePayrollNumber(form.professional_tax_threshold),professionalTaxAmount:normalizePayrollNumber(form.professional_tax_amount)})}>Save Settings</KairoButton></Card>; }

type EntryDraft = Record<ManualPayrollField, string> & { notes: string };
const entryDraft = (entry: PayrollEntry): EntryDraft => ({ bonus:String(entry.bonus),leaveEncashment:String(entry.leave_encashment),lopDeduction:String(entry.lop_deduction),previousMonthAdjustment:String(entry.previous_month_adjustment),tds:String(entry.tds),notes:entry.manual_notes||"" });
function EntryDialog({entry,onClose,onSave}:{entry:PayrollEntry;onClose:()=>void;onSave:(p:Record<string,unknown>)=>Promise<void>}) { const [form,setForm]=useState<EntryDraft>(()=>entryDraft(entry)); return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-5"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-7 shadow-2xl"><div className="flex justify-between"><div><h2 className="text-2xl font-bold">Payroll Breakdown</h2><p className="mt-1 text-slate-500">{entry.employee_name} · Recommended LOP {money(entry.lop_recommended)}</p></div><button onClick={onClose} className="h-10 w-10 rounded-xl bg-slate-100 text-xl">×</button></div><div className="mt-6 grid gap-4 md:grid-cols-2">{MANUAL_PAYROLL_FIELDS.map(({key,label})=><label key={key} className="text-sm font-bold">{label}<input type="number" value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>)}</div><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Adjustment notes" className="mt-4 min-h-24 w-full rounded-xl border border-slate-300 p-4"/><div className="mt-6 flex justify-end gap-3"><KairoButton type="button" variant="secondary" onClick={onClose}>Cancel</KairoButton><KairoButton type="button" onClick={()=>onSave({action:"update_entry",entryId:entry.id,bonus:normalizePayrollNumber(form.bonus),leaveEncashment:normalizePayrollNumber(form.leaveEncashment),lopDeduction:normalizePayrollNumber(form.lopDeduction),previousMonthAdjustment:normalizePayrollNumber(form.previousMonthAdjustment),tds:normalizePayrollNumber(form.tds),notes:form.notes})}>Recalculate &amp; Save</KairoButton></div></div></div>; }
