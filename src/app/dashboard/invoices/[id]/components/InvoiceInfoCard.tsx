"use client";

import { Invoice } from "../page";

type Props = {
  invoice: Invoice;
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function paymentTerms(issue: string, due: string) {
  const issueDate = new Date(issue);
  const dueDate = new Date(due);

  const diff =
    (dueDate.getTime() - issueDate.getTime()) /
    (1000 * 60 * 60 * 24);

  return `Net ${diff} Days`;
}

export default function InvoiceInfoCard({
  invoice,
}: Props) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

      <h2 className="text-lg font-bold text-slate-950">
        Invoice Details
      </h2>

      <div className="mt-6 space-y-5">

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Client
          </p>

          <p className="mt-1 text-sm font-semibold text-slate-900">
            {invoice.clients?.name}
          </p>
        </div>

        {invoice.sent_at ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Sent
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {formatDate(invoice.sent_at)}
            </p>
          </div>
        ) : null}

        {invoice.sent_to ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Recipient
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-slate-900">
              {invoice.sent_to}
            </p>
          </div>
        ) : null}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Issue Date
          </p>

          <p className="mt-1 text-sm font-semibold text-slate-900">
            {formatDate(invoice.issue_date)}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Due Date
          </p>

          <p className="mt-1 text-sm font-semibold text-slate-900">
            {formatDate(invoice.due_date)}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Currency
          </p>

          <p className="mt-1 text-sm font-semibold text-slate-900">
            {invoice.currency}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Payment Terms
          </p>

          <p className="mt-1 text-sm font-semibold text-slate-900">
            {paymentTerms(
              invoice.issue_date,
              invoice.due_date
            )}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            AutoPay
          </p>

          <span className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Coming Soon
          </span>
        </div>

      </div>

    </div>
  );
}
