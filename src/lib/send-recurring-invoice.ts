import "server-only";

import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { InvoicePdfDocument } from "@/components/invoices/InvoicePdfDocument";
import { getGmailClient, GOOGLE_WORKSPACE_SENDER } from "@/lib/google/gmail";
import {
  loadCompanyLogo,
  loadCompanySettings,
} from "@/lib/settings/companySettings";

function emails(value: string | null) {
  return (value || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}
function header(value: string) {
  return `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;
}
function base64Url(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function wrap(value: Buffer | string) {
  const encoded = Buffer.isBuffer(value)
    ? value.toString("base64")
    : Buffer.from(value).toString("base64");
  return encoded.match(/.{1,76}/g)?.join("\r\n") || "";
}
function escape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function firstReminderAt(dueDate: string, before: number[], after: number[]) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = formatter.format(new Date());
  return (
    [
      ...before.map((days) => -Math.abs(Number(days))),
      ...after.map((days) => Math.abs(Number(days))),
    ]
      .map((offset) => {
        const date = new Date(`${dueDate}T00:00:00+05:30`);
        date.setDate(date.getDate() + offset);
        return date;
      })
      .filter((date) => formatter.format(date) >= today)
      .sort((first, second) => first.getTime() - second.getTime())[0]
      ?.toISOString() || null
  );
}

export async function sendRecurringInvoice(
  admin: SupabaseClient,
  invoiceId: string,
) {
  const [
    { data: invoice, error: invoiceError },
    { data: items, error: itemError },
  ] = await Promise.all([
    admin
      .from("invoices")
      .select("*,clients(id,name)")
      .eq("id", invoiceId)
      .single(),
    admin
      .from("invoice_items")
      .select("*,projects(id,name,project_code)")
      .eq("invoice_id", invoiceId),
  ]);
  if (invoiceError || !invoice || itemError)
    throw new Error(
      invoiceError?.message ||
        itemError?.message ||
        "Generated invoice could not be loaded",
    );
  const companySettings = await loadCompanySettings(admin);
  const to = emails(invoice.draft_email_to);
  const cc = emails(invoice.draft_email_cc).filter(
    (value) => !to.includes(value),
  );
  if (!to.length)
    throw new Error("Stored recurring invoice recipients are missing");
  const subject =
    invoice.draft_email_subject ||
    `Invoice #${invoice.invoice_number} from ${companySettings.company_name}`;
  const message =
    invoice.draft_email_body ||
    `Hello,\n\nPlease find attached Invoice #${invoice.invoice_number}.\n\nKindly make payment before ${invoice.due_date}.\n\nThank you.\n\nRegards,\n${companySettings.company_name}`;
  const { buffer: logo, dataUrl: logoSrc } =
    await loadCompanyLogo(companySettings);
  const pdf = await renderToBuffer(
    createElement(InvoicePdfDocument, {
      invoice,
      items: items || [],
      logoSrc,
      companySettings,
    }) as ReactElement<DocumentProps>,
  );
  const boundary = `mixed_${crypto.randomUUID()}`;
  const alternative = `alt_${crypto.randomUUID()}`;
  const html = `<html><body style="font-family:Arial;color:#0f172a;background:#f8fafc;padding:24px"><div style="max-width:620px;margin:auto;background:#fff;padding:32px;border-radius:16px"><img src="cid:despacho-logo" width="180" alt="${escape(companySettings.company_name)}"><h2>Invoice #${invoice.invoice_number}</h2><p style="line-height:1.7;color:#475569">${escape(message).replaceAll("\n", "<br>")}</p><p style="margin-top:24px;color:#64748b;font-size:12px">Questions? ${escape(companySettings.business_email || GOOGLE_WORKSPACE_SENDER)}<br>${escape(companySettings.website || "https://www.despacho.io")}</p></div></body></html>`;
  const raw = [
    `From: ${header(companySettings.company_name)} <${GOOGLE_WORKSPACE_SENDER}>`,
    `To: ${to.join(", ")}`,
    ...(cc.length ? [`Cc: ${cc.join(", ")}`] : []),
    `Subject: ${header(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="${alternative}"`,
    "",
    `--${alternative}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap(message),
    `--${alternative}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap(html),
    `--${alternative}--`,
    `--${boundary}`,
    "Content-Type: image/png; name=despacho-logo.png",
    "Content-Transfer-Encoding: base64",
    "Content-Disposition: inline; filename=despacho-logo.png",
    "Content-ID: <despacho-logo>",
    "",
    wrap(logo),
    `--${boundary}`,
    `Content-Type: application/pdf; name="Invoice-${invoice.invoice_number}.pdf"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="Invoice-${invoice.invoice_number}.pdf"`,
    "",
    wrap(pdf),
    `--${boundary}--`,
    "",
  ].join("\r\n");
  const sent = await getGmailClient().users.messages.send({
    userId: "me",
    requestBody: { raw: base64Url(raw) },
  });
  if (!sent.data.id) throw new Error("Gmail did not return a message ID");
  const sentAt = new Date().toISOString();
  const nextReminderAt = firstReminderAt(
    invoice.due_date,
    companySettings.default_reminder_before_due_days,
    companySettings.default_reminder_after_due_days,
  );
  const update = await admin
    .from("invoices")
    .update({
      status: "sent",
      sent_at: sentAt,
      sent_to: to.join(", "),
      sent_cc: cc.length ? cc.join(", ") : null,
      email_subject: subject,
      email_body: message,
      gmail_message_id: sent.data.id,
      reminders_enabled: true,
      reminder_count: 0,
      next_reminder_at: nextReminderAt,
    })
    .eq("id", invoiceId);
  if (update.error)
    throw new Error(
      `Email sent but invoice status update failed: ${update.error.message}`,
    );
  await admin.from("invoice_activities").insert({
    invoice_id: invoiceId,
    event_type: "email_sent",
    description: `Invoice emailed to ${to.join(", ")}`,
    recipient: to.join(", "),
    created_at: sentAt,
  });
  return { gmailMessageId: sent.data.id };
}
