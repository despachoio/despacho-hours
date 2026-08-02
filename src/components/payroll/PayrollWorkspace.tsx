"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import KairoButton from "@/components/ui/KairoButton";
import { downloadPayrollYtd, downloadPayslip, payrollRequest } from "@/lib/payroll/client";
import { currentFinancialYear, financialYearFromValue, financialYearOptions, isInFinancialYear } from "@/lib/payroll/financialYear";
import { payrollMonthLabel, payslipFilename } from "@/lib/payroll/filenames";
import type { PayrollEntry, PayrollRun, PayrollSettings, SalaryStructure } from "@/lib/payroll/types";

type Employee = { id: string; employee_code: string; name: string; title: string | null; department: string | null };
type PayrollData = { role: string; ownEntries: PayrollEntry[]; ownReimbursements: Array<Record<string, unknown>>; runs?: PayrollRun[]; structures?: SalaryStructure[]; settings?: PayrollSettings; employees?: Employee[]; selectedRun?: PayrollRun | null; bankDetails?: Array<Record<string, unknown>>; audit?: Array<Record<string, unknown>> };
type Tab = "overview" | "history" | "reimbursements" | "administration";
type AdministrationTab = "dashboard" | "structures" | "process" | "register" | "reports" | "settings";
const employeeTabs: Array<[Exclude<Tab, "administration">, string]> = [["overview", "My Payroll"], ["history", "Payroll History"], ["reimbursements", "Reimbursements"]];
const administrationTabs: Array<[AdministrationTab, string]> = [["dashboard", "Payroll Dashboard"], ["structures", "Salary Structures"], ["process", "Payroll Processing"], ["register", "Salary Register"], ["reports", "Reports"], ["settings", "Settings"]];
const money = (value: number) => `₹${Math.round(Number(value || 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const monthValue = () => new Date().toISOString().slice(0, 7);
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <section className={`relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_45px_-32px_rgba(15,23,42,.35)] ${className}`}>{children}</section>;

export default function PayrollWorkspace() {
  const [data, setData] = useState<PayrollData | null>(null); const [month, setMonth] = useState(monthValue()); const [tab, setTab] = useState<Tab>("overview"); const [administrationTab, setAdministrationTab] = useState<AdministrationTab>("dashboard"); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [editing, setEditing] = useState<PayrollEntry | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(""); try { setData(await payrollRequest<PayrollData>(`/api/payroll?month=${month}`)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load Payroll"); } finally { setLoading(false); } }, [month]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const finance = data?.role === "finance admin";
  async function action(payload: Record<string, unknown>) { setMessage(""); setError(""); try { await payrollRequest("/api/payroll", { method: "POST", body: JSON.stringify(payload) }); setMessage("Payroll updated successfully."); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Payroll action failed"); } }
  const latest = data?.ownEntries?.[0];
  return <div className="space-y-7">
    <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#0F172A] via-[#172554] to-[#153E90] px-8 py-10 text-white shadow-xl"><div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" /><p className="text-xs font-bold uppercase tracking-[.24em] text-cyan-200">Finance &amp; compensation</p><h1 className="mt-2 text-4xl font-bold tracking-tight lg:text-5xl">Payroll</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">Secure salary slips, payroll snapshots, statutory deductions, and controlled month-end processing.</p><span className="mt-5 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider">{finance ? "Finance Admin workspace" : "Employee self-service"}</span></header>
    <nav aria-label="Payroll sections" className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      {employeeTabs.map(([value,label]) => <button key={value} onClick={() => setTab(value)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${tab === value ? "bg-[#153E90] text-white shadow" : "text-slate-500 hover:bg-slate-100"}`}>{label}</button>)}
      {finance ? <button onClick={() => setTab("administration")} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${tab === "administration" ? "bg-[#153E90] text-white shadow" : "text-slate-500 hover:bg-slate-100"}`}>Administration</button> : null}
    </nav>
    {error ? <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 font-semibold text-red-700">{error}</p> : null}{message ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 font-semibold text-emerald-700">{message}</p> : null}
    {loading ? <div className="grid gap-4 md:grid-cols-3">{[1,2,3].map((item) => <div key={item} className="h-36 animate-pulse rounded-3xl bg-slate-200" />)}</div> : !data ? null : <>
      {tab === "overview" ? <EmployeeOverview entry={latest} entries={data.ownEntries} /> : null}
      {tab === "history" ? <PayrollHistory entries={data.ownEntries} /> : null}
      {tab === "reimbursements" ? <Reimbursements rows={data.ownReimbursements} /> : null}
      {tab === "administration" && finance ? <div className="space-y-5">
        <nav aria-label="Payroll administration sections" className="flex gap-2 overflow-x-auto rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/90 via-white to-cyan-50/70 p-2 shadow-sm">
          {administrationTabs.map(([value, label]) => <button key={value} onClick={() => setAdministrationTab(value)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${administrationTab === value ? "bg-[#0F172A] text-white shadow" : "text-slate-600 hover:bg-white hover:text-[#153E90]"}`}>{label}</button>)}
        </nav>
        {administrationTab === "dashboard" ? <FinanceDashboard data={data} /> : null}
        {administrationTab === "structures" ? <Structures data={data} onSave={action} /> : null}
        {administrationTab === "process" ? <Processing data={data} month={month} setMonth={setMonth} onAction={action} /> : null}
        {administrationTab === "register" ? <SalaryRegister run={data.selectedRun || null} onEdit={setEditing} /> : null}
        {administrationTab === "reports" ? <Reports run={data.selectedRun || null} bankDetails={data.bankDetails || []} /> : null}
        {administrationTab === "settings" && data.settings ? <Settings value={data.settings} onSave={action} /> : null}
      </div> : null}
    </>}
    {editing ? <EntryDialog entry={editing} onClose={() => setEditing(null)} onSave={async (payload) => { await action(payload); setEditing(null); }} /> : null}
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
              <thead className="bg-[#0F172A] text-xs uppercase tracking-wide text-slate-300">
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
                    <td className="whitespace-nowrap px-6 py-5 font-bold text-slate-900">{payrollMonthLabel(entry.payroll_month)}</td>
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
function Reimbursements({ rows }: { rows: Array<Record<string,unknown>> }) { return <Card><Title title="Reimbursements" subtitle="Approved and paid reimbursements included in payroll." /><div className="divide-y">{rows.map(row => <div key={String(row.id)} className="grid gap-3 px-6 py-4 md:grid-cols-4"><strong>{String(row.description)}</strong><span>{String(row.payroll_month).slice(0,7)}</span><span>{money(Number(row.amount))}</span><span className="capitalize text-emerald-700">{String(row.status)}</span></div>)}{!rows.length ? <Empty text="No reimbursements recorded." /> : null}</div></Card>; }
function Title({ title,subtitle }: {title:string;subtitle:string}) { return <div className="border-b border-slate-100 bg-gradient-to-r from-blue-50/70 via-white to-cyan-50/50 px-6 py-5"><h2 className="text-xl font-bold">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div>; }
function Empty({text}:{text:string}) { return <p className="px-6 py-14 text-center text-sm text-slate-400">{text}</p>; }

