import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { calculatePayroll, payrollPeriod } from "./calculation";
import type { PayrollRun, PayrollSettings } from "./types";

export function payrollAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Payroll service is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function payrollActor(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Unauthorized");
  const admin = payrollAdmin();
  const user = await admin.auth.getUser(token);
  if (user.error || !user.data.user) throw new Error("Unauthorized");
  const profile = await admin.from("profiles").select("user_id,employee_id,role,full_name").eq("user_id", user.data.user.id).single();
  if (profile.error || !profile.data?.employee_id) throw new Error("Payroll profile is not configured");
  return { admin, userId: user.data.user.id, employeeId: profile.data.employee_id, role: String(profile.data.role || "").trim().toLowerCase(), name: profile.data.full_name || "User" };
}

const financeOnly = (role: string) => {
  if (role !== "finance admin") throw new Error("Finance Admin access required");
};

async function settings(admin: SupabaseClient) {
  const result = await admin.from("payroll_settings").select("*").eq("singleton_key", true).single();
  if (result.error) throw new Error(result.error.message);
  return result.data as PayrollSettings;
}

async function audit(admin: SupabaseClient, actor: Awaited<ReturnType<typeof payrollActor>>, values: { action: string; runId?: string; entryId?: string; structureId?: string; reason?: string; previous?: unknown; next?: unknown }) {
  const result = await admin.from("payroll_audit_log").insert({ payroll_run_id: values.runId || null, payroll_entry_id: values.entryId || null, salary_structure_id: values.structureId || null, action: values.action, actor_user_id: actor.userId, actor_role: actor.role, reason: values.reason || null, previous_value: values.previous || null, new_value: values.next || null });
  if (result.error) throw new Error(result.error.message);
}

