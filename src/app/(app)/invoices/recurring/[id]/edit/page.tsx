import RecurringScheduleForm from "@/components/invoices/RecurringScheduleForm";

export default async function EditRecurringSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="min-h-screen bg-[#f8fafc] px-5 py-7 sm:px-8"><div className="mx-auto max-w-7xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#153E90]">Recurring Invoices</p><h1 className="mt-2 text-4xl font-bold text-slate-950">Edit Schedule</h1><p className="mb-8 mt-2 text-slate-500">Changes apply only to untouched future occurrences.</p><RecurringScheduleForm scheduleId={id} /></div></main>;
}
