import {
  adminClient,
  businessDate,
  generateOccurrence,
} from "@/lib/recurring-invoices";
import { sendRecurringInvoice } from "@/lib/send-recurring-invoice";
import { attemptRecurringInvoiceAutopay } from "@/lib/stripe-autopay";
const MAX_OCCURRENCES_PER_SCHEDULE = 31;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    request.headers.get("authorization") !== `Bearer ${secret}`
  ) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }
  let admin;
  try {
    admin = adminClient();
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Recurring invoice service is not configured",
      },
      { status: 500 },
    );
  }
  const today = businessDate();
  const { data: schedules, error } = await admin
    .from("recurring_invoice_schedules")
    .select("id,next_generation_date,status")
    .eq("status", "active")
    .lte("next_generation_date", today)
    .order("next_generation_date");
  if (error) {
    return Response.json(
      {
        error: `Recurring schedule query failed: ${error.message}`,
      },
      { status: 500 },
    );
  }
  const summary = {
    schedulesProcessed: schedules?.length || 0,
    occurrencesProcessed: 0,
    generated: 0,
    sent: 0,
    autopayAttempted: 0,
    failed: 0,
    skipped: 0,
    errors: [] as {
      scheduleId: string;
      scheduledDate?: string;
      error: string;
    }[],
  };
  for (const schedule of schedules || []) {
    let processedForSchedule = 0;
    while (processedForSchedule < MAX_OCCURRENCES_PER_SCHEDULE) {
      const { data: latest, error: latestError } = await admin
        .from("recurring_invoice_schedules")
        .select("status,next_generation_date")
        .eq("id", schedule.id)
        .single();
      if (latestError) {
        summary.failed++;
        summary.errors.push({
          scheduleId: schedule.id,
          error: latestError.message,
        });
        break;
      }
      if (
        !latest ||
        latest.status !== "active" ||
        !latest.next_generation_date ||
        latest.next_generation_date > today
      ) {
        break;
      }
      const scheduledDate = latest.next_generation_date;
      try {
        const generated = await generateOccurrence(
          admin,
          schedule.id,
          scheduledDate,
        );
        processedForSchedule++;
        summary.occurrencesProcessed++;
        summary.generated++;
        if (generated.autoSend) {
          await sendRecurringInvoice(
            admin,
            generated.invoice.id,
          );
          summary.sent++;
          const autopay =
            await attemptRecurringInvoiceAutopay(
              admin,
              generated.invoice.id,
            );
          if (autopay.attempted) {
            summary.autopayAttempted++;
          }
        }
      } catch (scheduleError) {
        const message =
          scheduleError instanceof Error
            ? scheduleError.message
            : "Unknown error";
        if (/already generated|skipped/i.test(message)) {
          summary.skipped++;
        } else {
          summary.failed++;
        }
        summary.errors.push({
          scheduleId: schedule.id,
          scheduledDate,
          error: message,
        });
        // Stop this schedule so the loop cannot repeatedly fail
        // against the same next_generation_date.
        break;
      }
    }
    if (processedForSchedule >= MAX_OCCURRENCES_PER_SCHEDULE) {
      summary.errors.push({
        scheduleId: schedule.id,
        error:
          "Catch-up limit reached. Additional overdue occurrences may remain.",
      });
    }
  }
  return Response.json(summary);
}
export const POST = GET;