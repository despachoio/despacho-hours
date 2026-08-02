import "server-only";

import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { InvoicePdfDocument } from "@/components/invoices/InvoicePdfDocument";
import {
  createDespachoLogoAttachment,
  GOOGLE_WORKSPACE_SENDER,
  INVOICE_SENDER_NAME,
  sendEmail,
} from "@/lib/email";
import { buildInvoiceEmail } from "@/lib/email/templates/invoice";
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
function applyInvoiceNumber(value: string, invoiceNumber: number) {
  return value
    .replaceAll("{{invoice_number}}", String(invoiceNumber))
    .replaceAll("#null", `#${invoiceNumber}`);
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
  let invoiceNumber = Number(invoice.invoice_number || 0);
  if (!invoiceNumber) {
    const { data: reservedNumber, error: numberError } = await admin.rpc(
      "reserve_invoice_number_for_send",
    );
    invoiceNumber = Number(reservedNumber || 0);
    if (numberError || !Number.isSafeInteger(invoiceNumber) || invoiceNumber <= 0)
      throw new Error("Unable to reserve an invoice number");
  }
  const subject = applyInvoiceNumber(
    invoice.draft_email_subject ||
      `Invoice #{{invoice_number}} from ${companySettings.company_name}`,
    invoiceNumber,
  );
  const message = applyInvoiceNumber(
    invoice.draft_email_body ||
      `Hello,\n\nPlease find attached Invoice #{{invoice_number}}.\n\nKindly make payment before ${invoice.due_date}.\n\nThank you.\n\nRegards,\n${companySettings.company_name}`,
    invoiceNumber,
  );
  const numberedInvoice = { ...invoice, invoice_number: invoiceNumber };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is not configured");
  if (!invoice.public_payment_token)
    throw new Error("Stripe payment database migration has not been applied");
  const paymentUrl = `${appUrl}/pay/invoice/${invoice.public_payment_token}`;
  const textMessage = `${message}\n\nPay Invoice: ${paymentUrl}`;
  const { buffer: logo, dataUrl: logoSrc } =
    await loadCompanyLogo(companySettings);
  const pdf = await renderToBuffer(
    createElement(InvoicePdfDocument, {
      invoice: numberedInvoice,
      items: items || [],
      logoSrc,
      companySettings,
    }) as ReactElement<DocumentProps>,
  );
  const amount = `${invoice.currency} ${Number(invoice.total_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const dueDate = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${invoice.due_date}T00:00:00Z`));
  const html = buildInvoiceEmail({
    invoiceNumber,
    clientName: invoice.clients?.name || "Client",
    amount,
    dueDate,
    message,
    companyName: companySettings.company_name,
    businessEmail: companySettings.business_email || GOOGLE_WORKSPACE_SENDER,
    website: companySettings.website || "https://www.despacho.io",
    paymentUrl,
  });
  const gmailMessageId = await sendEmail({
    senderName: INVOICE_SENDER_NAME,
    to,
    cc,
    subject,
    text: textMessage,
    html,
    attachments: [
      createDespachoLogoAttachment(logo),
      {
        filename: `Invoice-${invoiceNumber}.pdf`,
        contentType: "application/pdf",
        content: pdf,
      },
    ],
  });
  const sentAt = new Date().toISOString();
  const nextReminderAt = firstReminderAt(
    invoice.due_date,
    companySettings.default_reminder_before_due_days,
    companySettings.default_reminder_after_due_days,
  );
  const update = await admin
    .from("invoices")
    .update({
      invoice_number: invoiceNumber,
      status: "sent",
      sent_at: sentAt,
      sent_to: to.join(", "),
      sent_cc: cc.length ? cc.join(", ") : null,
      email_subject: subject,
      email_body: message,
      gmail_message_id: gmailMessageId,
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
  return { gmailMessageId };
}
