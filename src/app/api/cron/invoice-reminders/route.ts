import { readFile } from "fs/promises";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { getGmailClient, GOOGLE_WORKSPACE_SENDER } from "@/lib/google/gmail";

const BUSINESS_TIMEZONE = "Asia/Kolkata";
const BUSINESS_OFFSET = "+05:30";

function businessDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}
function atBusinessMidnight(date: string) { return new Date(`${date}T00:00:00${BUSINESS_OFFSET}`); }
function addDays(date: string, days: number) { const value = atBusinessMidnight(date); value.setUTCDate(value.getUTCDate() + days); return value; }
function daysBetween(first: string, second: string) { return Math.round((atBusinessMidnight(second).getTime() - atBusinessMidnight(first).getTime()) / 86_400_000); }
function escapeHtml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function encodeHeader(value: string) { return `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`; }
function base64Url(value: string) { return Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function emails(value: string | null) { return (value || "").split(",").map((email) => email.trim()).filter(Boolean); }
function formatMoney(currency: string, amount: number) { return `${currency} ${Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function formatDate(date: string) { return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }).format(new Date(`${date}T00:00:00Z`)); }

function rawReminder({ to, cc, subject, text, html, logo }: { to: string[]; cc: string[]; subject: string; text: string; html: string; logo: Buffer }) {
  const related = `related_${crypto.randomUUID()}`;
  const alternative = `alternative_${crypto.randomUUID()}`;
  const lines = [
    `From: Despacho Inc. <${GOOGLE_WORKSPACE_SENDER}>`,
    `To: ${to.join(", ")}`,
    ...(cc.length ? [`Cc: ${cc.join(", ")}`] : []),
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/related; boundary="${related}"`, "",
    `--${related}`,
    `Content-Type: multipart/alternative; boundary="${alternative}"`, "",
    `--${alternative}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(text).toString("base64"),
    `--${alternative}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(html).toString("base64"),
    `--${alternative}--`,
    `--${related}`, "Content-Type: image/png; name=despacho-logo.png", "Content-Transfer-Encoding: base64", "Content-ID: <despacho-logo>", "Content-Disposition: inline; filename=despacho-logo.png", "", logo.toString("base64"),
    `--${related}--`, "",
  ];
  return base64Url(lines.join("\r\n"));
}

