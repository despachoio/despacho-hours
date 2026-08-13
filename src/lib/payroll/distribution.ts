import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { KAIRO_SENDER_NAME, createDespachoLogoAttachment, sendEmail } from "@/lib/email";
import { buildPayslipEmail } from "@/lib/email/templates/payroll";
import { loadCompanyLogo, loadCompanySettings, renderSettingsTemplate } from "@/lib/settings/companySettings";
import { toPayrollEntryDto } from "./entry";
import { payslipFilename, payrollMonthLabel } from "./filenames";
import { payslipPassword, payslipPasswordDescription } from "./password";
import { generatePayslipPdf, protectPayslipPdf } from "./payslipPdf";
import type { PayrollSettings } from "./types";

type DistributionActor = { admin: SupabaseClient; userId: string; role: string };
const BUCKET = "payroll-payslips";

async function distributionSettings(admin: SupabaseClient) {
  const result = await admin.from("payroll_settings").select("*").eq("singleton_key", true).single();
  if (result.error) throw new Error(result.error.message);
  return result.data as PayrollSettings;
}

async function recordAudit(actor: DistributionActor, input: { runId: string; entryId: string; action: string; next?: unknown; reason?: string }) {
  const result = await actor.admin.from("payroll_audit_log").insert({ payroll_run_id: input.runId, payroll_entry_id: input.entryId, action: input.action, actor_user_id: actor.userId, actor_role: actor.role, reason: input.reason || null, new_value: input.next || null });
  if (result.error) throw new Error(result.error.message);
}

function emailBody(template: string, values: Record<string, string>) {
  return renderSettingsTemplate(template, values);
}

