import { refreshPendingOccurrences, requireAdmin, type RecurringSchedule } from "@/lib/recurring-invoices";

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function nullable(value: unknown) { const result = text(value); return result || null; }
function number(value: unknown, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request); if (auth.error) return auth.error;
  const { admin, user } = auth; const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: "Invalid request body" }, { status: 400 }); }
  const items = Array.isArray(body.items) ? body.items as Record<string, unknown>[] : [];
  if (!text(body.name) || !text(body.client_id) || !text(body.start_date) || !text(body.next_generation_date) || !items.length) return Response.json({ error: "Complete all required schedule fields" }, { status: 400 });
  if (body.auto_send === true && !nullable(body.email_to)) return Response.json({ error: "Email To is required when Auto-send is enabled" }, { status: 400 });
  const update = {
    client_id: text(body.client_id), name: text(body.name), frequency: text(body.frequency), interval_count: Math.max(1, number(body.interval_count, 1)),
    start_date: text(body.start_date), end_date: nullable(body.end_date), next_generation_date: text(body.next_generation_date), currency: text(body.currency) || "USD",
    payment_terms_days: Math.max(0, number(body.payment_terms_days, 7)), tax_amount: number(body.tax_amount), discount_amount: number(body.discount_amount), notes: nullable(body.notes),
    email_to: nullable(body.email_to), email_cc: nullable(body.email_cc), email_subject: nullable(body.email_subject), email_body: nullable(body.email_body),
    auto_send: body.auto_send === true, autopay_enabled: body.autopay_enabled === true,
  };
  const saved = await admin.from("recurring_invoice_schedules").update(update).eq("id", id).select("*").single();
  if (saved.error || !saved.data) return Response.json({ error: saved.error?.message || "Schedule not found" }, { status: saved.error?.code === "PGRST116" ? 404 : 500 });
  const remove = await admin.from("recurring_invoice_items").delete().eq("recurring_schedule_id", id);
  if (remove.error) return Response.json({ error: `Unable to update items: ${remove.error.message}` }, { status: 500 });
  const inserted = await admin.from("recurring_invoice_items").insert(items.map((item, index) => ({ recurring_schedule_id: id, project_id: nullable(item.project_id), description: text(item.description), hours: number(item.hours), quantity: number(item.quantity, 1), unit_price: number(item.unit_price), amount: number(item.amount), sort_order: index })));
  if (inserted.error) return Response.json({ error: `Unable to update items: ${inserted.error.message}` }, { status: 500 });

  const { data: pending } = await admin.from("recurring_invoice_occurrences").select("id,issue_date,due_date,currency,tax_amount,discount_amount,notes,email_to,email_cc,email_subject,email_body,recurring_invoice_occurrence_items(id)").eq("recurring_schedule_id", id).eq("status", "pending");
  const untouched = (pending || []).filter((row) => !row.issue_date && !row.due_date && !row.currency && row.tax_amount == null && row.discount_amount == null && !row.notes && !row.email_to && !row.email_cc && !row.email_subject && !row.email_body && !(row.recurring_invoice_occurrence_items || []).length).map((row) => row.id);
  if (untouched.length) await admin.from("recurring_invoice_occurrences").delete().in("id", untouched);
  await refreshPendingOccurrences(admin, saved.data as RecurringSchedule, user.id);
  return Response.json({ schedule: saved.data });
}
