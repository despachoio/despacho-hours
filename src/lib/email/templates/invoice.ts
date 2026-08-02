import { buildEmailHtml, escapeHtml } from "../template";

type InvoiceEmailInput = {
  invoiceNumber: number;
  clientName: string;
  amount: string;
  dueDate: string;
  message: string;
  companyName: string;
  businessEmail: string;
  website: string;
  paymentUrl: string | null;
};

type InvoiceReminderInput = Omit<InvoiceEmailInput, "message"> & {
  reminderNumber: number;
  message: string;
  overdue: boolean;
};

type PaymentEmailInput = {
  companyName: string;
  businessEmail: string;
  website: string;
  invoiceLabel: string;
  clientName: string;
  amount: string;
  paidOn: string;
  method: string;
  reference: string;
};

export function buildInvoiceEmail(input: InvoiceEmailInput) {
  const formattedMessage = escapeHtml(input.message).replaceAll("\n", "<br />");
  return buildEmailHtml({
    companyName: input.companyName,
    businessEmail: input.businessEmail,
    website: input.website,
    eyebrow: `Invoice #${input.invoiceNumber}`,
    title: `Invoice for ${input.clientName}`,
    preheader: `${input.amount} due ${input.dueDate}`,
    introHtml: `<p style="margin:0 0 18px;font-size:13px;color:#64748b;">The PDF invoice is attached to this email.</p><div style="font-size:15px;line-height:1.7;color:#475569;">${formattedMessage}</div>`,
    details: [
      { label: "Total amount", value: input.amount, emphasis: true },
      { label: "Due date", value: input.dueDate },
    ],
    cta: input.paymentUrl ? { label: "Pay Invoice", url: input.paymentUrl } : undefined,
    bodyHtml: input.paymentUrl ? `<p style="margin:15px 0 0;font-size:11px;line-height:1.5;color:#94a3b8;word-break:break-all;">${escapeHtml(input.paymentUrl)}</p>` : "",
  });
}

export function buildInvoiceReminderEmail(input: InvoiceReminderInput) {
  return buildEmailHtml({
    companyName: input.companyName,
    businessEmail: input.businessEmail,
    website: input.website,
    eyebrow: `Reminder #${input.reminderNumber}`,
    title: `Invoice #${input.invoiceNumber} ${input.overdue ? "is overdue" : "payment reminder"}`,
    preheader: `${input.amount} was due ${input.dueDate}`,
    introHtml: `<div style="font-size:15px;line-height:1.7;color:#475569;">${escapeHtml(input.message).replaceAll("\n", "<br />")}</div>`,
    details: [
      { label: "Amount", value: input.amount, emphasis: true },
      { label: "Due date", value: input.dueDate },
    ],
    status: input.overdue
      ? { label: "Overdue", tone: "red" }
      : { label: "Payment reminder", tone: "blue" },
    cta: input.paymentUrl ? { label: "Pay Invoice", url: input.paymentUrl } : undefined,
  });
}

export function buildPaymentReceiptEmail(input: PaymentEmailInput) {
  return buildEmailHtml({
    companyName: input.companyName,
    businessEmail: input.businessEmail,
    website: input.website,
    eyebrow: "Payment receipt",
    title: input.invoiceLabel,
    preheader: `Payment of ${input.amount} received`,
    introHtml: `<p style="margin:0;color:#475569;line-height:1.7;">Hello ${escapeHtml(input.clientName)},<br />We have received your payment. Thank you.</p>`,
    status: { label: "Paid", tone: "green" },
    details: [
      { label: "Amount paid", value: input.amount, emphasis: true },
      { label: "Payment date", value: input.paidOn },
      { label: "Payment method", value: input.method },
      { label: "Reference", value: input.reference },
    ],
  });
}

export function buildPaymentIntimationEmail(input: PaymentEmailInput) {
  return buildEmailHtml({
    companyName: input.companyName,
    businessEmail: input.businessEmail,
    website: input.website,
    eyebrow: "Finance notification",
    title: "Payment received",
    preheader: `${input.clientName} paid ${input.amount}`,
    status: { label: "Payment received", tone: "green" },
    details: [
      { label: "Client", value: input.clientName },
      { label: "Invoice", value: input.invoiceLabel },
      { label: "Amount", value: input.amount, emphasis: true },
      { label: "Payment date", value: input.paidOn },
      { label: "Payment method", value: input.method },
      { label: "Reference", value: input.reference },
    ],
  });
}
