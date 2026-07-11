"use client";

import type {
  Invoice,
  InvoicePayment,
  InvoiceWalletCredit,
} from "../page";

type Props = {
  invoice: Invoice;
  payments: InvoicePayment[];
  walletCredits: InvoiceWalletCredit[];
};

type TimelineEvent = {
  key: string;
  title: string;
  description?: string;
  detail?: string;
  date: string | null;
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatAmount(currency: string, amount: number) {
  return `${currency} ${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPaymentMethod(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function InvoiceTimeline({
  invoice,
  payments,
  walletCredits,
}: Props) {
  const events: TimelineEvent[] = [
    {
      key: "created",
      title: "Invoice Created",
      date: invoice.created_at || invoice.issue_date,
    },
  ];

  if (invoice.sent_at) {
    events.push({
      key: "sent",
      title: "Invoice emailed to",
      description: invoice.sent_to || undefined,
      date: invoice.sent_at,
    });
  }

  for (const payment of payments) {
    events.push({
      key: `payment-${payment.id}`,
      title: "Payment recorded",
      description: `${formatAmount(payment.currency, payment.amount)} via ${formatPaymentMethod(payment.payment_method)}`,
      detail: payment.reference_number
        ? `Reference: ${payment.reference_number}`
        : undefined,
      date: payment.payment_date || payment.created_at,
    });

    if (payment.status === "reversed" && payment.reversed_at) {
      events.push({
        key: `payment-reversed-${payment.id}`,
        title: "Payment reversed",
        description: payment.reversal_reason
          ? `Reason: ${payment.reversal_reason}`
          : undefined,
        detail: payment.reversal_notes || undefined,
        date: payment.reversed_at,
      });
    }
  }

  const originalCredits = walletCredits.filter(
    (credit) => credit.transaction_type === "invoice_credit"
  );
  const reversalCredits = walletCredits.filter(
    (credit) => credit.transaction_type === "invoice_credit_reversal"
  );

  if (originalCredits.length > 0) {
    const totalHours = originalCredits.reduce(
      (total, credit) => total + Number(credit.hours_delta || 0),
      0
    );
    const projectCount = new Set(
      originalCredits.map((credit) => credit.project_id)
    ).size;

    events.push({
      key: "wallet-credit",
      title: "Service Wallet credited",
      description: `${totalHours.toFixed(2)} hours across ${projectCount} ${
        projectCount === 1 ? "project" : "projects"
      }`,
      date: originalCredits[0]?.created_at || null,
    });
  }

  if (reversalCredits.length > 0) {
    const totalHours = reversalCredits.reduce(
      (total, credit) => total + Math.abs(Number(credit.hours_delta || 0)),
      0
    );
    const projectCount = new Set(
      reversalCredits.map((credit) => credit.project_id)
    ).size;

    events.push({
      key: "wallet-credit-reversal",
      title: "Service Wallet credit reversed",
      description: `${totalHours.toFixed(2)} hours removed across ${projectCount} ${
        projectCount === 1 ? "project" : "projects"
      }`,
      date: reversalCredits[0]?.created_at || null,
    });
  }

  if (invoice.status.trim().toLowerCase() === "void") {
    events.push({
      key: "voided",
      title: "Invoice voided",
      description: invoice.void_reason || undefined,
      date: invoice.voided_at || null,
    });
  }

  events.sort((first, second) => {
    if (!first.date) return 1;
    if (!second.date) return -1;
    return new Date(first.date).getTime() - new Date(second.date).getTime();
  });

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-bold text-slate-950">Activity</h2>

      <div className="mt-6">
        {events.map((event, index) => (
          <div key={event.key} className="relative pb-8 last:pb-0">
            {index !== events.length - 1 ? (
              <div className="absolute left-[7px] top-4 h-full w-px bg-slate-200" />
            ) : null}

            <div className="flex items-start gap-4">
              <div className="mt-1 h-4 w-4 shrink-0 rounded-full bg-slate-900" />

              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{event.title}</p>
                {event.description ? (
                  <p className="mt-1 break-words text-sm leading-5 text-slate-600">
                    {event.description}
                  </p>
                ) : null}
                {event.detail ? (
                  <p className="mt-1 break-words text-xs text-slate-500">
                    {event.detail}
                  </p>
                ) : null}
                {event.date ? (
                  <p className="mt-1 text-sm text-slate-500">
                    {formatDate(event.date)}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