export async function distributePayslip(actor: DistributionActor, entryId: string, options: { forceRegenerate?: boolean; forceResend?: boolean; sendEmail?: boolean } = {}) {
  const entryResult = await actor.admin.from("payroll_entries").select("*").eq("id", entryId).single();
  if (entryResult.error || !entryResult.data) throw new Error("Payroll entry could not be found");
  const entry = toPayrollEntryDto(entryResult.data);
  if (entry.status !== "published" || !entry.published_at) throw new Error("Payslips can be distributed only after payroll submission");
  const [employeeResult, settings, existingResult] = await Promise.all([
    actor.admin.from("employees").select("name,email,date_of_birth").eq("id", entry.employee_id).single(),
    distributionSettings(actor.admin),
    actor.admin.from("payslip_distributions").select("*").eq("payroll_entry_id", entry.id).maybeSingle(),
  ]);
  if (existingResult.error) throw new Error(existingResult.error.message);
  if (employeeResult.error || !employeeResult.data) throw new Error("Employee contact details could not be loaded");
  if (!employeeResult.data.email) throw new Error("Employee email address is required for payslip distribution");
  const now = new Date().toISOString();
  let distribution = existingResult.data;
  if (!distribution) {
    const inserted = await actor.admin.from("payslip_distributions").upsert({ payroll_run_id: entry.payroll_run_id, payroll_entry_id: entry.id, employee_id: entry.employee_id }, { onConflict: "payroll_entry_id" }).select("*").single();
    if (inserted.error) throw new Error(inserted.error.message);
    distribution = inserted.data;
  }
  if (distribution.email_status === "completed" && !options.forceResend && !options.forceRegenerate) return distribution;

  const password = settings.payslip_password_protection ? payslipPassword(settings.payslip_password_rule, entry.employee_code, employeeResult.data.date_of_birth) : "";
  let pdf: Buffer | null = null;
  let brand: Awaited<ReturnType<typeof generatePayslipPdf>> | null = null;
  let storagePath = distribution.storage_path as string | null;
  if (!storagePath || options.forceRegenerate) {
    await actor.admin.from("payslip_distributions").update({ payslip_status: "generating", email_error: null, updated_at: now }).eq("id", distribution.id);
    try {
      brand = await generatePayslipPdf(actor.admin, entry);
      pdf = settings.payslip_password_protection ? await protectPayslipPdf(brand.pdf, password) : brand.pdf;
      storagePath = `${entry.payroll_run_id}/${entry.id}.pdf`;
      const upload = await actor.admin.storage.from(BUCKET).upload(storagePath, pdf, { contentType: "application/pdf", upsert: true });
      if (upload.error) throw new Error(upload.error.message);
      const updated = await actor.admin.from("payslip_distributions").update({ payslip_status: "generated", storage_path: storagePath, generated_by: actor.userId, generated_at: now, password_protected: settings.payslip_password_protection, email_error: null, updated_at: now }).eq("id", distribution.id).select("*").single();
      if (updated.error) throw new Error(updated.error.message);
      distribution = updated.data;
      try { await recordAudit(actor, { runId: entry.payroll_run_id, entryId: entry.id, action: options.forceRegenerate ? "payslip_regenerated" : "payslip_generated", next: { passwordProtected: settings.payslip_password_protection } }); }
      catch (auditCause) { console.error("Payslip generation audit failed", auditCause); }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Payslip generation failed";
      await actor.admin.from("payslip_distributions").update({ payslip_status: "failed", email_status: "failed", email_error: message, updated_at: now }).eq("id", distribution.id);
      await recordAudit(actor, { runId: entry.payroll_run_id, entryId: entry.id, action: "payslip_generation_failed", reason: message });
      throw new Error(message);
    }
  }
  if (!pdf && storagePath && settings.payslip_distribution_method !== "notify_only") {
    const stored = await actor.admin.storage.from(BUCKET).download(storagePath);
    if (stored.error) throw new Error(stored.error.message);
    pdf = Buffer.from(await stored.data.arrayBuffer());
  }
  if (options.sendEmail === false) return distribution;

  await actor.admin.from("payslip_distributions").update({ email_status: "sending", email_error: null, last_retry_at: options.forceResend ? now : distribution.last_retry_at, updated_at: now }).eq("id", distribution.id);
  try {
    const company = brand?.company || await loadCompanySettings(actor.admin);
    const logo = brand?.logo || await loadCompanyLogo({ ...company, invoice_logo_url: "/despacho-logo-full.png" });
    const month = payrollMonthLabel(entry.payroll_month);
    const [monthName, year] = month.split(" ");
    const description = settings.payslip_distribution_method === "notify_only" ? "Download securely from the Kairo Employee Portal" : settings.payslip_password_protection ? payslipPasswordDescription(settings.payslip_password_rule) : "Not password protected";
    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || ""}/payroll?tab=history`;
    const variables = { EmployeeName: employeeResult.data.name, PayrollMonth: month, Month: monthName, Year: year, CompanyName: company.company_name, PortalUrl: portalUrl, PasswordRuleDescription: description, AttachmentMessage: settings.payslip_distribution_method === "notify_only" ? "" : "\n\nA password-protected PDF is attached." };
    const text = emailBody(settings.payslip_email_template, variables);
    const html = buildPayslipEmail({ companyName: company.company_name, businessEmail: company.business_email || "sales@despacho.io", website: company.website || "https://www.despacho.io", employeeName: employeeResult.data.name, payrollMonth: month, portalUrl, passwordRuleDescription: description, body: text });
    const attachments = [createDespachoLogoAttachment(logo.buffer)];
    if (settings.payslip_distribution_method !== "notify_only" && pdf) attachments.push({ filename: payslipFilename(entry.employee_code, entry.payroll_month), contentType: "application/pdf", content: pdf });
    const messageId = await sendEmail({ senderName: KAIRO_SENDER_NAME, to: employeeResult.data.email, subject: emailBody(settings.payslip_email_subject, variables), text, html, attachments });
    const updated = await actor.admin.from("payslip_distributions").update({ email_status: "completed", email_message_id: messageId, email_sent_at: now, email_error: null, updated_at: now }).eq("id", distribution.id).select("*").single();
    if (updated.error) throw new Error(updated.error.message);
    try { await recordAudit(actor, { runId: entry.payroll_run_id, entryId: entry.id, action: options.forceResend ? "payslip_email_resent" : "payslip_email_sent", next: { messageId } }); }
    catch (auditCause) { console.error("Payslip email audit failed", auditCause); }
    return updated.data;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Payslip email failed";
    await actor.admin.from("payslip_distributions").update({ email_status: "failed", email_error: message, updated_at: now }).eq("id", distribution.id);
    await recordAudit(actor, { runId: entry.payroll_run_id, entryId: entry.id, action: "payslip_email_failed", reason: message });
    throw new Error(message);
  }
}

export async function distributionStatus(admin: SupabaseClient, runId: string) {
  const result = await admin.from("payslip_distributions").select("*").eq("payroll_run_id", runId).order("created_at");
  if (result.error) throw new Error(result.error.message);
  return result.data || [];
}
