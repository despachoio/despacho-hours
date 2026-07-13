import type { PublicInvoice } from "./types";

function money(currency: string, amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default function InvoicePaymentSummary({ invoice }: { invoice: PublicInvoice }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#153E90]">
            Invoice #{invoice.invoiceNumber}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">
            {invoice.clientName}
          </h1>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase text-[#153E90]">
          {invoice.status}
        </span>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-slate-100 py-5 text-sm">
        <div><dt className="text-slate-400">Issue date</dt><dd className="mt-1 font-bold text-slate-900">{date(invoice.issueDate)}</dd></div>
        <div><dt className="text-slate-400">Due date</dt><dd className="mt-1 font-bold text-slate-900">{date(invoice.dueDate)}</dd></div>
      </dl>
      <div className="mt-6 space-y-3">
        {invoice.items.map((item, index) => (
          <div key={`${item.description}-${index}`} className="flex justify-between gap-5 text-sm">
            <div className="min-w-0">
              <p className="font-bold text-slate-800">
                {item.projectCode ? `[${item.projectCode}] ` : ""}{item.projectName || "Service"}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-400">{item.description}</p>
            </div>
            <p className="shrink-0 font-bold text-slate-900">{money(invoice.currency, item.amount)}</p>
          </div>
        ))}
      </div>
      <div className="mt-7 flex items-end justify-between border-t-2 border-slate-900 pt-5">
        <span className="text-sm font-bold uppercase tracking-wide text-slate-500">Total</span>
        <span className="text-3xl font-bold text-[#153E90]">{money(invoice.currency, invoice.totalAmount)}</span>
      </div>
    </section>
  );
}
