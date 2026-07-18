"use client";

import { useState } from "react";
import type { Invoice, InvoicePayment } from "../page";
import { formatDecimalHours } from "@/lib/format-hours";

type Props = { invoice: Invoice; payments: InvoicePayment[]; isAdmin: boolean };

function formatAmount(value: number) {
  return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatPaymentMethod(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-4"><span className="text-sm font-medium text-slate-500">{label}</span><span className="max-w-[60%] text-right font-semibold text-slate-900">{children}</span></div>;
}

export default function PaymentCard({ invoice, payments, isAdmin }: Props) {
  const [copied, setCopied] = useState(false);
  const [autopayEnabled, setAutopayEnabled] = useState(
    invoice.clients?.autopay_enabled === true,
  );
  const [autopayError, setAutopayError] = useState("");
  const isPaid = invoice.status.trim().toLowerCase() === "paid";
  const reversedPayment = [...payments].reverse().find((payment) => payment.status === "reversed");
  const isReversed = Boolean(invoice.payment_reversed_at && reversedPayment);
  const displayAmount = isPaid ? Number(invoice.paid_amount ?? invoice.total_amount) : Number(invoice.total_amount);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const paymentLink = appUrl && invoice.public_payment_token
    ? `${appUrl}/pay/invoice/${invoice.public_payment_token}`
    : "";
  const payable = ["sent", "overdue"].includes(invoice.status.trim().toLowerCase());

  async function copyLink() {
    if (!paymentLink) return;
    await navigator.clipboard.writeText(paymentLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function disableAutopay() {
    setAutopayError("");
    const response = await fetch(
      `/api/public/invoices/${invoice.public_payment_token}/autopay`,
      { method: "DELETE" },
    );
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setAutopayError(result.error || "Unable to disable Autopay");
      return;
    }
    setAutopayEnabled(false);
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-bold text-slate-950">Payment</h2>
      <div className="mt-6">
        <p className={`text-xs font-semibold uppercase tracking-wide ${isPaid ? "text-emerald-600" : isReversed ? "text-red-600" : "text-slate-400"}`}>
          {isPaid ? "Paid" : isReversed ? "Payment Reversed" : "Outstanding"}
        </p>
        <h3 className={`mt-2 text-3xl font-bold ${isPaid ? "text-emerald-700" : "text-slate-950"}`}>
          {invoice.currency} {formatAmount(displayAmount)}
        </h3>
      </div>

      <div className="mt-6 space-y-4 border-t border-slate-200 pt-6">
        {isReversed && reversedPayment ? <>
          <Row label="Original Amount">{reversedPayment.currency} {formatAmount(reversedPayment.amount)}</Row>
          <Row label="Payment Method">{formatPaymentMethod(reversedPayment.payment_method)}</Row>
          <Row label="Original Payment Date">{formatDate(reversedPayment.payment_date)}</Row>
          {reversedPayment.reversed_at ? <Row label="Reversed Date">{formatDate(reversedPayment.reversed_at)}</Row> : null}
          <Row label="Reason">{reversedPayment.reversal_reason || invoice.payment_reversal_reason}</Row>
        </> : null}

        {isPaid && invoice.paid_at ? <Row label="Payment Date">{formatDate(invoice.paid_at)}</Row> : null}
        {isPaid && invoice.payment_method ? <Row label="Payment Method">{formatPaymentMethod(invoice.payment_method)}</Row> : null}
        {isPaid && invoice.payment_reference ? <Row label="Reference"><span className="break-all">{invoice.payment_reference}</span></Row> : null}
        <Row label="Hours Purchased">{formatDecimalHours(invoice.hours_purchased)}</Row>
        <Row label="Status"><span className="capitalize">{invoice.status}</span></Row>
        <Row label="Stripe Status"><span className="capitalize">{invoice.stripe_checkout_status || "Not started"}</span></Row>
        {invoice.stripe_payment_intent_id ? <Row label="PaymentIntent"><span className="font-mono text-xs">{`${invoice.stripe_payment_intent_id.slice(0, 10)}…${invoice.stripe_payment_intent_id.slice(-4)}`}</span></Row> : null}
        <Row label="Autopay">{autopayEnabled ? "Enabled" : "Disabled"}</Row>
      </div>

      {invoice.payment_failure_message ? <p className="mt-5 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{invoice.payment_failure_message}</p> : null}
      {autopayError ? <p className="mt-3 text-xs font-semibold text-red-600">{autopayError}</p> : null}
      {isAdmin && payable && paymentLink ? (
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void copyLink()} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-[#153E90] hover:bg-blue-50">{copied ? "Copied" : "Copy Link"}</button>
          <a href={paymentLink} target="_blank" rel="noreferrer" className="rounded-xl bg-slate-950 px-3 py-2.5 text-center text-xs font-bold text-white">Open Payment Page</a>
        </div>
      ) : null}
      {isAdmin && autopayEnabled ? <button type="button" onClick={() => void disableAutopay()} className="mt-3 w-full rounded-xl border border-red-200 px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50">Disable Autopay</button> : null}
    </div>
  );
}
