"use client";

import { Invoice } from "../page";
import { formatDecimalHours } from "@/lib/format-hours";

type Props = {
  invoice: Invoice;
};

export default function InvoiceSummary({
  invoice,
}: Props) {
  return (
    <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">

      <h2 className="text-lg font-bold">
        Invoice Summary
      </h2>

      <div className="mt-6 space-y-4">

        <div className="flex items-center justify-between">
          <span className="text-slate-300">
            Hours Purchased
          </span>

          <span className="font-semibold">
            {formatDecimalHours(invoice.hours_purchased)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-300">
            Subtotal
          </span>

          <span className="font-semibold">
            {invoice.currency}{" "}
            {Number(
              invoice.subtotal
            ).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-300">
            Tax
          </span>

          <span className="font-semibold">
            {invoice.currency}{" "}
            {Number(
              invoice.tax_amount
            ).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        <div className="border-t border-slate-700 pt-4">

          <div className="flex items-center justify-between">

            <span className="text-lg font-bold">
              Total
            </span>

            <span className="text-3xl font-bold tracking-tight">
              {invoice.currency}{" "}
              {Number(
                invoice.total_amount
              ).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>

          </div>

        </div>

      </div>

    </div>
  );
}