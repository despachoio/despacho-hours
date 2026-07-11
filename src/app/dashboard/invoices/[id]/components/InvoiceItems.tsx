"use client";

import { InvoiceItem } from "../page";

type Props = {
  items: InvoiceItem[];
};

export default function InvoiceItems({
  items,
}: Props) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-950">
          Invoice Items
        </h2>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {items.length} {items.length === 1 ? "Item" : "Items"}
        </span>
      </div>

      <div className="mt-6 space-y-4">

        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
          >
            <div className="flex items-start justify-between">

              <div>

                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Project
                </p>

                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  [{item.projects?.project_code}]{" "}
                  {item.projects?.name}
                </h3>

                <p className="mt-3 text-sm text-slate-600">
                  {item.description}
                </p>

              </div>

              <div className="text-right">

                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Amount
                </p>

                <p className="mt-1 text-2xl font-bold text-slate-950">
                  {item.amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>

              </div>

            </div>

            <div className="mt-6 flex gap-8 border-t border-slate-200 pt-4">

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Hours
                </p>

                <p className="mt-1 font-semibold text-slate-900">
                  {Number(item.hours).toFixed(2)}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Unit Price
                </p>

                <p className="mt-1 font-semibold text-slate-900">
                  {item.unit_price.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Quantity
                </p>

                <p className="mt-1 font-semibold text-slate-900">
                  {item.quantity}
                </p>
              </div>

            </div>
          </div>
        ))}

      </div>

    </div>
  );
}