import RecurringScheduleForm from "@/components/invoices/RecurringScheduleForm";

export default async function EditRecurringOccurrencePage({ params }: { params: Promise<{ id: string; scheduledDate: string }> }) {
  const { id, scheduledDate } = await params;
  return <main className="min-h-screen bg-[#f8fafc] px-5 py-7 sm:px-8"><div className="mx-auto max-w-7xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#153E90]">One-time Override</p><h1 className="mt-2 text-4xl font-bold text-slate-950">Edit Upcoming Invoice</h1><p className="mb-8 mt-2 text-slate-500">This edit affects only the {scheduledDate} occurrence.</p><RecurringScheduleForm scheduleId={id} scheduledDate={scheduledDate} /></div></main>;
}
