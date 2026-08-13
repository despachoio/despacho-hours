import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { calculatePayroll, payrollPeriod } from "./calculation";
import { toPayrollEntryDto } from "./entry";
import { calculateSalaryStructure, latestSalaryStructure, selectEffectiveSalaryStructures, type SalaryStructureComponents } from "./salaryStructures";
import type {
  CompanyPayrollBankDetails,
  EmployeeBankDetails,
  PayrollRun,
  PayrollSettings,
  RecurringAdjustmentComponent,
  RecurringAdjustmentType,
  RecurringPayrollAdjustment,
  SalaryStructure,
} from "./types";
import { isFinanceAdminRole } from "@/lib/roles";
import { businessDateKey } from "@/lib/metrics/date-ranges";
import { buildBankTransferFile, salaryRegisterGrossPay } from "./exports";
import { bankTransferFilename } from "./filenames";
import { applicableRecurringAdjustments, payrollMonthDate, recurringComponentTotal } from "./recurringAdjustments";

const payrollBankFields = "payroll_bank_customer_id,payroll_bank_account_number,payroll_bank_ifsc_code,payroll_bank_branch_code,payroll_bank_currency";

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

const payrollAdminOnly = (role: string) => {
  if (!isFinanceAdminRole(role)) throw new Error("Finance Admin access required");
};

export const financePayrollOnly = (role: string) => {
  if (!isFinanceAdminRole(role)) throw new Error("Finance Admin access required");
};

async function settings(admin: SupabaseClient) {
  const result = await admin.from("payroll_settings").select("*").eq("singleton_key", true).single();
  if (result.error) throw new Error(result.error.message);
  return result.data as PayrollSettings;
}

function processingDate(value: string) {
  const normalized = String(value || "").trim();
  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new Error("Select a valid payroll processing date");
  }
  return normalized;
}

async function audit(admin: SupabaseClient, actor: Awaited<ReturnType<typeof payrollActor>>, values: { action: string; runId?: string; entryId?: string; structureId?: string; reason?: string; previous?: unknown; next?: unknown }) {
  const result = await admin.from("payroll_audit_log").insert({ payroll_run_id: values.runId || null, payroll_entry_id: values.entryId || null, salary_structure_id: values.structureId || null, action: values.action, actor_user_id: actor.userId, actor_role: actor.role, reason: values.reason || null, previous_value: values.previous || null, new_value: values.next || null });
  if (result.error) throw new Error(result.error.message);
}

