"use client";

import { useMemo, useState } from "react";
import KairoButton from "@/components/ui/KairoButton";
import { payrollRequest } from "@/lib/payroll/client";
import { calculateSalaryStructure, latestSalaryStructure, salaryStructureDisplayStatus } from "@/lib/payroll/salaryStructures";
import type { PayrollSettings, SalaryStructure } from "@/lib/payroll/types";

type Employee = { id: string; employee_code: string; name: string; status?: string };
type StructureData = { role: string; employees?: Employee[]; structures?: SalaryStructure[]; settings?: PayrollSettings };
type DialogState = { mode: "create" | "edit" | "duplicate"; structure?: SalaryStructure } | null;

const inputClass = "mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-900 outline-none transition focus:border-[#153E90] focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";
const money = (value: number) => `₹${Math.round(Number(value || 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const todayValue = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
const displayDate = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
const createdDate = (value: string) => new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_45px_-32px_rgba(15,23,42,.35)] ${className}`}>{children}</section>;
}

function StatusBadge({ status }: { status: "active" | "scheduled" | "historical" }) {
  const style = status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "scheduled" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-100 text-slate-600";
  return <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${style}`}>{status}</span>;
}

export default function SalaryStructures({ data, onRefresh }: { data: StructureData; onRefresh: () => Promise<void> }) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [appliedEmployeeId, setAppliedEmployeeId] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleting, setDeleting] = useState<SalaryStructure | null>(null);
  const [error, setError] = useState("");
  const employees = useMemo(() => [...(data.employees || [])].sort((left, right) => left.employee_code.localeCompare(right.employee_code)), [data.employees]);
  const history = useMemo(() => (data.structures || []).filter((structure) => structure.employee_id === appliedEmployeeId).sort((left, right) => right.effective_from.localeCompare(left.effective_from) || right.version - left.version), [appliedEmployeeId, data.structures]);
  const latest = latestSalaryStructure(history);

  function reset() {
    setSelectedEmployeeId("");
    setAppliedEmployeeId("");
    setDialog(null);
    setDeleting(null);
    setError("");
  }

  if (data.role !== "finance admin") return <Card className="p-8 text-center text-sm font-semibold text-red-700">Only Finance Admin can access salary structures.</Card>;

  return <div className="space-y-5">
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-blue-100 bg-gradient-to-r from-blue-50/80 via-white to-cyan-50/60 px-6 py-5">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#153E90]">Effective-dated compensation</p><h2 className="mt-2 text-2xl font-bold text-slate-950">Salary Structures</h2><p className="mt-1 text-sm text-slate-500">Search an employee to review every salary version without changing historical payroll.</p></div>
        <KairoButton type="button" onClick={() => { setError(""); setDialog({ mode: "create" }); }}>Add Salary Structure</KairoButton>
      </div>
      <div className="flex flex-wrap items-end gap-3 p-6">
        <label className="min-w-[280px] flex-1 text-sm font-bold text-slate-700">Employee<select value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)} className={inputClass}><option value="">Select active employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employee_code} – {employee.name}</option>)}</select></label>
        <KairoButton type="button" disabled={!selectedEmployeeId} onClick={() => { setAppliedEmployeeId(selectedEmployeeId); setDialog(null); setDeleting(null); setError(""); }}>Search</KairoButton>
        <KairoButton type="button" variant="secondary" onClick={reset}>Reset</KairoButton>
      </div>
      {error ? <p role="alert" className="mx-6 mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
    </Card>

    {appliedEmployeeId ? <Card>
      <div className="border-b border-slate-100 px-6 py-5"><h3 className="text-xl font-bold">Salary Structure History</h3><p className="mt-1 text-sm text-slate-500">Newest effective date first. Scheduled versions apply only when their payroll month is reached.</p></div>
      {!history.length ? <div className="px-6 py-14 text-center"><p className="text-sm text-slate-400">No salary structure exists for this employee.</p><KairoButton type="button" className="mt-5" onClick={() => setDialog({ mode: "create" })}>Create First Structure</KairoButton></div> : <div className="overflow-x-auto"><table className="min-w-[1750px] text-sm"><thead className="bg-[#0F172A] text-left text-xs uppercase tracking-wide text-slate-300"><tr>{["Effective Date", "Monthly Gross Salary", "Basic Pay", "HRA", "Conveyance Allowance", "Other Allowance", "EPF Salary", "Employee PF", "Employer PF", "Employer EPS", "Status", "Created At", "Actions"].map((header) => <th key={header} className="px-4 py-4">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{history.map((structure) => { const status = salaryStructureDisplayStatus(structure, history, todayValue()); const isLatest = latest?.id === structure.id; return <tr key={structure.id} className="hover:bg-blue-50/40"><td className="whitespace-nowrap px-4 py-4 font-bold text-[#153E90]">{displayDate(structure.effective_from)}</td><td className="px-4 py-4 font-bold">{money(structure.gross_salary)}</td><td className="px-4 py-4">{money(structure.basic_pay)}</td><td className="px-4 py-4">{money(structure.hra)}</td><td className="px-4 py-4">{money(structure.conveyance_allowance)}</td><td className="px-4 py-4">{money(structure.other_allowance)}</td><td className="px-4 py-4">{money(structure.epf_salary)}</td><td className="px-4 py-4">{money(structure.employee_pf)}</td><td className="px-4 py-4">{money(structure.employer_pf)}</td><td className="px-4 py-4">{money(structure.employer_eps)}</td><td className="px-4 py-4"><StatusBadge status={status} /></td><td className="whitespace-nowrap px-4 py-4 text-slate-500">{createdDate(structure.created_at)}</td><td className="whitespace-nowrap px-4 py-4"><div className="flex gap-3">{isLatest ? <button type="button" className="font-bold text-[#153E90] hover:underline" onClick={() => setDialog({ mode: "edit", structure })}>Edit</button> : null}<button type="button" className="font-bold text-violet-700 hover:underline" onClick={() => setDialog({ mode: "duplicate", structure })}>Duplicate</button>{isLatest ? <button type="button" className="font-bold text-red-600 hover:underline" onClick={() => setDeleting(structure)}>Delete</button> : null}</div></td></tr>; })}</tbody></table></div>}
    </Card> : <Card className="px-6 py-16 text-center"><p className="font-semibold text-slate-400">Select an active employee and click Search to view salary structure history.</p></Card>}

    {dialog ? <StructureDialog key={`${dialog.mode}:${dialog.structure?.id || appliedEmployeeId || "new"}`} state={dialog} employees={employees} preselectedEmployeeId={appliedEmployeeId || selectedEmployeeId} conveyanceAllowance={Number(data.settings?.conveyance_allowance || 1_600)} onClose={() => setDialog(null)} onSaved={async (employeeId) => { setSelectedEmployeeId(employeeId); setAppliedEmployeeId(employeeId); await onRefresh(); setDialog(null); }} /> : null}
    {deleting ? <DeleteDialog structure={deleting} onClose={() => setDeleting(null)} onDeleted={async () => { await onRefresh(); setDeleting(null); }} /> : null}
  </div>;
}

type StructureForm = { employeeId: string; grossSalary: string; basicPay: string; hra: string; conveyanceAllowance: string; otherAllowance: string; epfSalary: string; employeePf: string; employerPf: string; employerEps: string; effectiveFrom: string; notes: string };
const stringValue = (value: number | null | undefined) => value == null ? "" : String(value);

function StructureDialog({ state, employees, preselectedEmployeeId, conveyanceAllowance, onClose, onSaved }: { state: Exclude<DialogState, null>; employees: Employee[]; preselectedEmployeeId: string; conveyanceAllowance: number; onClose: () => void; onSaved: (employeeId: string) => Promise<void> }) {
  const structure = state.structure;
  const [form, setForm] = useState<StructureForm>(() => ({ employeeId: structure?.employee_id || preselectedEmployeeId, grossSalary: stringValue(structure?.gross_salary), basicPay: stringValue(structure?.basic_pay), hra: stringValue(structure?.hra), conveyanceAllowance: stringValue(structure?.conveyance_allowance ?? conveyanceAllowance), otherAllowance: stringValue(structure?.other_allowance), epfSalary: stringValue(structure?.epf_salary), employeePf: stringValue(structure?.employee_pf), employerPf: stringValue(structure?.employer_pf), employerEps: stringValue(structure?.employer_eps), effectiveFrom: state.mode === "duplicate" ? "" : structure?.effective_from || "", notes: structure?.notes || "" }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const componentFields: Array<[keyof StructureForm, string]> = [["basicPay", "Basic Pay"], ["hra", "HRA"], ["conveyanceAllowance", "Conveyance Allowance"], ["otherAllowance", "Other Allowance"], ["epfSalary", "EPF Salary"], ["employeePf", "Employee PF"], ["employerPf", "Employer PF"], ["employerEps", "Employer EPS"]];

  function recalculate(grossValue = form.grossSalary) {
    const gross = Number(grossValue);
    if (!Number.isFinite(gross) || gross <= 0) return;
    const values = calculateSalaryStructure(gross, conveyanceAllowance);
    setForm((current) => ({ ...current, grossSalary: String(values.gross_salary), basicPay: String(values.basic_pay), hra: String(values.hra), conveyanceAllowance: String(values.conveyance_allowance), otherAllowance: String(values.other_allowance), epfSalary: String(values.epf_salary), employeePf: String(values.employee_pf), employerPf: String(values.employer_pf), employerEps: String(values.employer_eps) }));
  }

  function updateGross(value: string) {
    setForm((current) => ({ ...current, grossSalary: value }));
    if (state.mode === "create" && Number(value) > 0) {
      const calculated = calculateSalaryStructure(Number(value), conveyanceAllowance);
      setForm((current) => ({ ...current, grossSalary: value, basicPay: String(calculated.basic_pay), hra: String(calculated.hra), conveyanceAllowance: String(calculated.conveyance_allowance), otherAllowance: String(calculated.other_allowance), epfSalary: String(calculated.epf_salary), employeePf: String(calculated.employee_pf), employerPf: String(calculated.employer_pf), employerEps: String(calculated.employer_eps) }));
    }
  }

  async function save() {
    if (busy || !form.employeeId || !form.grossSalary || !form.effectiveFrom) return;
    setBusy(true); setError("");
    const components = { grossSalary: form.grossSalary, basicPay: form.basicPay, hra: form.hra, conveyanceAllowance: form.conveyanceAllowance, otherAllowance: form.otherAllowance, epfSalary: form.epfSalary, employeePf: form.employeePf, employerPf: form.employerPf, employerEps: form.employerEps };
    const payload = state.mode === "create" ? { action: "create_structure", employeeId: form.employeeId, grossSalary: form.grossSalary, effectiveFrom: form.effectiveFrom, notes: form.notes } : state.mode === "duplicate" ? { action: "duplicate_structure", structureId: structure!.id, effectiveFrom: form.effectiveFrom } : { action: "update_structure", structureId: structure!.id, effectiveFrom: form.effectiveFrom, notes: form.notes, ...components };
    try { await payrollRequest("/api/payroll", { method: "POST", body: JSON.stringify(payload) }); await onSaved(form.employeeId); } catch (cause) { setError(cause instanceof Error ? cause.message : "Salary structure could not be saved."); } finally { setBusy(false); }
  }

  const title = state.mode === "create" ? "Add Salary Structure" : state.mode === "edit" ? "Edit Salary Structure" : "Duplicate Salary Structure";
  const componentsEditable = state.mode === "edit";
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-labelledby="salary-structure-dialog-title" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/60 bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-7 py-5 backdrop-blur"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#153E90]">Versioned compensation</p><h3 id="salary-structure-dialog-title" className="mt-1 text-2xl font-bold">{title}</h3></div><button type="button" aria-label="Close" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xl text-slate-500 hover:bg-slate-200">×</button></div><div className="space-y-6 p-7"><div className="grid gap-4 md:grid-cols-3"><label className="text-sm font-bold">Employee<select disabled={state.mode !== "create"} value={form.employeeId} onChange={(event) => setForm({ ...form, employeeId: event.target.value })} className={inputClass}><option value="">Select active employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employee_code} – {employee.name}</option>)}</select></label><label className="text-sm font-bold">Monthly Gross Salary<input type="number" min="0" step="0.01" value={form.grossSalary} onChange={(event) => updateGross(event.target.value)} className={inputClass} /></label><label className="text-sm font-bold">Effective Date<input type="date" required value={form.effectiveFrom} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} className={inputClass} /></label></div>{state.mode === "edit" ? <div className="flex justify-end"><KairoButton type="button" variant="secondary" onClick={() => recalculate()}>Recalculate from Gross Salary</KairoButton></div> : null}<div className="grid gap-4 rounded-2xl border border-blue-100 bg-blue-50/40 p-5 md:grid-cols-4">{componentFields.map(([key, label]) => <label key={key} className="text-sm font-bold">{label}<input type="number" min="0" step="0.01" disabled={!componentsEditable} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className={inputClass} /></label>)}</div><label className="block text-sm font-bold">Notes<textarea rows={3} disabled={state.mode === "duplicate"} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className={inputClass} /></label>{state.mode === "duplicate" ? <p className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700">All salary components are copied from the selected version. Choose a new effective date to create the next version.</p> : null}{error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}<div className="flex justify-end gap-3 border-t border-slate-100 pt-5"><KairoButton type="button" variant="secondary" disabled={busy} onClick={onClose}>Cancel</KairoButton><KairoButton type="button" disabled={busy || !form.employeeId || !form.grossSalary || !form.effectiveFrom} onClick={() => void save()}>{busy ? "Saving..." : state.mode === "edit" ? "Save Changes" : "Save Structure"}</KairoButton></div></div></div></div>;
}

function DeleteDialog({ structure, onClose, onDeleted }: { structure: SalaryStructure; onClose: () => void; onDeleted: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function remove() { if (busy) return; setBusy(true); setError(""); try { await payrollRequest("/api/payroll", { method: "POST", body: JSON.stringify({ action: "delete_structure", structureId: structure.id }) }); await onDeleted(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Salary structure could not be deleted."); } finally { setBusy(false); } }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"><div role="alertdialog" aria-modal="true" aria-labelledby="delete-structure-title" className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-2xl text-red-600">!</div><h3 id="delete-structure-title" className="mt-5 text-2xl font-bold">Delete Salary Structure?</h3><div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="text-sm text-slate-500">Effective Date</p><p className="mt-1 font-bold">{displayDate(structure.effective_from)}</p><p className="mt-4 text-sm text-slate-500">Monthly Gross Salary</p><p className="mt-1 font-bold text-[#153E90]">{money(structure.gross_salary)}</p></div><p className="mt-5 text-sm leading-6 text-slate-600">Deleting this version will reactivate the previous salary structure. Generated payroll snapshots will not be changed.</p>{error ? <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}<div className="mt-6 flex justify-end gap-3"><KairoButton type="button" variant="secondary" disabled={busy} onClick={onClose}>Cancel</KairoButton><KairoButton type="button" variant="danger" disabled={busy} onClick={() => void remove()}>{busy ? "Deleting..." : "Delete"}</KairoButton></div></div></div>;
}