function reminderContent(invoice: { invoice_number: number; currency: string; total_amount: number; due_date: string; clients: { name: string } | { name: string }[] | null }, reminderNumber: number, daysOverdue: number) {
  const client = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients;
  const clientName = client?.name || "Client";
  const amount = formatMoney(invoice.currency, invoice.total_amount);
  const dueDate = formatDate(invoice.due_date);
  const subject = reminderNumber === 1
    ? `Friendly Reminder: Invoice #${invoice.invoice_number} is overdue`
    : `Payment Reminder #${reminderNumber}: Invoice #${invoice.invoice_number} is overdue`;
  const text = reminderNumber === 1
    ? `Hi ${clientName},\n\nThis is a friendly reminder that Invoice #${invoice.invoice_number} for ${amount} was due on ${dueDate}.\n\nPlease arrange payment at your earliest convenience. If payment has already been made, please disregard this message.\n\nThank you.\n\nRegards,\nDespacho Inc.`
    : `Hi ${clientName},\n\nThis is reminder #${reminderNumber} that Invoice #${invoice.invoice_number} for ${amount} was due on ${dueDate} and remains outstanding.\n\nPlease arrange payment at your earliest convenience or let us know if payment has already been made.\n\nThank you.\n\nRegards,\nDespacho Inc.`;
  const html = `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a"><table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 16px"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#fff;border:1px solid #e5e7eb;border-radius:16px"><tr><td style="padding:26px 32px;border-bottom:1px solid #e5e7eb"><img src="cid:despacho-logo" width="180" alt="Despacho"></td></tr><tr><td style="padding:30px 32px"><div style="font-size:12px;font-weight:700;color:#153e90;text-transform:uppercase">Reminder #${reminderNumber}</div><h1 style="font-size:24px">Invoice #${invoice.invoice_number} is overdue</h1><p style="font-size:15px;line-height:1.7;color:#475569">${escapeHtml(text).replaceAll("\n", "<br>")}</p><table width="100%" style="margin-top:24px;background:#f8fafc;border-radius:10px"><tr><td style="padding:14px;color:#6b7280">Amount</td><td align="right" style="padding:14px;font-weight:700;color:#153e90">${escapeHtml(amount)}</td></tr><tr><td style="padding:0 14px 14px;color:#6b7280">Due date</td><td align="right" style="padding:0 14px 14px;font-weight:700">${escapeHtml(dueDate)}</td></tr><tr><td style="padding:0 14px 14px;color:#6b7280">Days overdue</td><td align="right" style="padding:0 14px 14px;font-weight:700;color:#b91c1c">${daysOverdue}</td></tr></table></td></tr><tr><td style="padding:20px 32px;background:#0f172a;color:#cbd5e1;font-size:12px">Questions? <a href="mailto:sales@despacho.io" style="color:#93c5fd">sales@despacho.io</a><br>www.despacho.io</td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized cron request" }, { status: 401 });
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) return Response.json({ error: "Reminder service is not configured" }, { status: 500 });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date();
  const today = businessDate(now);
  const { data: invoices, error } = await admin.from("invoices").select("id,invoice_number,status,due_date,currency,total_amount,sent_to,sent_cc,reminders_enabled,reminder_count,next_reminder_at,clients(name)").in("status", ["sent", "overdue"]).eq("reminders_enabled", true).lte("next_reminder_at", now.toISOString()).not("sent_to", "is", null);
  if (error) return Response.json({ error: `Reminder query failed: ${error.message}` }, { status: 500 });

  const summary = { processed: invoices?.length || 0, sent: 0, failed: 0, skipped: 0 };
  const logo = await readFile(path.join(process.cwd(), "public", "despacho-logo-full.png"));
  for (const invoice of invoices || []) {
    try {
      const { data: latest } = await admin.from("invoices").select("status,reminders_enabled,next_reminder_at,sent_to,sent_cc,reminder_count").eq("id", invoice.id).single();
      if (!latest || !["sent", "overdue"].includes(String(latest.status).toLowerCase()) || latest.reminders_enabled !== true || !latest.next_reminder_at) { summary.skipped++; continue; }
      if (invoice.due_date >= today) { summary.skipped++; continue; }

      const scheduledFor = businessDate(new Date(latest.next_reminder_at));
      const reminderNumber = Number(latest.reminder_count || 0) + 1;
      const to = emails(latest.sent_to);
      const cc = emails(latest.sent_cc);
      const content = reminderContent(invoice, reminderNumber, daysBetween(invoice.due_date, today));
      const reservation = { invoice_id: invoice.id, sent_to: to.join(", "), cc: cc.length ? cc.join(", ") : null, subject: content.subject, message: content.text, reminder_number: reminderNumber, scheduled_for: scheduledFor, send_type: "automatic", status: "skipped", error_message: null };
      let { data: reminder, error: reserveError } = await admin.from("invoice_reminders").insert(reservation).select("id,status").single();
      if (reserveError?.code === "23505") {
        const { data: existing } = await admin.from("invoice_reminders").select("id,status").eq("invoice_id", invoice.id).eq("scheduled_for", scheduledFor).eq("send_type", "automatic").single();
        if (existing?.status === "failed") {
          const retry = await admin.from("invoice_reminders").update({ status: "skipped", error_message: null }).eq("id", existing.id).eq("status", "failed").select("id,status").maybeSingle();
          reminder = retry.data;
        } else reminder = null;
      }
      if (!reminder) { summary.skipped++; continue; }
      if (!to.length) {
        await admin.from("invoice_reminders").update({ status: "skipped", error_message: "Original invoice recipients are missing" }).eq("id", reminder.id);
        summary.skipped++; continue;
      }

      try {
        const gmail = getGmailClient();
        const sent = await gmail.users.messages.send({ userId: "me", requestBody: { raw: rawReminder({ to, cc, subject: content.subject, text: content.text, html: content.html, logo }) } });
        if (!sent.data.id) throw new Error("Gmail did not return a message ID.");
        const sentAt = new Date().toISOString();
        await admin.from("invoice_reminders").update({ status: "sent", gmail_message_id: sent.data.id, sent_at: sentAt, error_message: null }).eq("id", reminder.id);
        await admin.from("invoices").update({ status: "overdue", reminder_count: reminderNumber, last_reminder_sent_at: sentAt, next_reminder_at: addDays(scheduledFor, 2).toISOString() }).eq("id", invoice.id).eq("reminders_enabled", true);
        summary.sent++;
      } catch (sendError) {
        const message = sendError instanceof Error ? sendError.message : "Unknown error";
        await admin.from("invoice_reminders").update({ status: "failed", error_message: message, sent_at: new Date().toISOString() }).eq("id", reminder.id);
        summary.failed++;
      }
    } catch (invoiceError) {
      summary.failed++;
      console.error("Invoice reminder processing failed:", invoiceError instanceof Error ? invoiceError.message : "Unknown error");
    }
  }
  return Response.json(summary);
}

export const POST = GET;
