import { adminClient, businessDate, generateOccurrence } from "@/lib/recurring-invoices";
import { sendRecurringInvoice } from "@/lib/send-recurring-invoice";
import { attemptRecurringInvoiceAutopay } from "@/lib/stripe-autopay";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let admin;
  try { admin = adminClient(); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Recurring invoice service is not configured" }, { status: 500 }); }
  const today = businessDate();
  const { data: schedules, error } = await admin.from("recurring_invoice_schedules").select("id,next_generation_date,status").eq("status", "active").lte("next_generation_date", today).order("next_generation_date");
  if (error) return Response.json({ error: `Recurring schedule query failed: ${error.message}` }, { status: 500 });
  const summary = { processed: schedules?.length || 0, generated: 0, sent: 0, autopayAttempted: 0, failed: 0, skipped: 0, errors: [] as { scheduleId: string; error: string }[] };
  for (const schedule of schedules || []) {
    try {
      const { data: latest } = await admin.from("recurring_invoice_schedules").select("status,next_generation_date").eq("id", schedule.id).single();
      if (!latest || latest.status !== "active" || latest.next_generation_date > today) { summary.skipped++; continue; }
      const generated = await generateOccurrence(admin, schedule.id, latest.next_generation_date);
      summary.generated++;
      if (generated.autoSend) {
        await sendRecurringInvoice(admin, generated.invoice.id);
        summary.sent++;
        const autopay = await attemptRecurringInvoiceAutopay(admin, generated.invoice.id);
        if (autopay.attempted) summary.autopayAttempted++;
      }
    } catch (scheduleError) {
      const message = scheduleError instanceof Error ? scheduleError.message : "Unknown error";
      if (/already generated|skipped/i.test(message)) summary.skipped++; else summary.failed++;
      summary.errors.push({ scheduleId: schedule.id, error: message });
    }
  }
  return Response.json(summary);
}

export const POST = GET;
