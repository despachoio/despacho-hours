import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getGmailClient, GOOGLE_WORKSPACE_SENDER } from "@/lib/google/gmail";
import { loadCompanySettings } from "@/lib/settings/companySettings";

type PaymentNotificationInvoice = {
  id: string;
  invoice_number: number;
  status: string;
  currency: string;
  total_amount: number;
  paid_amount: number | null;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  sent_to: string | null;
  sent_cc: string | null;
  receipt_sent_at: string | null;
  payment_intimation_sent_at: string | null;
  clients: { name: string } | null;
};

function normalizeEmails(value: string | null) {
  return Array.from(
    new Map(
      (value || "")
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean)
        .map((email) => [email.toLowerCase(), email]),
    ).values(),
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function encodeMimeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;
}

function wrapBase64(value: string) {
  return (
    Buffer.from(value, "utf8")
      .toString("base64")
      .match(/.{1,76}/g)
      ?.join("\r\n") || ""
  );
}

function encodeBase64Url(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function formatMoney(currency: string, value: number) {
  return `${currency} ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(value));
}

function paymentMethod(value: string | null) {
  return (value || "Payment")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function sendEmail({
  to,
  cc = [],
  subject,
  text,
  html,
  companyName,
}: {
  to: string[];
  cc?: string[];
  subject: string;
  text: string;
  html: string;
  companyName: string;
}) {
  const boundary = `alternative_${crypto.randomUUID()}`;
  const raw = [
    `From: ${encodeMimeHeader(companyName)} <${GOOGLE_WORKSPACE_SENDER}>`,
    `To: ${to.join(", ")}`,
    ...(cc.length ? [`Cc: ${cc.join(", ")}`] : []),
    `Subject: ${encodeMimeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
  const response = await getGmailClient().users.messages.send({
    userId: "me",
    requestBody: { raw: encodeBase64Url(raw) },
  });
  if (!response.data.id) throw new Error("Gmail did not return a message ID");
  return response.data.id;
}

async function recordActivity(
  admin: SupabaseClient,
  invoiceId: string,
  eventType: string,
  description: string,
) {
  const result = await admin.from("invoice_activities").insert({
    invoice_id: invoiceId,
    event_type: eventType,
    description,
    created_at: new Date().toISOString(),
  });
  if (result.error) {
    console.error("Payment notification activity insert failed", {
      invoiceId,
      eventType,
      error: result.error.message,
    });
  }
}

export async function enableInvoicePaymentNotifications(
  admin: SupabaseClient,
  invoiceId: string,
) {
  const result = await admin
    .from("invoices")
    .update({
      payment_notification_eligible: true,
      payment_notification_status: "pending",
      payment_notification_claimed_at: null,
      payment_notification_error: null,
    })
    .eq("id", invoiceId);

  if (result.error) {
    throw new Error(
      `Payment receipt eligibility could not be enabled: ${result.error.message}`,
    );
  }
}

export async function sendInvoicePaymentNotifications(
  admin: SupabaseClient,
  invoiceId: string,
) {
  const claim = await admin.rpc("claim_invoice_payment_notification", {
    p_invoice_id: invoiceId,
  });
  if (claim.error) {
    console.error("Payment notification claim failed", {
      invoiceId,
      error: claim.error.message,
    });
    return { sent: false, error: claim.error.message };
  }
  if (claim.data !== true) return { sent: false, skipped: true };

  const invoiceResult = await admin
    .from("invoices")
    .select(
      "id,invoice_number,status,currency,total_amount,paid_amount,paid_at,payment_method,payment_reference,sent_to,sent_cc,receipt_sent_at,payment_intimation_sent_at,clients(name)",
    )
    .eq("id", invoiceId)
    .single();
  if (invoiceResult.error || !invoiceResult.data) {
    const error = invoiceResult.error?.message || "Invoice not found";
    await admin
      .from("invoices")
      .update({
        payment_notification_status: "failed",
        payment_notification_error: error,
      })
      .eq("id", invoiceId);
    return { sent: false, error };
  }

  const invoice =
    invoiceResult.data as unknown as PaymentNotificationInvoice;
  const settings = await loadCompanySettings(admin);
  const amount = formatMoney(
    invoice.currency,
    Number(invoice.paid_amount ?? invoice.total_amount),
  );
  const paidOn = formatDate(invoice.paid_at);
  const method = paymentMethod(invoice.payment_method);
  const reference = invoice.payment_reference?.trim() || "Not provided";
  const clientName = invoice.clients?.name || "Client";
  const invoiceLabel = `Invoice #${invoice.invoice_number}`;
  const errors: string[] = [];

  if (!invoice.receipt_sent_at) {
    try {
      const to = normalizeEmails(invoice.sent_to);
      const cc = normalizeEmails(invoice.sent_cc).filter(
        (email) =>
          !to.some(
            (recipient) => recipient.toLowerCase() === email.toLowerCase(),
          ),
      );
      if (!to.length) throw new Error("Original invoice recipients are missing");
      const receiptText = `Hello,

We have received your payment of ${amount} for ${invoiceLabel}.

Payment date: ${paidOn}
Payment method: ${method}
Reference: ${reference}

Thank you.

Regards,
${settings.company_name}`;
      const receiptHtml = `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a"><table width="100%" cellpadding="0" cellspacing="0" style="padding:30px 16px"><tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#fff;border:1px solid #e5e7eb;border-radius:16px"><tr><td style="padding:28px 32px"><div style="font-size:12px;font-weight:700;color:#153e90;text-transform:uppercase">Payment receipt</div><h1 style="font-size:26px;margin:10px 0">${escapeHtml(invoiceLabel)}</h1><p style="color:#475569;line-height:1.7">Hello ${escapeHtml(clientName)},<br>We have received your payment. Thank you.</p><table width="100%" style="margin-top:22px;background:#f8fafc;border-radius:10px"><tr><td style="padding:14px;color:#64748b">Amount paid</td><td align="right" style="padding:14px;font-weight:700;color:#153e90">${escapeHtml(amount)}</td></tr><tr><td style="padding:0 14px 14px;color:#64748b">Payment date</td><td align="right" style="padding:0 14px 14px;font-weight:700">${escapeHtml(paidOn)}</td></tr><tr><td style="padding:0 14px 14px;color:#64748b">Payment method</td><td align="right" style="padding:0 14px 14px;font-weight:700">${escapeHtml(method)}</td></tr><tr><td style="padding:0 14px 14px;color:#64748b">Reference</td><td align="right" style="padding:0 14px 14px;font-weight:700">${escapeHtml(reference)}</td></tr></table><p style="margin-top:24px;color:#64748b">Regards,<br>${escapeHtml(settings.company_name)}</p></td></tr></table></td></tr></table></body></html>`;
      const gmailMessageId = await sendEmail({
        to,
        cc,
        subject: `Payment receipt for ${invoiceLabel}`,
        text: receiptText,
        html: receiptHtml,
        companyName: settings.company_name,
      });
      const sentAt = new Date().toISOString();
      const update = await admin
        .from("invoices")
        .update({
          receipt_sent_at: sentAt,
          receipt_sent_to: [...to, ...cc].join(", "),
          receipt_gmail_message_id: gmailMessageId,
        })
        .eq("id", invoiceId);
      if (update.error) throw new Error(update.error.message);
      invoice.receipt_sent_at = sentAt;
      await recordActivity(
        admin,
        invoiceId,
        "payment_receipt_sent",
        `Payment receipt emailed to ${[...to, ...cc].join(", ")}`,
      );
    } catch (error) {
      errors.push(
        `Client receipt: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  if (!invoice.payment_intimation_sent_at) {
    try {
      const internalRecipient =
        settings.business_email?.trim() || GOOGLE_WORKSPACE_SENDER;
      const intimationText = `Payment received

Client: ${clientName}
Invoice: ${invoiceLabel}
Amount: ${amount}
Payment date: ${paidOn}
Payment method: ${method}
Reference: ${reference}`;
      const intimationHtml = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#0f172a"><h2>Payment received</h2><table cellpadding="7" cellspacing="0"><tr><td style="color:#64748b">Client</td><td><strong>${escapeHtml(clientName)}</strong></td></tr><tr><td style="color:#64748b">Invoice</td><td><strong>${escapeHtml(invoiceLabel)}</strong></td></tr><tr><td style="color:#64748b">Amount</td><td><strong>${escapeHtml(amount)}</strong></td></tr><tr><td style="color:#64748b">Payment date</td><td>${escapeHtml(paidOn)}</td></tr><tr><td style="color:#64748b">Payment method</td><td>${escapeHtml(method)}</td></tr><tr><td style="color:#64748b">Reference</td><td>${escapeHtml(reference)}</td></tr></table></body></html>`;
      const gmailMessageId = await sendEmail({
        to: [internalRecipient],
        subject: `Payment received – ${invoiceLabel} – ${clientName}`,
        text: intimationText,
        html: intimationHtml,
        companyName: settings.company_name,
      });
      const sentAt = new Date().toISOString();
      const update = await admin
        .from("invoices")
        .update({
          payment_intimation_sent_at: sentAt,
          payment_intimation_sent_to: internalRecipient,
          payment_intimation_gmail_message_id: gmailMessageId,
        })
        .eq("id", invoiceId);
      if (update.error) throw new Error(update.error.message);
      invoice.payment_intimation_sent_at = sentAt;
      await recordActivity(
        admin,
        invoiceId,
        "payment_intimation_sent",
        `Payment intimation emailed to ${internalRecipient}`,
      );
    } catch (error) {
      errors.push(
        `Internal intimation: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  const completed = Boolean(
    invoice.receipt_sent_at && invoice.payment_intimation_sent_at,
  );
  await admin
    .from("invoices")
    .update({
      payment_notification_status: completed ? "sent" : "failed",
      payment_notification_error: errors.length ? errors.join("; ") : null,
    })
    .eq("id", invoiceId);

  if (errors.length) {
    console.error("Invoice payment notification delivery incomplete", {
      invoiceId,
      errors,
    });
  }
  return { sent: completed, errors };
}
