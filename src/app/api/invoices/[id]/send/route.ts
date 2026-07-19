import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createElement, type ReactElement } from "react";
import { InvoicePdfDocument } from "@/components/invoices/InvoicePdfDocument";
import { getGmailClient, GOOGLE_WORKSPACE_SENDER } from "@/lib/google/gmail";
import {
  loadCompanyLogo,
  loadCompanySettings,
} from "@/lib/settings/companySettings";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type SendInvoiceBody = {
  to?: unknown;
  cc?: unknown;
  subject?: unknown;
  message?: unknown;
  repairOnly?: unknown;
  gmailMessageId?: unknown;
  recipient?: unknown;
  invoiceNumber?: unknown;
};

function applyInvoiceNumber(value: string, invoiceNumber: number) {
  return value
    .replaceAll("{{invoice_number}}", String(invoiceNumber))
    .replaceAll("#null", `#${invoiceNumber}`);
}

type ClientContact = {
  email: string;
  contact_type: string | null;
  is_primary: boolean;
  is_active: boolean;
};

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeEmails(value: unknown) {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return Array.from(
    new Map(
      values
        .filter((email): email is string => typeof email === "string")
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatMoney(currency: string, value: number) {
  return `${currency} ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function encodeMimeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;
}

function wrapBase64(value: Buffer | string) {
  const encoded = Buffer.isBuffer(value)
    ? value.toString("base64")
    : Buffer.from(value, "utf8").toString("base64");

  return encoded.match(/.{1,76}/g)?.join("\r\n") || "";
}

function encodeBase64Url(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function firstReminderAt(
  dueDate: string,
  beforeDueDays: number[],
  afterDueDays: number[],
) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const offsets = [
    ...beforeDueDays.map((days) => -Math.abs(Number(days))),
    ...afterDueDays.map((days) => Math.abs(Number(days))),
  ];
  const candidates = offsets
    .map((offset) => {
      const date = new Date(`${dueDate}T00:00:00+05:30`);
      date.setDate(date.getDate() + offset);
      return date;
    })
    .filter(
      (date) =>
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(date) >= today,
    )
    .sort((first, second) => first.getTime() - second.getTime());
  return candidates[0]?.toISOString() || null;
}

async function updateInvoiceStatus({
  adminClient,
  invoiceId,
  recipient,
  ccRecipient,
  subject,
  message,
  gmailMessageId,
  invoiceNumber,
}: {
  adminClient: SupabaseClient;
  invoiceId: string;
  recipient: string;
  ccRecipient: string | null;
  subject: string;
  message: string;
  gmailMessageId: string | null;
  invoiceNumber: number;
}) {
  const sentAt = new Date().toISOString();
  const { data: scheduleInvoice, error: scheduleError } = await adminClient
    .from("invoices")
    .select("due_date")
    .eq("id", invoiceId)
    .single();

  if (scheduleError || !scheduleInvoice) {
    console.error("Invoice reminder schedule lookup failed:", scheduleError);
    return {
      updatedInvoice: null,
      errorResponse: Response.json(
        { error: "Unable to initialize invoice reminder schedule" },
        { status: 500 },
      ),
    };
  }
  const companySettings = await loadCompanySettings(adminClient);

  const { data: updatedInvoice, error: updateError } = await adminClient
    .from("invoices")
    .update({
      invoice_number: invoiceNumber,
      status: "sent",
      sent_at: sentAt,
      sent_to: recipient,
      sent_cc: ccRecipient,
      email_subject: subject,
      email_body: message,
      gmail_message_id: gmailMessageId,
      reminders_enabled: true,
      reminders_stopped_at: null,
      reminders_stopped_by: null,
      reminders_stop_reason: null,
      reminder_count: 0,
      last_reminder_sent_at: null,
      next_reminder_at: firstReminderAt(
        scheduleInvoice.due_date,
        companySettings.default_reminder_before_due_days,
        companySettings.default_reminder_after_due_days,
      ),
    })
    .eq("id", invoiceId)
    .select(
      "id, invoice_number, status, sent_at, sent_to, sent_cc, gmail_message_id, reminders_enabled, reminder_count, last_reminder_sent_at, next_reminder_at",
    )
    .single();

  if (updateError) {
    console.error("Invoice status update failed:", {
      message: updateError.message,
      details: updateError.details,
      hint: updateError.hint,
      code: updateError.code,
      invoiceId,
    });

    return {
      updatedInvoice: null,
      errorResponse: Response.json(
        {
          error: "Email sent, but invoice status could not be updated",
          databaseError: updateError.message,
          gmailMessageId,
          ccRecipient,
          emailWasSent: true,
        },
        { status: 500 },
      ),
    };
  }

  return { updatedInvoice, errorResponse: null };
}

async function recordInvoiceActivity({
  adminClient,
  invoiceId,
  recipient,
  createdAt,
}: {
  adminClient: SupabaseClient;
  invoiceId: string;
  recipient: string;
  createdAt: string;
}) {
  const description = `Invoice emailed to ${recipient}`;
  const { error: activityError } = await adminClient
    .from("invoice_activities")
    .insert({
      invoice_id: invoiceId,
      event_type: "email_sent",
      description,
      recipient,
      created_at: createdAt,
    });

  if (activityError) {
    console.error("Invoice activity insert failed:", activityError);
  }

  return description;
}

function buildEmailHtml({
  invoiceNumber,
  clientName,
  amount,
  dueDate,
  message,
  companyName,
  businessEmail,
  website,
  paymentUrl,
}: {
  invoiceNumber: number;
  clientName: string;
  amount: string;
  dueDate: string;
  message: string;
  companyName: string;
  businessEmail: string;
  website: string;
  paymentUrl: string | null;
}) {
  const formattedMessage = escapeHtml(message).replaceAll("\n", "<br />");

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
          <tr><td style="padding:28px 34px 22px;border-bottom:1px solid #e5e7eb;">
            <img src="cid:despacho-logo" alt="${escapeHtml(companyName)}" width="180" style="display:block;width:180px;height:auto;" />
          </td></tr>
          <tr><td style="padding:30px 34px;">
            <div style="font-size:12px;font-weight:700;letter-spacing:1px;color:#153e90;text-transform:uppercase;">Invoice #${invoiceNumber}</div>
            <h1 style="margin:8px 0 6px;font-size:25px;line-height:1.2;color:#0f172a;">Invoice for ${escapeHtml(clientName)}</h1>
            <p style="margin:0 0 22px;font-size:13px;color:#6b7280;">The PDF invoice is attached to this email.</p>
            <div style="font-size:15px;line-height:1.65;color:#475569;">${formattedMessage}</div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:26px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;">
              <tr>
                <td style="padding:16px 18px;color:#6b7280;font-size:12px;">Total amount</td>
                <td align="right" style="padding:16px 18px;color:#153e90;font-size:15px;font-weight:700;">${escapeHtml(amount)}</td>
              </tr>
              <tr>
                <td style="padding:0 18px 16px;color:#6b7280;font-size:12px;">Due date</td>
                <td align="right" style="padding:0 18px 16px;color:#0f172a;font-size:13px;font-weight:700;">${escapeHtml(dueDate)}</td>
              </tr>
            </table>
            ${paymentUrl ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px auto 0"><tr><td style="border-radius:12px;background:#153e90"><a href="${escapeHtml(paymentUrl)}" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700">Pay Invoice</a></td></tr></table><p style="margin:16px 0 0;font-size:11px;line-height:1.5;color:#94a3b8;word-break:break-all">${escapeHtml(paymentUrl)}</p>` : ""}
          </td></tr>
          <tr><td style="padding:22px 34px;background:#0f172a;color:#ffffff;">
            <div style="font-size:12px;font-weight:700;margin-bottom:6px;">Questions?</div>
            <div style="font-size:12px;line-height:1.6;color:#cbd5e1;">
              <a href="mailto:${escapeHtml(businessEmail)}" style="color:#ffffff;text-decoration:none;">${escapeHtml(businessEmail)}</a><br />
              <a href="${escapeHtml(website)}" style="color:#ffffff;text-decoration:none;">${escapeHtml(website)}</a>
            </div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function buildRawMimeMessage({
  to,
  cc,
  subject,
  html,
  message,
  pdf,
  pdfFilename,
  logo,
  companyName,
}: {
  to: string[];
  cc: string[];
  subject: string;
  html: string;
  message: string;
  pdf: Buffer;
  pdfFilename: string;
  logo: Buffer;
  companyName: string;
}) {
  const mixedBoundary = `mixed_${crypto.randomUUID()}`;
  const relatedBoundary = `related_${crypto.randomUUID()}`;
  const alternativeBoundary = `alternative_${crypto.randomUUID()}`;
  const lines = [
    `From: ${encodeMimeHeader(companyName)} <${GOOGLE_WORKSPACE_SENDER}>`,
    `To: ${to.join(", ")}`,
    ...(cc.length ? [`Cc: ${cc.join(", ")}`] : []),
    `Subject: ${encodeMimeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
    `--${mixedBoundary}`,
    `Content-Type: multipart/related; boundary="${relatedBoundary}"`,
    "",
    `--${relatedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(message),
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(html),
    "",
    `--${alternativeBoundary}--`,
    "",
    `--${relatedBoundary}`,
    'Content-Type: image/png; name="despacho-logo.png"',
    "Content-Transfer-Encoding: base64",
    'Content-Disposition: inline; filename="despacho-logo.png"',
    "Content-ID: <despacho-logo>",
    "",
    wrapBase64(logo),
    "",
    `--${relatedBoundary}--`,
    "",
    `--${mixedBoundary}`,
    `Content-Type: application/pdf; name="${pdfFilename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${pdfFilename}"`,
    "",
    wrapBase64(pdf),
    "",
    `--${mixedBoundary}--`,
    "",
  ];

  return lines.join("\r\n");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = authHeader.slice(7);
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(accessToken);

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error("Invoice send service-role configuration is missing");
      return Response.json(
        { error: "Invoice email service is not configured" },
        { status: 500 },
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      console.error("Invoice send profile lookup failed:", profileError);
      return Response.json(
        { error: "Unable to verify permissions" },
        { status: 500 },
      );
    }

    if (
      String(profile?.role || "")
        .trim()
        .toLowerCase() !== "super admin"
    ) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: SendInvoiceBody;
    try {
      body = (await request.json()) as SendInvoiceBody;
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { id: invoiceId } = await params;
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (body.repairOnly === true) {
      const gmailMessageId =
        typeof body.gmailMessageId === "string"
          ? body.gmailMessageId.trim()
          : "";
      const recipient =
        typeof body.recipient === "string" ? body.recipient.trim() : "";
      const repairCc = normalizeEmails(body.cc);
      const invoiceNumber = Number(body.invoiceNumber);

      if (
        !gmailMessageId ||
        !recipient ||
        !subject ||
        !message ||
        !Number.isSafeInteger(invoiceNumber) ||
        invoiceNumber <= 0
      ) {
        return Response.json(
          { error: "Repair details are incomplete" },
          { status: 400 },
        );
      }
      const numberedSubject = applyInvoiceNumber(subject, invoiceNumber);
      const numberedMessage = applyInvoiceNumber(message, invoiceNumber);

      const { updatedInvoice, errorResponse } = await updateInvoiceStatus({
        adminClient,
        invoiceId,
        recipient,
        ccRecipient: repairCc.length ? repairCc.join(", ") : null,
        subject: numberedSubject,
        message: numberedMessage,
        gmailMessageId,
        invoiceNumber,
      });

      if (errorResponse) return errorResponse;

      const description = await recordInvoiceActivity({
        adminClient,
        invoiceId,
        recipient,
        createdAt: updatedInvoice.sent_at,
      });

      return Response.json({
        success: true,
        repairOnly: true,
        invoice: {
          ...updatedInvoice,
          email_subject: numberedSubject,
          email_body: numberedMessage,
        },
        activity: {
          description,
          created_at: updatedInvoice.sent_at,
        },
      });
    }

    const to = normalizeEmails(body.to);
    const cc = normalizeEmails(body.cc).filter(
      (email) =>
        !to.some(
          (recipient) => recipient.toLowerCase() === email.toLowerCase(),
        ),
    );

    if (
      to.length === 0 ||
      to.some((email) => !isEmail(email)) ||
      cc.some((email) => !isEmail(email)) ||
      !subject ||
      !message
    ) {
      return Response.json(
        { error: "Enter valid recipients, subject, and message" },
        { status: 400 },
      );
    }

    const { data: invoice, error: invoiceError } = await adminClient
      .from("invoices")
      .select(
        `
        *,
        clients(
          id,
          name,
          client_contacts(email, contact_type, is_primary, is_active)
        )
      `,
      )
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    let invoiceNumber = Number(invoice.invoice_number || 0);
    if (!invoiceNumber) {
      const { data: reservedNumber, error: numberError } =
        await adminClient.rpc("reserve_invoice_number_for_send");
      invoiceNumber = Number(reservedNumber || 0);
      if (
        numberError ||
        !Number.isSafeInteger(invoiceNumber) ||
        invoiceNumber <= 0
      ) {
        console.error("Invoice number reservation failed:", numberError);
        return Response.json(
          { error: "Unable to reserve an invoice number" },
          { status: 500 },
        );
      }
    }
    const numberedInvoice = { ...invoice, invoice_number: invoiceNumber };
    const numberedSubject = applyInvoiceNumber(subject, invoiceNumber);
    const numberedMessage = applyInvoiceNumber(message, invoiceNumber);

    const contacts = (invoice.clients?.client_contacts ||
      []) as ClientContact[];
    const billingEmails = contacts
      .filter(
        (contact) =>
          contact.email &&
          contact.is_active !== false &&
          contact.contact_type?.trim().toLowerCase() === "billing",
      )
      .map((contact) => contact.email.trim());

    const primaryEmail = contacts.find(
      (contact) =>
        contact.email &&
        contact.is_active !== false &&
        (contact.is_primary ||
          contact.contact_type?.trim().toLowerCase() === "primary"),
    )?.email;

    if (billingEmails.length === 0 && !primaryEmail) {
      return Response.json(
        { error: "No billing contact is configured for this client." },
        { status: 400 },
      );
    }

    const { data: items, error: itemsError } = await adminClient
      .from("invoice_items")
      .select(
        `
        *,
        projects(id, name, project_code)
      `,
      )
      .eq("invoice_id", invoiceId);

    if (itemsError) {
      console.error("Invoice send item lookup failed:", itemsError);
      return Response.json(
        { error: "Unable to load invoice items" },
        { status: 500 },
      );
    }

    const companySettings = await loadCompanySettings(adminClient);
    const { buffer: logoBuffer, dataUrl: logoSrc } =
      await loadCompanyLogo(companySettings);
    let pdfBuffer: Buffer;

    try {
      const pdfDocument = createElement(InvoicePdfDocument, {
        invoice: numberedInvoice,
        items: items ?? [],
        logoSrc,
        companySettings,
      }) as unknown as ReactElement<DocumentProps>;

      pdfBuffer = await renderToBuffer(pdfDocument);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Invoice PDF generation failed:", message);
      return Response.json(
        { error: `PDF generation failed: ${message}` },
        { status: 500 },
      );
    }

    const pdfFilename = `Invoice-${invoiceNumber}.pdf`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    if (!appUrl) {
      return Response.json(
        { error: "NEXT_PUBLIC_APP_URL is not configured" },
        { status: 500 },
      );
    }
    const normalizedStatus = String(invoice.status || "").toLowerCase();
    if (!invoice.public_payment_token) {
      return Response.json(
        { error: "Stripe payment database migration has not been applied" },
        { status: 500 },
      );
    }
    const paymentUrl = ["paid", "void", "cancelled"].includes(normalizedStatus)
      ? null
      : `${appUrl}/pay/invoice/${invoice.public_payment_token}`;
    const messageWithPaymentLink = paymentUrl
      ? `${numberedMessage}\n\nPay Invoice: ${paymentUrl}`
      : numberedMessage;
    const html = buildEmailHtml({
      invoiceNumber,
      clientName: invoice.clients?.name || "Client",
      amount: formatMoney(invoice.currency, invoice.total_amount),
      dueDate: formatDate(invoice.due_date),
      message: numberedMessage,
      companyName: companySettings.company_name,
      businessEmail: companySettings.business_email || GOOGLE_WORKSPACE_SENDER,
      website: companySettings.website || "https://www.despacho.io",
      paymentUrl,
    });
    const rawMessage = buildRawMimeMessage({
      to,
      cc,
      subject: numberedSubject,
      html,
      message: messageWithPaymentLink,
      pdf: pdfBuffer,
      pdfFilename,
      logo: logoBuffer,
      companyName: companySettings.company_name,
    });

    let gmailMessageId: string;
    try {
      const gmail = getGmailClient();
      const gmailResponse = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: encodeBase64Url(rawMessage) },
      });

      if (!gmailResponse.data.id) {
        throw new Error("Gmail did not return a message ID.");
      }
      gmailMessageId = gmailResponse.data.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Gmail invoice send failed:", message);

      if (message === "Google service-account configuration is missing.") {
        return Response.json({ error: message }, { status: 500 });
      }

      const authenticationFailure =
        /auth|credential|delegation|unauthorized|invalid_grant/i.test(message);
      return Response.json(
        {
          error: authenticationFailure
            ? "Gmail authentication failed."
            : `Gmail send failed: ${message}`,
        },
        { status: 502 },
      );
    }

    const sentTo = to.join(", ");
    const { updatedInvoice, errorResponse } = await updateInvoiceStatus({
      adminClient,
      invoiceId,
      recipient: sentTo,
      ccRecipient: cc.length ? cc.join(", ") : null,
      subject: numberedSubject,
      message: numberedMessage,
      gmailMessageId,
      invoiceNumber,
    });

    if (errorResponse) {
      const payload = await errorResponse.json();
      return Response.json(
        { ...payload, invoiceNumber },
        { status: errorResponse.status },
      );
    }

    const description = await recordInvoiceActivity({
      adminClient,
      invoiceId,
      recipient: sentTo,
      createdAt: updatedInvoice.sent_at,
    });

    return Response.json({
      success: true,
      invoice: {
        ...updatedInvoice,
        email_subject: numberedSubject,
        email_body: numberedMessage,
      },
      activity: { description, created_at: updatedInvoice.sent_at },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Unexpected invoice send failure:", message);
    return Response.json(
      { error: `Invoice send failed: ${message}` },
      { status: 500 },
    );
  }
}