export async function loadPayroll(request: Request, month?: string | null) {
  const actor = await payrollActor(request);
  const ownEntries = await actor.admin.from("payroll_entries").select("*").eq("employee_id", actor.employeeId).eq("status", "published").not("published_at", "is", null).order("payroll_month", { ascending: false });
  if (ownEntries.error) throw new Error(ownEntries.error.message);
  const base = { role: actor.role, employeeId: actor.employeeId, ownEntries: (ownEntries.data || []).map(toPayrollEntryDto) };
  if (!isFinanceAdminRole(actor.role)) return base;
  const payrollMonth = month ? `${month.slice(0, 7)}-01` : null;
  const salaryStructures = isFinanceAdminRole(actor.role)
    ? actor.admin.from("salary_structures").select("*,employees(id,employee_code,name,title,department,status)").order("effective_from", { ascending: false }).order("version", { ascending: false })
    : Promise.resolve({ data: [], error: null });
  const [runs, structures, payrollSettings, employees, auditRows, companyBank, recurringAdjustments] = await Promise.all([
    actor.admin.from("payroll_runs").select("*").order("payroll_month", { ascending: false }).limit(120),
    salaryStructures,
    actor.admin.from("payroll_settings").select("*").eq("singleton_key", true).single(),
    actor.admin.from("employees").select("id,employee_code,name,title,department,status").eq("status", "active").order("employee_code"),
    actor.admin.from("payroll_audit_log").select("*").order("created_at", { ascending: false }).limit(100),
    actor.admin.from("company_settings").select(payrollBankFields).eq("singleton_key", true).maybeSingle(),
    actor.admin.from("recurring_payroll_adjustments").select("*,employees(id,employee_code,name,title,status)").order("from_month", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  const failure = runs.error || structures.error || payrollSettings.error || employees.error || auditRows.error || companyBank.error || recurringAdjustments.error;
  if (failure) throw new Error(failure.message);
  const runIds = (runs.data || []).map((run) => run.id);
  const runEntries = runIds.length
    ? await actor.admin.from("payroll_entries").select("*").in("payroll_run_id", runIds).order("employee_code")
    : { data: [], error: null };
  if (runEntries.error) throw new Error(runEntries.error.message);
  const distributionRows = runIds.length
    ? await actor.admin.from("payslip_distributions").select("*").in("payroll_run_id", runIds)
    : { data: [], error: null };
  if (distributionRows.error) throw new Error(distributionRows.error.message);
  const entryDtos = (runEntries.data || []).map(toPayrollEntryDto);
  const entriesByRun = new Map<string, typeof entryDtos>();
  for (const entry of entryDtos) {
    const entries = entriesByRun.get(entry.payroll_run_id) || [];
    entries.push(entry);
    entriesByRun.set(entry.payroll_run_id, entries);
  }
  const runDtos = (runs.data || []).map((run) => {
    const entries = entriesByRun.get(run.id) || [];
    return {
      ...run,
      gross_payroll: entries.reduce((sum, entry) => sum + salaryRegisterGrossPay(entry), 0),
      net_payroll: entries.reduce((sum, entry) => sum + entry.net_salary, 0),
      entries,
      distributions: (distributionRows.data || []).filter((item) => item.payroll_run_id === run.id),
    } as PayrollRun;
  });
  let selectedRun: PayrollRun | null = null;
  let bankDetails: EmployeeBankDetails[] = [];
  if (payrollMonth) {
    const run = runDtos.find((item) => item.payroll_month === payrollMonth);
    if (run) {
      const entries = run.entries || [];
      selectedRun = run;
      const bank = await actor.admin.from("employee_finance_details").select("employee_id,bank_account_number,bank_name,ifsc_code,branch_name").in("employee_id", entries.map((entry) => entry.employee_id));
      if (bank.error) throw new Error(bank.error.message);
      bankDetails = (bank.data || []) as EmployeeBankDetails[];
    }
  }
  return {
    ...base,
    runs: runDtos,
    structures: structures.data || [],
    settings: payrollSettings.data,
    employees: employees.data || [],
    audit: auditRows.data || [],
    recurringAdjustments: recurringAdjustments.data || [],
    selectedRun,
    bankDetails,
    companyBankDetails: (companyBank.data || {
      payroll_bank_customer_id: null,
      payroll_bank_account_number: null,
      payroll_bank_ifsc_code: null,
      payroll_bank_branch_code: null,
      payroll_bank_currency: "INR",
    }) as CompanyPayrollBankDetails,
  };
}

type RecurringAdjustmentInput = {
  employeeId: string;
  adjustmentType: RecurringAdjustmentType;
  component: RecurringAdjustmentComponent;
  amount: number;
  fromMonth: string;
  toMonth?: string | null;
  enabled?: boolean;
  notes?: string;
};

function recurringAdjustmentValues(input: RecurringAdjustmentInput) {
  const adjustmentType = String(input.adjustmentType || "").trim().toLowerCase() as RecurringAdjustmentType;
  const component = String(input.component || "").trim().toLowerCase() as RecurringAdjustmentComponent;
  if (!((adjustmentType === "earning" && component === "bonus") || (adjustmentType === "deduction" && component === "tds"))) throw new Error("Select a supported recurring payroll component");
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Enter a valid non-negative recurring amount");
  const fromMonth = payrollMonthDate(input.fromMonth);
  const toMonth = input.toMonth ? payrollMonthDate(input.toMonth) : null;
  if (toMonth && toMonth < fromMonth) throw new Error("To Month cannot be before From Month");
  return { adjustment_type: adjustmentType, component, amount, from_month: fromMonth, to_month: toMonth, enabled: input.enabled ?? true, notes: String(input.notes || "").trim() || null };
}

export async function createRecurringAdjustment(request: Request, input: RecurringAdjustmentInput) {
  const actor = await payrollActor(request); financePayrollOnly(actor.role);
  const employee = await activeEmployee(actor.admin, input.employeeId);
  const values = recurringAdjustmentValues(input);
  const inserted = await actor.admin.from("recurring_payroll_adjustments").insert({ employee_id: input.employeeId, ...values, created_by: actor.userId, updated_by: actor.userId }).select("*").single();
  if (inserted.error) throw new Error(inserted.error.message);
  await audit(actor.admin, actor, { action: "recurring_adjustment_created", next: { ...inserted.data, employee } });
  return inserted.data as RecurringPayrollAdjustment;
}

export async function updateRecurringAdjustment(request: Request, adjustmentId: string, input: RecurringAdjustmentInput) {
  const actor = await payrollActor(request); financePayrollOnly(actor.role);
  const current = await actor.admin.from("recurring_payroll_adjustments").select("*").eq("id", adjustmentId).single();
  if (current.error) throw new Error(current.error.message);
  const values = recurringAdjustmentValues({ ...input, employeeId: current.data.employee_id });
  const updated = await actor.admin.from("recurring_payroll_adjustments").update({ ...values, updated_by: actor.userId, updated_at: new Date().toISOString() }).eq("id", adjustmentId).select("*").single();
  if (updated.error) throw new Error(updated.error.message);
  await audit(actor.admin, actor, { action: "recurring_adjustment_updated", previous: current.data, next: updated.data });
  return updated.data as RecurringPayrollAdjustment;
}

export async function duplicateRecurringAdjustment(request: Request, adjustmentId: string, fromMonth: string, toMonth?: string | null) {
  const actor = await payrollActor(request); financePayrollOnly(actor.role);
  const source = await actor.admin.from("recurring_payroll_adjustments").select("*").eq("id", adjustmentId).single();
  if (source.error) throw new Error(source.error.message);
  await activeEmployee(actor.admin, source.data.employee_id);
  const values = recurringAdjustmentValues({ employeeId: source.data.employee_id, adjustmentType: source.data.adjustment_type, component: source.data.component, amount: Number(source.data.amount), fromMonth, toMonth, enabled: true, notes: source.data.notes || "" });
  const inserted = await actor.admin.from("recurring_payroll_adjustments").insert({ employee_id: source.data.employee_id, ...values, created_by: actor.userId, updated_by: actor.userId }).select("*").single();
  if (inserted.error) throw new Error(inserted.error.message);
  await audit(actor.admin, actor, { action: "recurring_adjustment_duplicated", previous: source.data, next: inserted.data });
  return inserted.data as RecurringPayrollAdjustment;
}

export async function toggleRecurringAdjustment(request: Request, adjustmentId: string, enabled: boolean) {
  const actor = await payrollActor(request); financePayrollOnly(actor.role);
  const current = await actor.admin.from("recurring_payroll_adjustments").select("*").eq("id", adjustmentId).single();
  if (current.error) throw new Error(current.error.message);
  const updated = await actor.admin.from("recurring_payroll_adjustments").update({ enabled, updated_by: actor.userId, updated_at: new Date().toISOString() }).eq("id", adjustmentId).select("*").single();
  if (updated.error) throw new Error(updated.error.message);
  await audit(actor.admin, actor, { action: enabled ? "recurring_adjustment_enabled" : "recurring_adjustment_disabled", previous: current.data, next: updated.data });
  return updated.data as RecurringPayrollAdjustment;
}

const processedPayrollMessage = "Payroll has already been processed for a period affected by this effective date. Please choose a later effective date.";

function validEffectiveDate(value: string) {
  const normalized = String(value || "").trim();
  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new Error("Select a valid effective date.");
  }
  return normalized;
}

function validStructureComponents(input: SalaryStructureComponents) {
  const entries = Object.entries(input);
  if (entries.some(([, value]) => !Number.isFinite(Number(value)) || Number(value) < 0)) {
    throw new Error("Salary components must contain valid non-negative values.");
  }
  const composition = Number(input.basic_pay) + Number(input.hra) + Number(input.conveyance_allowance) + Number(input.other_allowance);
  if (Math.abs(composition - Number(input.gross_salary)) > 0.01) {
    throw new Error("Basic Pay, HRA, Conveyance Allowance, and Other Allowance must equal Monthly Gross Salary.");
  }
  return Object.fromEntries(entries.map(([key, value]) => [key, Number(value)])) as unknown as SalaryStructureComponents;
}

async function activeEmployee(admin: SupabaseClient, employeeId: string) {
  const employee = await admin.from("employees").select("id,employee_code,name,status").eq("id", employeeId).maybeSingle();
  if (employee.error) throw new Error(employee.error.message);
  if (!employee.data) throw new Error("Employee could not be found.");
  if (employee.data.status !== "active") throw new Error("Payroll administration can be managed only for active employees.");
  return employee.data;
}

async function employeeStructures(admin: SupabaseClient, employeeId: string) {
  const result = await admin.from("salary_structures").select("*").eq("employee_id", employeeId).order("effective_from", { ascending: false }).order("version", { ascending: false });
  if (result.error) throw new Error(result.error.message);
  return (result.data || []) as SalaryStructure[];
}

async function ensureUniqueEffectiveDate(admin: SupabaseClient, employeeId: string, effectiveFrom: string, excludedId?: string) {
  let query = admin.from("salary_structures").select("id").eq("employee_id", employeeId).eq("effective_from", effectiveFrom);
  if (excludedId) query = query.neq("id", excludedId);
  const duplicate = await query.limit(1).maybeSingle();
  if (duplicate.error) throw new Error(duplicate.error.message);
  if (duplicate.data) throw new Error("A salary structure already exists for this employee with this effective date.");
}

async function ensureNoAffectedPayroll(admin: SupabaseClient, effectiveFrom: string, structureId?: string) {
  if (structureId) {
    const used = await admin.from("payroll_entries").select("id").eq("salary_structure_id", structureId).limit(1).maybeSingle();
    if (used.error) throw new Error(used.error.message);
    if (used.data) throw new Error(processedPayrollMessage);
  }
  const affectedMonth = `${effectiveFrom.slice(0, 7)}-01`;
  const processed = await admin.from("payroll_runs").select("id").gte("payroll_month", affectedMonth).limit(1).maybeSingle();
  if (processed.error) throw new Error(processed.error.message);
  if (processed.data) throw new Error(processedPayrollMessage);
}

async function nextStructureVersion(admin: SupabaseClient, employeeId: string) {
  const versions = await admin.from("salary_structures").select("version").eq("employee_id", employeeId).order("version", { ascending: false }).limit(1);
  if (versions.error) throw new Error(versions.error.message);
  return Number(versions.data?.[0]?.version || 0) + 1;
}

export async function createSalaryStructure(request: Request, input: { employeeId: string; grossSalary: number; effectiveFrom: string; notes?: string }) {
  const actor = await payrollActor(request); financePayrollOnly(actor.role);
  const effectiveFrom = validEffectiveDate(input.effectiveFrom);
  await activeEmployee(actor.admin, input.employeeId);
  await ensureUniqueEffectiveDate(actor.admin, input.employeeId, effectiveFrom);
  await ensureNoAffectedPayroll(actor.admin, effectiveFrom);
  const config = await settings(actor.admin);
  const components = validStructureComponents(calculateSalaryStructure(input.grossSalary, config.conveyance_allowance));
  const version = await nextStructureVersion(actor.admin, input.employeeId);
  const insert = await actor.admin.from("salary_structures").insert({ employee_id: input.employeeId, version, ...components, effective_from: effectiveFrom, effective_to: null, is_active: false, notes: input.notes || null, created_by: actor.userId, updated_by: actor.userId }).select("*").single();
  if (insert.error) throw new Error(insert.error.code === "23505" ? "A salary structure already exists for this employee with this effective date." : insert.error.message);
  await audit(actor.admin, actor, { action: "salary_structure_created", structureId: insert.data.id, next: { ...insert.data, employee_id: input.employeeId, effective_from: effectiveFrom } });
  return insert.data;
}

export async function updateSalaryStructure(request: Request, structureId: string, input: SalaryStructureComponents & { effectiveFrom: string; notes?: string }) {
  const actor = await payrollActor(request); financePayrollOnly(actor.role);
  const current = await actor.admin.from("salary_structures").select("*").eq("id", structureId).single();
  if (current.error) throw new Error(current.error.message);
  await activeEmployee(actor.admin, current.data.employee_id);
  const structures = await employeeStructures(actor.admin, current.data.employee_id);
  if (latestSalaryStructure(structures)?.id !== structureId) throw new Error("Only the latest salary structure version can be edited.");
  const effectiveFrom = validEffectiveDate(input.effectiveFrom);
  const previousVersion = structures.filter((structure) => structure.id !== structureId).sort((left, right) => right.effective_from.localeCompare(left.effective_from))[0];
  if (previousVersion && effectiveFrom <= previousVersion.effective_from) throw new Error("The latest salary structure must have an effective date after the previous version.");
  await ensureUniqueEffectiveDate(actor.admin, current.data.employee_id, effectiveFrom, structureId);
  await ensureNoAffectedPayroll(actor.admin, effectiveFrom < current.data.effective_from ? effectiveFrom : current.data.effective_from, structureId);
  const components = validStructureComponents({
    gross_salary: input.gross_salary,
    basic_pay: input.basic_pay,
    hra: input.hra,
    conveyance_allowance: input.conveyance_allowance,
    other_allowance: input.other_allowance,
    epf_salary: input.epf_salary,
    employee_pf: input.employee_pf,
    employer_pf: input.employer_pf,
    employer_eps: input.employer_eps,
  });
  const updated = await actor.admin.from("salary_structures").update({ ...components, effective_from: effectiveFrom, notes: input.notes ?? current.data.notes, updated_at: new Date().toISOString(), updated_by: actor.userId }).eq("id", structureId).select("*").single();
  if (updated.error) throw new Error(updated.error.code === "23505" ? "A salary structure already exists for this employee with this effective date." : updated.error.message);
  await audit(actor.admin, actor, { action: "salary_structure_edited", structureId, previous: current.data, next: updated.data });
  return updated.data;
}

export async function duplicateSalaryStructure(request: Request, structureId: string, effectiveDate: string) {
  const actor = await payrollActor(request); financePayrollOnly(actor.role);
  const source = await actor.admin.from("salary_structures").select("*").eq("id", structureId).single();
  if (source.error) throw new Error(source.error.message);
  await activeEmployee(actor.admin, source.data.employee_id);
  const structures = await employeeStructures(actor.admin, source.data.employee_id);
  const active = selectEffectiveSalaryStructures(structures, businessDateKey())[0];
  if (active?.id !== structureId) throw new Error("Only the active salary structure can be duplicated.");
  const effectiveFrom = validEffectiveDate(effectiveDate);
  await ensureUniqueEffectiveDate(actor.admin, source.data.employee_id, effectiveFrom);
  await ensureNoAffectedPayroll(actor.admin, effectiveFrom);
  const version = await nextStructureVersion(actor.admin, source.data.employee_id);
  const components = validStructureComponents({ gross_salary: source.data.gross_salary, basic_pay: source.data.basic_pay, hra: source.data.hra, conveyance_allowance: source.data.conveyance_allowance, other_allowance: source.data.other_allowance, epf_salary: source.data.epf_salary, employee_pf: source.data.employee_pf, employer_pf: source.data.employer_pf, employer_eps: source.data.employer_eps });
  const inserted = await actor.admin.from("salary_structures").insert({ employee_id: source.data.employee_id, version, ...components, effective_from: effectiveFrom, effective_to: null, is_active: false, notes: source.data.notes, created_by: actor.userId, updated_by: actor.userId }).select("*").single();
  if (inserted.error) throw new Error(inserted.error.code === "23505" ? "A salary structure already exists for this employee with this effective date." : inserted.error.message);
  await audit(actor.admin, actor, { action: "salary_structure_duplicated", structureId: inserted.data.id, previous: source.data, next: inserted.data });
  return inserted.data;
}

export async function deleteSalaryStructure(request: Request, structureId: string) {
  const actor = await payrollActor(request); financePayrollOnly(actor.role);
  const current = await actor.admin.from("salary_structures").select("*").eq("id", structureId).single();
  if (current.error) throw new Error(current.error.message);
  const structures = await employeeStructures(actor.admin, current.data.employee_id);
  if (latestSalaryStructure(structures)?.id !== structureId) throw new Error("Only the latest salary structure version can be deleted.");
  if (structures.length <= 1) throw new Error("At least one salary structure must remain for this employee.");
  const used = await actor.admin.from("payroll_entries").select("id").eq("salary_structure_id", structureId).limit(1).maybeSingle();
  if (used.error) throw new Error(used.error.message);
  if (used.data) throw new Error("This salary structure is used by processed payroll. Cancel the affected payroll before deleting it.");
  const removed = await actor.admin.from("salary_structures").delete().eq("id", structureId);
  if (removed.error) throw new Error(removed.error.message);
  await audit(actor.admin, actor, { action: "salary_structure_deleted", previous: current.data, next: { employee_id: current.data.employee_id, deleted_structure_id: structureId, reactivated_structure_id: structures[1]?.id || null } });
  return { deleted: true, structureId, reactivatedStructureId: structures[1]?.id || null };
}

async function buildPayroll(request: Request, payrollMonth: string, preserveManualAdjustments: boolean, requestedProcessingDate?: string) {
  const actor = await payrollActor(request); payrollAdminOnly(actor.role);
  const config = await settings(actor.admin);
  const month = `${payrollMonth.slice(0, 7)}-01`;
  const period = payrollPeriod(month, config.period_start_day, config.period_end_day);
  const existing = await actor.admin.from("payroll_runs").select("*").eq("payroll_month", month).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data && !preserveManualAdjustments) throw new Error("Payroll has already been generated for this month");
  if (existing.data && !["draft", "under_review"].includes(existing.data.status)) throw new Error("Only Generated payroll can be reprocessed");
  let run = existing.data;
  const existingEntries = run
    ? await actor.admin.from("payroll_entries").select("*").eq("payroll_run_id", run.id)
    : { data: [], error: null };
  if (existingEntries.error) throw new Error(existingEntries.error.message);
  const manualByEmployee = new Map(
    (preserveManualAdjustments ? existingEntries.data || [] : []).map((entry) => [entry.employee_id, entry]),
  );
  if (!run) {
    const created = await actor.admin.from("payroll_runs").insert({ payroll_month: month, processing_date: processingDate(requestedProcessingDate || ""), period_start: period.start, period_end: period.end, generated_by: actor.userId, updated_by: actor.userId }).select("*").single();
    if (created.error) throw new Error(created.error.message); run = created.data;
  } else {
    const clear = await actor.admin.from("payroll_entries").delete().eq("payroll_run_id", run.id);
    if (clear.error) throw new Error(clear.error.message);
  }
  const structureCandidates = await actor.admin.from("salary_structures").select("*,employees!inner(id,employee_code,name,title,department,status)").eq("employees.status", "active").lte("effective_from", month).order("effective_from", { ascending: false }).order("version", { ascending: false });
  if (structureCandidates.error) throw new Error(structureCandidates.error.message);
  const structures = selectEffectiveSalaryStructures(structureCandidates.data || [], month);
  const recurringResult = await actor.admin.from("recurring_payroll_adjustments").select("*").eq("enabled", true).lte("from_month", month).or(`to_month.is.null,to_month.gte.${month}`);
  if (recurringResult.error) throw new Error(recurringResult.error.message);
  const recurringAdjustments = (recurringResult.data || []) as RecurringPayrollAdjustment[];
  const lop = await actor.admin.from("leave_requests").select("employee_id,lop_salary_deduction_days,leave_types!inner(code)").in("status", ["approved", "cancellation_rejected"]).eq("leave_types.code", "LOP").lte("start_date", period.end).gte("end_date", period.start);
  if (lop.error) throw new Error(lop.error.message);
  const lopByEmployee = new Map<string, number>();
  for (const item of lop.data || []) lopByEmployee.set(item.employee_id, (lopByEmployee.get(item.employee_id) || 0) + Number(item.lop_salary_deduction_days || 0));
  const rows = structures.map((structure) => {
    const employee = Array.isArray(structure.employees) ? structure.employees[0] : structure.employees;
    const manual = manualByEmployee.get(structure.employee_id);
    const applicable = applicableRecurringAdjustments(recurringAdjustments, structure.employee_id, month);
    const overrideFields = Array.isArray(manual?.manual_override_fields) ? manual.manual_override_fields.map(String) : [];
    const recurringBonus = recurringComponentTotal(applicable, "bonus");
    const recurringTds = recurringComponentTotal(applicable, "tds");
    const bonus = manual && overrideFields.includes("bonus") ? Number(manual.bonus || 0) : recurringBonus;
    const tds = manual && overrideFields.includes("tds") ? Number(manual.tds || 0) : recurringTds;
    const calculated = calculatePayroll({ grossSalary: Number(structure.gross_salary), basicPay: Number(structure.basic_pay), hra: Number(structure.hra), conveyanceAllowance: Number(structure.conveyance_allowance), otherAllowance: Number(structure.other_allowance), epfSalary: Number(structure.epf_salary), employeePf: Number(structure.employee_pf), employerPf: Number(structure.employer_pf), employerEps: Number(structure.employer_eps), bonus, leaveEncashment: Number(manual?.leave_encashment || 0), lopDays: lopByEmployee.get(structure.employee_id) || 0, periodDays: period.days, confirmedLopDeduction: manual ? Number(manual.lop_deduction || 0) : undefined, previousMonthAdjustment: Number(manual?.previous_month_adjustment || 0), tds, professionalTaxThreshold: config.professional_tax_threshold, professionalTaxAmount: config.professional_tax_amount });
    const recurringSnapshot = applicable.map(({ id, adjustment_type, component, amount, from_month, to_month }) => ({ id, adjustment_type, component, amount: Number(amount), from_month, to_month }));
    return { payroll_run_id: run.id, employee_id: structure.employee_id, salary_structure_id: structure.id, salary_structure_version: structure.version, employee_code: employee.employee_code, employee_name: [employee.title, employee.name].filter(Boolean).join(" "), department: employee.department, payroll_month: month, period_start: period.start, period_end: period.end, gross_salary: calculated.grossSalary, basic_pay: calculated.basicPay, hra: calculated.hra, conveyance_allowance: calculated.conveyanceAllowance, other_allowance: calculated.otherAllowance, bonus: calculated.bonus, leave_encashment: calculated.leaveEncashment, epf_salary: calculated.epfSalary, employee_pf: calculated.employeePf, employer_pf: calculated.employerPf, employer_eps: calculated.employerEps, employer_total_contribution: calculated.employerTotalContribution, professional_tax: calculated.professionalTax, lop_days: calculated.lopDays, lop_recommended: calculated.lopRecommended, lop_deduction: calculated.lopDeduction, previous_month_adjustment: calculated.previousMonthAdjustment, tds: calculated.tds, total_earnings: calculated.totalEarnings, total_deductions: calculated.totalDeductions, net_salary: calculated.netSalary, recurring_adjustment_snapshot: recurringSnapshot, manual_override_fields: overrideFields, status: "draft" };
  });
  if (rows.length) { const inserted = await actor.admin.from("payroll_entries").insert(rows); if (inserted.error) throw new Error(inserted.error.message); }
  const totals = rows.reduce((sum, row) => ({ gross: sum.gross + salaryRegisterGrossPay(row), net: sum.net + row.net_salary, pf: sum.pf + row.employer_pf, eps: sum.eps + row.employer_eps }), { gross: 0, net: 0, pf: 0, eps: 0 });
  const update = await actor.admin.from("payroll_runs").update({ employee_count: rows.length, gross_payroll: totals.gross, net_payroll: totals.net, employer_pf_total: totals.pf, employer_eps_total: totals.eps, generated_at: new Date().toISOString(), generated_by: actor.userId, updated_at: new Date().toISOString(), updated_by: actor.userId }).eq("id", run.id).select("*").single();
  if (update.error) throw new Error(update.error.message);
  await audit(actor.admin, actor, { action: preserveManualAdjustments ? "payroll_reprocessed" : "payroll_generated", runId: run.id, next: update.data });
  return update.data;
}

export function generatePayroll(request: Request, payrollMonth: string, requestedProcessingDate: string) {
  return buildPayroll(request, payrollMonth, false, requestedProcessingDate);
}

export function reprocessPayroll(request: Request, payrollMonth: string) {
  return buildPayroll(request, payrollMonth, true);
}

export async function updatePayrollEntry(request: Request, entryId: string, values: { bonus?: number; leaveEncashment?: number; lopDeduction?: number; previousMonthAdjustment?: number; tds?: number; notes?: string }) {
  const actor = await payrollActor(request); payrollAdminOnly(actor.role);
  const current = await actor.admin.from("payroll_entries").select("*").eq("id", entryId).single();
  if (current.error) throw new Error(current.error.message);
  if (!['draft','under_review'].includes(current.data.status)) throw new Error("Manual fields are locked for this payroll");
  const config = await settings(actor.admin);
  const periodDays = Math.round((new Date(current.data.period_end).getTime() - new Date(current.data.period_start).getTime()) / 86_400_000) + 1;
  const calculated = calculatePayroll({ grossSalary: current.data.gross_salary, conveyanceAllowance: current.data.conveyance_allowance, bonus: values.bonus ?? current.data.bonus, leaveEncashment: values.leaveEncashment ?? current.data.leave_encashment, lopDays: current.data.lop_days, periodDays, confirmedLopDeduction: values.lopDeduction ?? current.data.lop_deduction, previousMonthAdjustment: values.previousMonthAdjustment ?? current.data.previous_month_adjustment, tds: values.tds ?? current.data.tds, professionalTaxThreshold: config.professional_tax_threshold, professionalTaxAmount: config.professional_tax_amount });
  const manualOverrideFields = new Set<string>(Array.isArray(current.data.manual_override_fields) ? current.data.manual_override_fields.map(String) : []);
  const changedFields: Array<[string, number | undefined, unknown]> = [["bonus", values.bonus, current.data.bonus], ["leave_encashment", values.leaveEncashment, current.data.leave_encashment], ["lop_deduction", values.lopDeduction, current.data.lop_deduction], ["previous_month_adjustment", values.previousMonthAdjustment, current.data.previous_month_adjustment], ["tds", values.tds, current.data.tds]];
  for (const [field, next, previous] of changedFields) if (next !== undefined && Number(next) !== Number(previous)) manualOverrideFields.add(field);
  const updateValues = { bonus: calculated.bonus, leave_encashment: calculated.leaveEncashment, professional_tax: calculated.professionalTax, lop_deduction: calculated.lopDeduction, previous_month_adjustment: calculated.previousMonthAdjustment, tds: calculated.tds, total_earnings: calculated.totalEarnings, total_deductions: calculated.totalDeductions, net_salary: calculated.netSalary, manual_override_fields: [...manualOverrideFields], manual_notes: values.notes ?? current.data.manual_notes, updated_at: new Date().toISOString() };
  const update = await actor.admin.from("payroll_entries").update(updateValues).eq("id", entryId).select("*").single();
  if (update.error) throw new Error(update.error.message);
  await refreshRunTotals(actor.admin, current.data.payroll_run_id);
  await audit(actor.admin, actor, { action: "manual_adjustment", runId: current.data.payroll_run_id, entryId, previous: current.data, next: update.data });
  return update.data;
}

async function refreshRunTotals(admin: SupabaseClient, runId: string) {
  const entries = await admin.from("payroll_entries").select("*").eq("payroll_run_id", runId);
  if (entries.error) throw new Error(entries.error.message);
  const totals = (entries.data || []).map(toPayrollEntryDto).reduce((sum, row) => ({ gross: sum.gross + salaryRegisterGrossPay(row), net: sum.net + Number(row.net_salary), pf: sum.pf + Number(row.employer_pf), eps: sum.eps + Number(row.employer_eps) }), { gross: 0, net: 0, pf: 0, eps: 0 });
  const update = await admin.from("payroll_runs").update({ gross_payroll: totals.gross, net_payroll: totals.net, employer_pf_total: totals.pf, employer_eps_total: totals.eps, updated_at: new Date().toISOString() }).eq("id", runId);
  if (update.error) throw new Error(update.error.message);
}

export async function transitionPayroll(request: Request, runId: string, action: string, reason?: string) {
  const actor = await payrollActor(request); payrollAdminOnly(actor.role);
  const current = await actor.admin.from("payroll_runs").select("*").eq("id", runId).single();
  if (current.error) throw new Error(current.error.message);
  const nextByAction: Record<string, { from: string[]; to: string }> = {
    approve: { from: ["draft", "under_review"], to: "approved" },
    submit: { from: ["approved", "locked"], to: "published" },
  };
  const transition = nextByAction[action];
  if (!transition || !transition.from.includes(current.data.status)) throw new Error(`Cannot ${action} payroll in ${current.data.status} status`);
  const now = new Date().toISOString();
  const fields: Record<string, unknown> = { status: transition.to, updated_at: now, updated_by: actor.userId };
  if (action === "approve") Object.assign(fields, { approved_at: now, approved_by: actor.userId });
  if (action === "submit") Object.assign(fields, { locked_at: now, locked_by: actor.userId, published_at: now, published_by: actor.userId });
  const update = await actor.admin.from("payroll_runs").update(fields).eq("id", runId).select("*").single();
  if (update.error) throw new Error(update.error.message);
  const entries = await actor.admin.from("payroll_entries").update({ status: transition.to, published_at: action === "submit" ? now : null, updated_at: now }).eq("payroll_run_id", runId);
  if (entries.error) throw new Error(entries.error.message);
  const auditAction: Record<string, string> = { approve: "payroll_approved", submit: "payroll_submitted" };
  await audit(actor.admin, actor, { action: auditAction[action], runId, reason, previous: current.data, next: update.data });
  return update.data;
}

export async function cancelPayroll(request: Request, runId: string, reason: string) {
  const actor = await payrollActor(request); payrollAdminOnly(actor.role);
  if (!reason.trim()) throw new Error("A cancellation reason is required");
  const current = await actor.admin.from("payroll_runs").select("*").eq("id", runId).single();
  if (current.error) throw new Error(current.error.message);
  await audit(actor.admin, actor, { action: "payroll_cancelled", runId, reason, previous: current.data });
  const removed = await actor.admin.from("payroll_runs").delete().eq("id", runId);
  if (removed.error) throw new Error(removed.error.message);
  return { cancelled: true, runId };
}

export async function savePayrollSettings(request: Request, input: Partial<PayrollSettings>) {
  const actor = await payrollActor(request); payrollAdminOnly(actor.role);
  const previous = await settings(actor.admin);
  const update = await actor.admin.from("payroll_settings").update({ period_start_day: input.period_start_day, period_end_day: input.period_end_day, professional_tax_threshold: input.professional_tax_threshold, professional_tax_amount: input.professional_tax_amount, conveyance_allowance: input.conveyance_allowance, payslip_distribution_method: input.payslip_distribution_method, payslip_password_protection: input.payslip_password_protection, payslip_password_rule: input.payslip_password_rule, payslip_email_subject: input.payslip_email_subject, payslip_email_template: input.payslip_email_template, updated_at: new Date().toISOString(), updated_by: actor.userId }).eq("singleton_key", true).select("*").single();
  if (update.error) throw new Error(update.error.message);
  await audit(actor.admin, actor, { action: "payroll_settings_changed", previous, next: update.data });
  return update.data;
}

export async function savePayrollBankSettings(request: Request, input: CompanyPayrollBankDetails) {
  const actor = await payrollActor(request); financePayrollOnly(actor.role);
  const normalize = (value: string | null | undefined) => String(value || "").trim() || null;
  const branchCode = normalize(input.payroll_bank_branch_code);
  const currency = normalize(input.payroll_bank_currency)?.toUpperCase() || "INR";
  if (branchCode && /[|^\r\n]/.test(branchCode)) throw new Error("Branch Code contains an unsupported character");
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter code such as INR");
  const previous = await actor.admin.from("company_settings").select(payrollBankFields).eq("singleton_key", true).maybeSingle();
  if (previous.error) throw new Error(previous.error.message);
  const payload = {
    singleton_key: true,
    payroll_bank_customer_id: normalize(input.payroll_bank_customer_id),
    payroll_bank_account_number: normalize(input.payroll_bank_account_number),
    payroll_bank_ifsc_code: normalize(input.payroll_bank_ifsc_code)?.toUpperCase() || null,
    payroll_bank_branch_code: branchCode,
    payroll_bank_currency: currency,
    updated_at: new Date().toISOString(),
    updated_by: actor.userId,
  };
  const saved = await actor.admin.from("company_settings").upsert(payload, { onConflict: "singleton_key" }).select(payrollBankFields).single();
  if (saved.error) throw new Error(saved.error.message);
  await audit(actor.admin, actor, { action: "payroll_bank_settings_changed", previous: previous.data, next: saved.data });
  return saved.data as CompanyPayrollBankDetails;
}

export async function exportPayrollBankTransfer(request: Request, runId: string) {
  const actor = await payrollActor(request); financePayrollOnly(actor.role);
  const runResult = await actor.admin.from("payroll_runs").select("*").eq("id", runId).single();
  if (runResult.error) throw new Error(runResult.error.message);
  const entriesResult = await actor.admin.from("payroll_entries").select("*").eq("payroll_run_id", runId).order("employee_code");
  if (entriesResult.error) throw new Error(entriesResult.error.message);
  const entries = (entriesResult.data || []).map(toPayrollEntryDto);
  const employeeIds = entries.map((entry) => entry.employee_id);
  const [bankResult, companyResult] = await Promise.all([
    employeeIds.length
      ? actor.admin.from("employee_finance_details").select("employee_id,bank_account_number,bank_name,ifsc_code,branch_name").in("employee_id", employeeIds)
      : Promise.resolve({ data: [], error: null }),
    actor.admin.from("company_settings").select(payrollBankFields).eq("singleton_key", true).maybeSingle(),
  ]);
  const failure = bankResult.error || companyResult.error;
  if (failure) throw new Error(failure.message);
  const run = { ...runResult.data, entries } as PayrollRun;
  const content = buildBankTransferFile(run, (bankResult.data || []) as EmployeeBankDetails[], (companyResult.data || {}) as CompanyPayrollBankDetails);
  const total = entries.reduce((sum, entry) => sum + Math.round(Number(entry.net_salary || 0)), 0);
  await audit(actor.admin, actor, {
    action: "bank_transfer_file_exported",
    runId,
    next: {
      payroll_month: run.payroll_month,
      employee_count: entries.length,
      total_amount: total,
      salary_processing_date: run.processing_date,
    },
  });
  return { content, filename: bankTransferFilename(run.payroll_month) };
}
