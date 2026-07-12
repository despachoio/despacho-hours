"use client";

import type { Invoice, InvoicePayment } from "../page";

type Props = { invoice: Invoice; payments: InvoicePayment[] };

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

export default function PaymentCard({ invoice, payments }: Props) {
  const isPaid = invoice.status.trim().toLowerCase() === "paid";
  const reversedPayment = [...payments].reverse().find((payment) => payment.status === "reversed");
  const isReversed = Boolean(invoice.payment_reversed_at && reversedPayment);
  const displayAmount = isPaid ? Number(invoice.paid_amount ?? invoice.total_amount) : Number(invoice.total_amount);

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
        <Row label="Hours Purchased">{Number(invoice.hours_purchased).toFixed(2)}</Row>
        <Row label="Status"><span className="capitalize">{invoice.status}</span></Row>
      </div>

      {!isPaid ? <button type="button" disabled className="mt-8 w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white opacity-50">Pay Online</button> : null}
    </div>
  );
}
