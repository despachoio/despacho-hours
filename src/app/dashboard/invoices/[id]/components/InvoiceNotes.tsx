"use client";

type Props = {
  notes: string | null;
};

export default function InvoiceNotes({
  notes,
}: Props) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">

      <h2 className="text-lg font-bold text-slate-950">
        Payment Instructions
      </h2>

      {notes ? (
        <div className="mt-5 whitespace-pre-wrap rounded-2xl bg-slate-50 p-5 text-sm leading-7 text-slate-700">
          {notes}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-400">
            No payment instructions have been added.
          </p>
        </div>
      )}

    </div>
  );
}