import { requireAdmin } from "@/lib/recurring-invoices";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { id } = await params;

  const { data: invoice, error } = await auth.admin
    .from("invoices")
    .select(
      "id,status,generated_from_recurring,recurring_schedule_id,recurring_occurrence_id",
    )
    .eq("id", id)
    .single();
  if (error || !invoice)
    return Response.json({ error: "Invoice not found" }, { status: 404 });

  if (invoice.status !== "draft" || invoice.generated_from_recurring !== true) {
    return Response.json(
      { error: "Only recurring Draft invoices can be deleted" },
      { status: 409 },
    );
  }

  if (invoice.recurring_schedule_id) {
    const { data: schedule, error: scheduleError } = await auth.admin
      .from("recurring_invoice_schedules")
      .select("autopay_enabled")
      .eq("id", invoice.recurring_schedule_id)
      .maybeSingle();
    if (scheduleError) {
      console.error("Recurring Draft schedule lookup failed:", {
        message: scheduleError.message,
        details: scheduleError.details,
        hint: scheduleError.hint,
        code: scheduleError.code,
        invoiceId: id,
        scheduleId: invoice.recurring_schedule_id,
      });
      return Response.json(
        { error: `Unable to verify Autopay: ${scheduleError.message}` },
        { status: 500 },
      );
    }
    if (schedule?.autopay_enabled === true) {
      return Response.json(
        {
          error: "Recurring Drafts cannot be deleted while Autopay is enabled",
        },
        { status: 409 },
      );
    }
  }

  const occurrenceCleanup = await auth.admin
    .from("recurring_invoice_occurrences")
    .update({
      status: "cancelled",
      generated_invoice_id: null,
      skip_reason: "Generated Draft deleted by Admin",
    })
    .eq("generated_invoice_id", id);
  if (occurrenceCleanup.error) {
    return Response.json(
      {
        error: `Unable to unlink the recurring occurrence: ${occurrenceCleanup.error.message}`,
      },
      { status: 500 },
    );
  }

  const scheduleCleanup = await auth.admin
    .from("recurring_invoice_schedules")
    .update({ last_generated_invoice_id: null })
    .eq("last_generated_invoice_id", id);
  if (scheduleCleanup.error) {
    return Response.json(
      {
        error: `Unable to unlink the recurring schedule: ${scheduleCleanup.error.message}`,
      },
      { status: 500 },
    );
  }

  const itemDelete = await auth.admin
    .from("invoice_items")
    .delete()
    .eq("invoice_id", id);
  if (itemDelete.error) {
    return Response.json(
      { error: `Unable to delete invoice items: ${itemDelete.error.message}` },
      { status: 500 },
    );
  }
  const deleted = await auth.admin
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("status", "draft");
  if (deleted.error) {
    return Response.json(
      { error: `Unable to delete recurring Draft: ${deleted.error.message}` },
      { status: 500 },
    );
  }
  return Response.json({ success: true });
}