function FinanceDashboard({ data }: { data: PayrollData }) { const run = data.selectedRun || data.runs?.[0]; const pending = data.runs?.filter(item => item.status === "under_review").length || 0; const ready = data.runs?.filter(item => ["approved","locked"].includes(item.status)).length || 0; return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Employees Processed" value={String(run?.employee_count || 0)} colour="text-[#153E90]"/><Metric label="Gross Payroll" value={money(run?.gross_payroll || 0)} colour="text-emerald-700"/><Metric label="Net Payroll" value={money(run?.net_payroll || 0)} colour="text-blue-700"/><Metric label="Employer PF" value={money(run?.employer_pf_total || 0)} colour="text-violet-700"/><Metric label="Employer EPS" value={money(run?.employer_eps_total || 0)} colour="text-indigo-700"/><Metric label="Pending Review" value={String(pending)} colour="text-amber-700"/><Metric label="Ready for Approval" value={String(ready)} colour="text-cyan-700"/></div>; }

function Structures({ data,onSave }: { data:PayrollData;onSave:(payload:Record<string,unknown>)=>Promise<void> }) { const [employeeId,setEmployeeId]=useState(""); const [gross,setGross]=useState(""); const [effective,setEffective]=useState(new Date().toISOString().slice(0,10)); return <div className="space-y-5"><Card className="p-6"><h2 className="text-xl font-bold">Create Salary Structure</h2><div className="mt-5 grid gap-3 md:grid-cols-4"><select value={employeeId} onChange={e=>setEmployeeId(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3"><option value="">Select active employee</option>{data.employees?.map(e=><option key={e.id} value={e.id}>{e.employee_code} · {e.name}</option>)}</select><input type="number" placeholder="Monthly gross salary" value={gross} onChange={e=>setGross(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3" /><input type="date" value={effective} onChange={e=>setEffective(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-3" /><KairoButton type="button" disabled={!employeeId||!gross} onClick={()=>onSave({action:"save_structure",employeeId,grossSalary:Number(gross),effectiveFrom:effective})}>Save Structure</KairoButton></div></Card><Card><Title title="Active Salary Structures" subtitle="One versioned active structure per employee." /><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-[#0F172A] text-left text-xs uppercase text-slate-300"><tr><th className="px-5 py-4">Employee</th><th>Version</th><th>Gross Salary</th><th>Effective From</th></tr></thead><tbody className="divide-y">{data.structures?.map(s=><tr key={s.id}><td className="px-5 py-4 font-bold">{s.employees?.employee_code} · {s.employees?.name}</td><td>v{s.version}</td><td>{money(s.gross_salary)}</td><td>{s.effective_from}</td></tr>)}</tbody></table></div></Card></div>; }
function Processing({data,month,setMonth,onAction}:{data:PayrollData;month:string;setMonth:(v:string)=>void;onAction:(p:Record<string,unknown>)=>Promise<void>}) { const run=data.selectedRun; const next = run?.status === "draft" ? "review" : run?.status === "under_review" ? "approve" : run?.status === "approved" ? "lock" : run?.status === "locked" ? "publish" : null; return <div className="space-y-5"><Card className="p-6"><div className="flex flex-wrap items-end gap-3"><label className="text-sm font-bold">Payroll Month<input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="mt-2 block rounded-xl border border-slate-300 px-4 py-3" /></label><KairoButton type="button" onClick={()=>onAction({action:"generate",payrollMonth:month})}>{run ? "Reprocess Draft" : "Generate Payroll"}</KairoButton>{run&&next?<KairoButton type="button" onClick={()=>onAction({action:next,runId:run.id})}>{next.replace(/^./,c=>c.toUpperCase())} Payroll</KairoButton>:null}{run?<KairoButton type="button" variant="danger" onClick={()=>{const reason=window.prompt("Reason for cancelling payroll");if(reason)void onAction({action:"cancel",runId:run.id,reason});}}>Cancel Payroll</KairoButton>:null}</div></Card>{run?<><div className="grid gap-4 md:grid-cols-4"><Metric label="Employees Processed" value={String(run.employee_count)} colour="text-[#153E90]"/><Metric label="Gross Payroll" value={money(run.gross_payroll)} colour="text-emerald-700"/><Metric label="Net Payroll" value={money(run.net_payroll)} colour="text-blue-700"/><Metric label="Status" value={run.status.replaceAll("_"," ")} colour="text-violet-700"/></div><Card className="p-6"><p className="font-bold">Payroll period</p><p className="mt-2 text-slate-500">{run.period_start} → {run.period_end}</p></Card></>:<Empty text="Select a month and generate payroll."/>}</div>; }
function SalaryRegister({run,onEdit}:{run:PayrollRun|null;onEdit:(e:PayrollEntry)=>void}) { return <Card><Title title="Salary Register" subtitle="Review snapshots and manual fields before approval." />{run?<div className="overflow-x-auto"><table className="min-w-[1500px] text-sm"><thead className="bg-[#0F172A] text-left text-xs uppercase text-slate-300"><tr>{["Employee","Code","Department","Gross","Bonus","Encashment","Employee PF","Employer PF","EPS","PT","LOP","Adjustment","TDS","Net","Status","Actions"].map(h=><th key={h} className="px-4 py-4">{h}</th>)}</tr></thead><tbody className="divide-y">{run.entries?.map(e=><tr key={e.id}><td className="px-4 py-4 font-bold">{e.employee_name}</td><td>{e.employee_code}</td><td>{e.department}</td><td>{money(e.gross_salary)}</td><td>{money(e.bonus)}</td><td>{money(e.leave_encashment)}</td><td>{money(e.employee_pf)}</td><td>{money(e.employer_pf)}</td><td>{money(e.employer_eps)}</td><td>{money(e.professional_tax)}</td><td title={`Recommended ${money(e.lop_recommended)}`}>{money(e.lop_deduction)}</td><td>{money(e.previous_month_adjustment)}</td><td>{money(e.tds)}</td><td className="font-bold text-[#153E90]">{money(e.net_salary)}</td><td className="capitalize">{e.status.replaceAll("_"," ")}</td><td><button onClick={()=>onEdit(e)} className="font-bold text-[#153E90]">Edit / Breakdown</button></td></tr>)}</tbody></table></div>:<Empty text="Generate or select a payroll month to view the register."/>}</Card>; }
function Reports({run,bankDetails}:{run:PayrollRun|null;bankDetails:Array<Record<string,unknown>>}) { function save(name:string,rows:Array<Array<string|number>>){const quote=(v:string|number)=>`"${String(v).replaceAll('"','""')}"`;const content=rows.map(row=>row.map(quote).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([content],{type:"text/csv"}));a.download=name;a.click();URL.revokeObjectURL(a.href);} function register(){save(`salary-register-${run?.payroll_month.slice(0,7)||"payroll"}.csv`,[["Employee Code","Employee","Department","Gross","Bonus","Leave Encashment","Employee PF","Employer PF","Employer EPS","Professional Tax","LOP","Adjustment","TDS","Net","Status"],...(run?.entries||[]).map(e=>[e.employee_code,e.employee_name,e.department||"",e.gross_salary,e.bonus,e.leave_encashment,e.employee_pf,e.employer_pf,e.employer_eps,e.professional_tax,e.lop_deduction,e.previous_month_adjustment,e.tds,e.net_salary,e.status])]);} function bank(){const details=new Map(bankDetails.map(row=>[String(row.employee_id),row]));save(`bank-transfer-${run?.payroll_month.slice(0,7)||"payroll"}.csv`,[["Employee Code","Beneficiary Name","Account Number","IFSC","Bank","Branch","Amount"],...(run?.entries||[]).map(e=>{const value=details.get(e.employee_id)||{};return[e.employee_code,e.employee_name,String(value.bank_account_number||""),String(value.ifsc_code||""),String(value.bank_name||""),String(value.branch_name||""),e.net_salary];})]);} return <Card className="p-7"><h2 className="text-xl font-bold">Payroll Reports</h2><p className="mt-2 text-slate-500">Export the selected month’s complete salary register or bank-ready transfer file.</p><div className="mt-5 flex gap-3"><KairoButton type="button" disabled={!run} onClick={register}>Export Salary Register</KairoButton><KairoButton type="button" variant="secondary" disabled={!run} onClick={bank}>Export Bank Transfer File</KairoButton></div></Card>; }
function Settings({value,onSave}:{value:PayrollSettings;onSave:(p:Record<string,unknown>)=>Promise<void>}) { const [form,setForm]=useState(value); return <Card className="p-7"><h2 className="text-xl font-bold">Payroll Settings</h2><p className="mt-2 text-slate-500">Configure the payroll period and statutory defaults.</p><div className="mt-6 grid gap-4 md:grid-cols-3">{[["Period start day","period_start_day"],["Period end day","period_end_day"],["Conveyance allowance","conveyance_allowance"],["PT threshold","professional_tax_threshold"],["PT amount","professional_tax_amount"]].map(([label,key])=><label key={key} className="text-sm font-bold">{label}<input type="number" value={Number(form[key as keyof PayrollSettings])} onChange={e=>setForm({...form,[key]:Number(e.target.value)})} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>)}</div><KairoButton type="button" className="mt-6" onClick={()=>onSave({action:"save_settings",periodStartDay:form.period_start_day,periodEndDay:form.period_end_day,conveyanceAllowance:form.conveyance_allowance,professionalTaxThreshold:form.professional_tax_threshold,professionalTaxAmount:form.professional_tax_amount})}>Save Settings</KairoButton></Card>; }
function EntryDialog({entry,onClose,onSave}:{entry:PayrollEntry;onClose:()=>void;onSave:(p:Record<string,unknown>)=>Promise<void>}) { const [form,setForm]=useState({bonus:entry.bonus,leaveEncashment:entry.leave_encashment,reimbursements:entry.reimbursements,lopDeduction:entry.lop_deduction,previousMonthAdjustment:entry.previous_month_adjustment,tds:entry.tds,notes:entry.manual_notes||""}); const fields=Object.keys(form).filter(k=>k!=="notes") as Array<keyof typeof form>; return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-5"><div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-7 shadow-2xl"><div className="flex justify-between"><div><h2 className="text-2xl font-bold">Payroll Breakdown</h2><p className="mt-1 text-slate-500">{entry.employee_name} · Recommended LOP {money(entry.lop_recommended)}</p></div><button onClick={onClose} className="h-10 w-10 rounded-xl bg-slate-100 text-xl">×</button></div><div className="mt-6 grid gap-4 md:grid-cols-2">{fields.map(key=><label key={key} className="text-sm font-bold capitalize">{key.replaceAll(/([A-Z])/g," $1")}<input type="number" value={Number(form[key])} onChange={e=>setForm({...form,[key]:Number(e.target.value)})} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>)}</div><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Adjustment notes" className="mt-4 min-h-24 w-full rounded-xl border border-slate-300 p-4"/><div className="mt-6 flex justify-end gap-3"><KairoButton type="button" variant="secondary" onClick={onClose}>Cancel</KairoButton><KairoButton type="button" onClick={()=>onSave({action:"update_entry",entryId:entry.id,...form})}>Recalculate &amp; Save</KairoButton></div></div></div>; }
