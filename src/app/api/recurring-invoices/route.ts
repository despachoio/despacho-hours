import {
  generateOccurrence,
  nextScheduledDate,
  refreshPendingOccurrences,
  requireAdmin,
  type RecurringSchedule,
} from "@/lib/recurring-invoices";

type Body = Record<string, unknown> & { items?: unknown };

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
function nullable(value: unknown) {
  const result = text(value);
  return result || null;
}
function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { admin, user } = auth;
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const items = Array.isArray(body.items)
    ? (body.items as Record<string, unknown>[])
    : [];
  const name = text(body.name);
  const clientId = text(body.client_id);
  const startDate = text(body.start_date);
  const frequency = text(body.frequency) as RecurringSchedule["frequency"];
  const intervalCount = Math.max(1, number(body.interval_count, 1));
  const emailTo = nullable(body.email_to);
  if (
    !name ||
    !clientId ||
    !startDate ||
    !["weekly", "monthly", "quarterly", "yearly", "custom"].includes(
      frequency,
    ) ||
    !items.length
  ) {
    return Response.json(
      { error: "Complete the schedule and add at least one line item" },
      { status: 400 },
    );
  }
  if (body.auto_send === true && !emailTo)
    return Response.json(
      { error: "Email To is required when Auto-send is enabled" },
      { status: 400 },
    );

  const nextDate = nextScheduledDate(
    {
      start_date: startDate,
      frequency,
      interval_count: intervalCount,
    },
    startDate,
  );

  const payload = {
    client_id: clientId,
    name,
    status: "active",
    frequency,
    interval_count: intervalCount,
    start_date: startDate,
    end_date: nullable(body.end_date),
    next_generation_date: nextDate,
    currency: text(body.currency) || "USD",
    payment_terms_days: Math.max(0, number(body.payment_terms_days, 7)),
    tax_amount: number(body.tax_amount),
    discount_amount: number(body.discount_amount),
    notes: nullable(body.notes),
    email_to: emailTo,
    email_cc: nullable(body.email_cc),
    email_subject: nullable(body.email_subject),
    email_body: nullable(body.email_body),
    auto_send: body.auto_send === true,
    autopay_enabled: body.autopay_enabled === true,
    autopay_provider: nullable(body.autopay_provider),
    autopay_customer_reference: nullable(body.autopay_customer_reference),
    created_by: user.id,
  };
  const created = await admin
    .from("recurring_invoice_schedules")
    .insert(payload)
    .select("*")
    .single();
  if (created.error || !created.data)
    return Response.json(
      {
        error: `Unable to create recurring schedule: ${created.error?.message || "Unknown error"}`,
      },
      { status: 500 },
    );
  const itemResult = await admin.from("recurring_invoice_items").insert(
    items.map((item, index) => ({
      recurring_schedule_id: created.data.id,
      project_id: nullable(item.project_id),
      description: text(item.description),
      hours: number(item.hours),
      quantity: number(item.quantity, 1),
      unit_price: number(item.unit_price),
      amount: number(item.amount),
      sort_order: index,
    })),
  );
  if (itemResult.error) {
    await admin
      .from("recurring_invoice_schedules")
      .delete()
      .eq("id", created.data.id);
    return Response.json(
      { error: `Unable to save recurring items: ${itemResult.error.message}` },
      { status: 500 },
    );
  }
  try {
    await refreshPendingOccurrences(
      admin,
      created.data as RecurringSchedule,
      user.id,
    );
    const firstDraft = await generateOccurrence(
      admin,
      created.data.id,
      startDate,
      user.id,
    );
    return Response.json(
      { schedule: created.data, firstInvoice: firstDraft.invoice },
      { status: 201 },
    );
  } catch (error) {
    await admin
      .from("recurring_invoice_schedules")
      .delete()
      .eq("id", created.data.id);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create the first recurring Draft",
      },
      { status: 500 },
    );
  }
}
