"use client";

import { Invoice } from "../page";

type Props = {
  invoice: Invoice;
};

function formatAmount(value: number) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatPaymentMethod(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function PaymentCard({ invoice }: Props) {
  const isPaid = invoice.status.trim().toLowerCase() === "paid";
  const displayAmount = isPaid
    ? Number(invoice.paid_amount ?? invoice.total_amount)
    : Number(invoice.total_amount);

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-bold text-slate-950">Payment</h2>

      <div className="mt-6">
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${
            isPaid ? "text-emerald-600" : "text-slate-400"
          }`}
        >
          {isPaid ? "Paid" : "Outstanding"}
        </p>
        <h3
          className={`mt-2 text-3xl font-bold ${
            isPaid ? "text-emerald-700" : "text-slate-950"
          }`}
        >
          {invoice.currency} {formatAmount(displayAmount)}
        </h3>
      </div>

      <div className="mt-6 space-y-4 border-t border-slate-200 pt-6">
        {isPaid && invoice.paid_at ? (
          <div className="flex items-start justify-between gap-4">
            <span className="text-sm font-medium text-slate-500">Payment Date</span>
            <span className="text-right font-semibold text-slate-900">
              {formatDate(invoice.paid_at)}
            </span>
          </div>
        ) : null}

        {isPaid && invoice.payment_method ? (
          <div className="flex items-start justify-between gap-4">
            <span className="text-sm font-medium text-slate-500">Payment Method</span>
            <span className="text-right font-semibold text-slate-900">
              {formatPaymentMethod(invoice.payment_method)}
            </span>
          </div>
        ) : null}

        {isPaid && invoice.payment_reference ? (
          <div className="flex items-start justify-between gap-4">
            <span className="text-sm font-medium text-slate-500">Reference</span>
            <span className="break-all text-right font-semibold text-slate-900">
              {invoice.payment_reference}
            </span>
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-500">Hours Purchased</span>
          <span className="font-semibold text-slate-900">
            {Number(invoice.hours_purchased).toFixed(2)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-500">Status</span>
          <span className="font-semibold capitalize text-slate-900">
            {invoice.status}
          </span>
        </div>
      </div>

      {!isPaid ? (
        <button
          type="button"
          disabled
          className="mt-8 w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white opacity-50"
        >
          Pay Online
        </button>
      ) : null}
    </div>
  );
}