export async function loadPayroll(request: Request, month?: string | null) {
  const actor = await payrollActor(request);
  const ownEntries = await actor.admin.from("payroll_entries").select("*").eq("employee_id", actor.employeeId).eq("status", "published").not("published_at", "is", null).order("payroll_month", { ascending: false });
  const ownReimbursements = await actor.admin.from("payroll_reimbursements").select("*").eq("employee_id", actor.employeeId).order("payroll_month", { ascending: false });
  if (ownEntries.error || ownReimbursements.error) throw new Error((ownEntries.error || ownReimbursements.error)?.message);
  const base = { role: actor.role, employeeId: actor.employeeId, ownEntries: ownEntries.data || [], ownReimbursements: ownReimbursements.data || [] };
  if (actor.role !== "finance admin") return base;
  const payrollMonth = month ? `${month.slice(0, 7)}-01` : null;
  const [runs, structures, payrollSettings, reimbursements, employees, auditRows] = await Promise.all([
    actor.admin.from("payroll_runs").select("*").order("payroll_month", { ascending: false }).limit(24),
    actor.admin.from("salary_structures").select("*,employees(id,employee_code,name,title,department,status)").eq("is_active", true).order("created_at", { ascending: false }),
    actor.admin.from("payroll_settings").select("*").eq("singleton_key", true).single(),
    actor.admin.from("payroll_reimbursements").select("*,employees(employee_code,name,title)").order("payroll_month", { ascending: false }).limit(500),
    actor.admin.from("employees").select("id,employee_code,name,title,department,status").eq("status", "active").order("employee_code"),
    actor.admin.from("payroll_audit_log").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  const failure = runs.error || structures.error || payrollSettings.error || reimbursements.error || employees.error || auditRows.error;
  if (failure) throw new Error(failure.message);
  let selectedRun: PayrollRun | null = null;
  let bankDetails: Array<Record<string, unknown>> = [];
  if (payrollMonth) {
    const run = await actor.admin.from("payroll_runs").select("*").eq("payroll_month", payrollMonth).maybeSingle();
    if (run.error) throw new Error(run.error.message);
    if (run.data) {
      const entries = await actor.admin.from("payroll_entries").select("*").eq("payroll_run_id", run.data.id).order("employee_code");
      if (entries.error) throw new Error(entries.error.message);
      selectedRun = { ...run.data, entries: entries.data || [] } as PayrollRun;
      const bank = await actor.admin.from("employee_finance_details").select("employee_id,bank_account_number,bank_name,ifsc_code,branch_name").in("employee_id", (entries.data || []).map((entry) => entry.employee_id));
      if (bank.error) throw new Error(bank.error.message);
      bankDetails = bank.data || [];
    }
  }
  return { ...base, runs: runs.data || [], structures: structures.data || [], settings: payrollSettings.data, reimbursements: reimbursements.data || [], employees: employees.data || [], audit: auditRows.data || [], selectedRun, bankDetails };
}

export async function saveSalaryStructure(request: Request, input: { employeeId: string; grossSalary: number; effectiveFrom: string; notes?: string }) {
  const actor = await payrollActor(request); financeOnly(actor.role);
  const active = await actor.admin.from("salary_structures").select("*").eq("employee_id", input.employeeId).eq("is_active", true).maybeSingle();
  if (active.error) throw new Error(active.error.message);
  const versions = await actor.admin.from("salary_structures").select("version").eq("employee_id", input.employeeId).order("version", { ascending: false }).limit(1);
  if (versions.error) throw new Error(versions.error.message);
  if (active.data) {
    const previousDay = new Date(`${input.effectiveFrom}T00:00:00Z`); previousDay.setUTCDate(previousDay.getUTCDate() - 1);
    const close = await actor.admin.from("salary_structures").update({ is_active: false, effective_to: previousDay.toISOString().slice(0, 10), updated_at: new Date().toISOString(), updated_by: actor.userId }).eq("id", active.data.id);
    if (close.error) throw new Error(close.error.message);
  }
  const insert = await actor.admin.from("salary_structures").insert({ employee_id: input.employeeId, version: Number(versions.data?.[0]?.version || 0) + 1, gross_salary: input.grossSalary, effective_from: input.effectiveFrom, notes: input.notes || null, created_by: actor.userId, updated_by: actor.userId }).select("*").single();
  if (insert.error) throw new Error(insert.error.message);
  await audit(actor.admin, actor, { action: "salary_structure_changed", structureId: insert.data.id, previous: active.data, next: insert.data });
  return insert.data;
}

export async function generatePayroll(request: Request, payrollMonth: string) {
  const actor = await payrollActor(request); financeOnly(actor.role);
  const config = await settings(actor.admin);
  const month = `${payrollMonth.slice(0, 7)}-01`;
  const period = payrollPeriod(month, config.period_start_day, config.period_end_day);
  const existing = await actor.admin.from("payroll_runs").select("*").eq("payroll_month", month).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data && existing.data.status !== "draft") throw new Error("Only a Draft payroll can be regenerated");
  let run = existing.data;
  if (!run) {
    const created = await actor.admin.from("payroll_runs").insert({ payroll_month: month, period_start: period.start, period_end: period.end, generated_by: actor.userId, updated_by: actor.userId }).select("*").single();
    if (created.error) throw new Error(created.error.message); run = created.data;
  } else {
    const clear = await actor.admin.from("payroll_entries").delete().eq("payroll_run_id", run.id);
    if (clear.error) throw new Error(clear.error.message);
  }
  const structures = await actor.admin.from("salary_structures").select("*,employees!inner(id,employee_code,name,title,department,status)").eq("is_active", true).eq("employees.status", "active");
  if (structures.error) throw new Error(structures.error.message);
  const reimbursements = await actor.admin.from("payroll_reimbursements").select("employee_id,amount").eq("payroll_month", month).eq("status", "approved");
  if (reimbursements.error) throw new Error(reimbursements.error.message);
  const reimbursementByEmployee = new Map<string, number>();
  for (const item of reimbursements.data || []) reimbursementByEmployee.set(item.employee_id, (reimbursementByEmployee.get(item.employee_id) || 0) + Number(item.amount));
  const lop = await actor.admin.from("leave_requests").select("employee_id,lop_salary_deduction_days,leave_types!inner(code)").in("status", ["approved", "cancellation_rejected"]).eq("leave_types.code", "LOP").lte("start_date", period.end).gte("end_date", period.start);
  if (lop.error) throw new Error(lop.error.message);
  const lopByEmployee = new Map<string, number>();
  for (const item of lop.data || []) lopByEmployee.set(item.employee_id, (lopByEmployee.get(item.employee_id) || 0) + Number(item.lop_salary_deduction_days || 0));
  const rows = (structures.data || []).map((structure) => {
    const employee = Array.isArray(structure.employees) ? structure.employees[0] : structure.employees;
    const calculated = calculatePayroll({ grossSalary: Number(structure.gross_salary), conveyanceAllowance: config.conveyance_allowance, reimbursements: reimbursementByEmployee.get(structure.employee_id) || 0, lopDays: lopByEmployee.get(structure.employee_id) || 0, periodDays: period.days, professionalTaxThreshold: config.professional_tax_threshold, professionalTaxAmount: config.professional_tax_amount });
    return { payroll_run_id: run.id, employee_id: structure.employee_id, salary_structure_id: structure.id, salary_structure_version: structure.version, employee_code: employee.employee_code, employee_name: [employee.title, employee.name].filter(Boolean).join(" "), department: employee.department, payroll_month: month, period_start: period.start, period_end: period.end, gross_salary: calculated.grossSalary, basic_pay: calculated.basicPay, hra: calculated.hra, conveyance_allowance: calculated.conveyanceAllowance, other_allowance: calculated.otherAllowance, bonus: calculated.bonus, leave_encashment: calculated.leaveEncashment, reimbursements: calculated.reimbursements, epf_salary: calculated.epfSalary, employee_pf: calculated.employeePf, employer_pf: calculated.employerPf, employer_eps: calculated.employerEps, employer_total_contribution: calculated.employerTotalContribution, professional_tax: calculated.professionalTax, lop_days: calculated.lopDays, lop_recommended: calculated.lopRecommended, lop_deduction: calculated.lopDeduction, previous_month_adjustment: calculated.previousMonthAdjustment, tds: calculated.tds, total_earnings: calculated.totalEarnings, total_deductions: calculated.totalDeductions, net_salary: calculated.netSalary, status: "draft" };
  });
  if (rows.length) { const inserted = await actor.admin.from("payroll_entries").insert(rows); if (inserted.error) throw new Error(inserted.error.message); }
  const totals = rows.reduce((sum, row) => ({ gross: sum.gross + row.gross_salary, net: sum.net + row.net_salary, pf: sum.pf + row.employer_pf, eps: sum.eps + row.employer_eps }), { gross: 0, net: 0, pf: 0, eps: 0 });
  const update = await actor.admin.from("payroll_runs").update({ employee_count: rows.length, gross_payroll: totals.gross, net_payroll: totals.net, employer_pf_total: totals.pf, employer_eps_total: totals.eps, generated_at: new Date().toISOString(), generated_by: actor.userId, updated_at: new Date().toISOString(), updated_by: actor.userId }).eq("id", run.id).select("*").single();
  if (update.error) throw new Error(update.error.message);
  await audit(actor.admin, actor, { action: existing.data ? "payroll_reprocessed" : "payroll_generated", runId: run.id, next: update.data });
  return update.data;
}

export async function updatePayrollEntry(request: Request, entryId: string, values: { bonus?: number; leaveEncashment?: number; reimbursements?: number; lopDeduction?: number; previousMonthAdjustment?: number; tds?: number; notes?: string }) {
  const actor = await payrollActor(request); financeOnly(actor.role);
  const current = await actor.admin.from("payroll_entries").select("*").eq("id", entryId).single();
  if (current.error) throw new Error(current.error.message);
  if (!['draft','under_review'].includes(current.data.status)) throw new Error("Manual fields are locked for this payroll");
  const config = await settings(actor.admin);
  const periodDays = Math.round((new Date(current.data.period_end).getTime() - new Date(current.data.period_start).getTime()) / 86_400_000) + 1;
  const calculated = calculatePayroll({ grossSalary: current.data.gross_salary, conveyanceAllowance: current.data.conveyance_allowance, bonus: values.bonus ?? current.data.bonus, leaveEncashment: values.leaveEncashment ?? current.data.leave_encashment, reimbursements: values.reimbursements ?? current.data.reimbursements, lopDays: current.data.lop_days, periodDays, confirmedLopDeduction: values.lopDeduction ?? current.data.lop_deduction, previousMonthAdjustment: values.previousMonthAdjustment ?? current.data.previous_month_adjustment, tds: values.tds ?? current.data.tds, professionalTaxThreshold: config.professional_tax_threshold, professionalTaxAmount: config.professional_tax_amount });
  const updateValues = { bonus: calculated.bonus, leave_encashment: calculated.leaveEncashment, reimbursements: calculated.reimbursements, professional_tax: calculated.professionalTax, lop_deduction: calculated.lopDeduction, previous_month_adjustment: calculated.previousMonthAdjustment, tds: calculated.tds, total_earnings: calculated.totalEarnings, total_deductions: calculated.totalDeductions, net_salary: calculated.netSalary, manual_notes: values.notes ?? current.data.manual_notes, updated_at: new Date().toISOString() };
  const update = await actor.admin.from("payroll_entries").update(updateValues).eq("id", entryId).select("*").single();
  if (update.error) throw new Error(update.error.message);
  await refreshRunTotals(actor.admin, current.data.payroll_run_id);
  await audit(actor.admin, actor, { action: "manual_adjustment", runId: current.data.payroll_run_id, entryId, previous: current.data, next: update.data });
  return update.data;
}

async function refreshRunTotals(admin: SupabaseClient, runId: string) {
  const entries = await admin.from("payroll_entries").select("gross_salary,net_salary,employer_pf,employer_eps").eq("payroll_run_id", runId);
  if (entries.error) throw new Error(entries.error.message);
  const totals = (entries.data || []).reduce((sum, row) => ({ gross: sum.gross + Number(row.gross_salary), net: sum.net + Number(row.net_salary), pf: sum.pf + Number(row.employer_pf), eps: sum.eps + Number(row.employer_eps) }), { gross: 0, net: 0, pf: 0, eps: 0 });
  const update = await admin.from("payroll_runs").update({ gross_payroll: totals.gross, net_payroll: totals.net, employer_pf_total: totals.pf, employer_eps_total: totals.eps, updated_at: new Date().toISOString() }).eq("id", runId);
  if (update.error) throw new Error(update.error.message);
}

export async function transitionPayroll(request: Request, runId: string, action: string, reason?: string) {
  const actor = await payrollActor(request); financeOnly(actor.role);
  const current = await actor.admin.from("payroll_runs").select("*").eq("id", runId).single();
  if (current.error) throw new Error(current.error.message);
  const nextByAction: Record<string, { from: string[]; to: string }> = { review: { from: ["draft"], to: "under_review" }, approve: { from: ["under_review"], to: "approved" }, lock: { from: ["approved"], to: "locked" }, publish: { from: ["locked"], to: "published" }, cancel: { from: ["draft","under_review","approved","locked","published"], to: "draft" } };
  const transition = nextByAction[action];
  if (!transition || !transition.from.includes(current.data.status)) throw new Error(`Cannot ${action} payroll in ${current.data.status} status`);
  if (action === "cancel" && !reason?.trim()) throw new Error("A cancellation reason is required");
  const now = new Date().toISOString();
  const fields: Record<string, unknown> = { status: transition.to, updated_at: now, updated_by: actor.userId };
  if (action === "approve") Object.assign(fields, { approved_at: now, approved_by: actor.userId });
  if (action === "lock") Object.assign(fields, { locked_at: now, locked_by: actor.userId });
  if (action === "publish") Object.assign(fields, { published_at: now, published_by: actor.userId });
  if (action === "cancel") Object.assign(fields, { cancellation_reason: reason, approved_at: null, approved_by: null, locked_at: null, locked_by: null, published_at: null, published_by: null });
  const update = await actor.admin.from("payroll_runs").update(fields).eq("id", runId).select("*").single();
  if (update.error) throw new Error(update.error.message);
  const entries = await actor.admin.from("payroll_entries").update({ status: transition.to, published_at: action === "publish" ? now : null, updated_at: now }).eq("payroll_run_id", runId);
  if (entries.error) throw new Error(entries.error.message);
  const auditAction: Record<string, string> = { review: "payroll_submitted_for_review", approve: "payroll_approved", lock: "payroll_locked", publish: "payroll_published", cancel: "payroll_cancelled" };
  await audit(actor.admin, actor, { action: auditAction[action], runId, reason, previous: current.data, next: update.data });
  return update.data;
}

export async function savePayrollSettings(request: Request, input: Partial<PayrollSettings>) {
  const actor = await payrollActor(request); financeOnly(actor.role);
  const previous = await settings(actor.admin);
  const update = await actor.admin.from("payroll_settings").update({ period_start_day: input.period_start_day, period_end_day: input.period_end_day, professional_tax_threshold: input.professional_tax_threshold, professional_tax_amount: input.professional_tax_amount, conveyance_allowance: input.conveyance_allowance, updated_at: new Date().toISOString(), updated_by: actor.userId }).eq("singleton_key", true).select("*").single();
  if (update.error) throw new Error(update.error.message);
  await audit(actor.admin, actor, { action: "payroll_settings_changed", previous, next: update.data });
  return update.data;
}
