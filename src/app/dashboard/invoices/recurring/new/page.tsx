"use client";

import { useSearchParams } from "next/navigation";
import RecurringScheduleForm from "@/components/invoices/RecurringScheduleForm";

export default function NewRecurringInvoicePage() {
  const searchParams = useSearchParams();
  return <main className="min-h-screen bg-[#f8fafc] px-5 py-7 sm:px-8"><div className="mx-auto max-w-7xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#153E90]">Recurring Invoices</p><h1 className="mt-2 text-4xl font-bold text-slate-950">Create Schedule</h1><p className="mb-8 mt-2 text-slate-500">Create editable future invoice Drafts on a reliable schedule.</p><RecurringScheduleForm sourceInvoiceId={searchParams.get("sourceInvoiceId")} /></div></main>;
}
