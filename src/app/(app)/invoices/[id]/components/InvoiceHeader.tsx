"use client";

import { useRouter } from "next/navigation";
import { Invoice } from "../page";

type Props = {
  invoice: Invoice;
};

export default function InvoiceHeader({
  invoice,
}: Props) {
  const router = useRouter();

  const statusColor = {
    draft: "bg-yellow-100 text-yellow-700",
    sent: "bg-blue-100 text-blue-700",
    paid: "bg-green-100 text-green-700",
    overdue: "bg-red-100 text-red-700",
    cancelled: "bg-slate-200 text-slate-700",
    void: "bg-red-100 text-red-700",
  };

  return (
    <>
      <button
        onClick={() =>
          router.push("/invoices")
        }
        className="text-sm font-semibold text-slate-500 hover:text-slate-900"
      >
        ← Invoices
      </button>

      <div className="mt-5 flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">
            Invoice
          </p>

          <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-950">
            #{invoice.invoice_number}
          </h1>

          <p className="mt-2 text-lg text-slate-600">
            {invoice.clients?.name}
          </p>
        </div>

        <span
          className={`rounded-full px-4 py-2 text-sm font-semibold uppercase ${
            statusColor[
              invoice.status.toLowerCase() as keyof typeof statusColor
            ] ??
            "bg-slate-100 text-slate-700"
          }`}
        >
          {invoice.status.toUpperCase()}
        </span>
      </div>
    </>
  );
}
