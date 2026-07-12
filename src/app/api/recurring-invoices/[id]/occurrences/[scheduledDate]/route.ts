import { requireAdmin } from "@/lib/recurring-invoices";

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function nullable(value: unknown) { const result = text(value); return result || null; }
function number(value: unknown, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; scheduledDate: string }> }) {
  const auth = await requireAdmin(request); if (auth.error) return auth.error;
  const { id, scheduledDate } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: "Invalid request body" }, { status: 400 }); }
  const items = Array.isArray(body.items) ? body.items as Record<string, unknown>[] : [];
  if (!items.length) return Response.json({ error: "Add at least one line item" }, { status: 400 });
  let { data: occurrence } = await auth.admin.from("recurring_invoice_occurrences").select("id,status").eq("recurring_schedule_id", id).eq("scheduled_date", scheduledDate).maybeSingle();
  if (occurrence?.status === "generated") return Response.json({ error: "Occurrence already generated" }, { status: 409 });
  if (!occurrence) {
    const created = await auth.admin.from("recurring_invoice_occurrences").insert({ recurring_schedule_id: id, scheduled_date: scheduledDate, status: "pending", created_by: auth.user.id }).select("id,status").single();
    if (created.error || !created.data) return Response.json({ error: created.error?.message || "Unable to create occurrence" }, { status: 500 });
    occurrence = created.data;
  }
  const updated = await auth.admin.from("recurring_invoice_occurrences").update({
    issue_date: nullable(body.issue_date), due_date: nullable(body.due_date), currency: nullable(body.currency),
    tax_amount: number(body.tax_amount), discount_amount: number(body.discount_amount), notes: nullable(body.notes),
    email_to: nullable(body.email_to), email_cc: nullable(body.email_cc), email_subject: nullable(body.email_subject), email_body: nullable(body.email_body),
  }).eq("id", occurrence.id).select("*").single();
  if (updated.error) return Response.json({ error: updated.error.message }, { status: 500 });
  await auth.admin.from("recurring_invoice_occurrence_items").delete().eq("occurrence_id", occurrence.id);
  const itemResult = await auth.admin.from("recurring_invoice_occurrence_items").insert(items.map((item, index) => ({
    occurrence_id: occurrence.id, project_id: nullable(item.project_id), description: text(item.description), hours: number(item.hours),
    quantity: number(item.quantity, 1), unit_price: number(item.unit_price), amount: number(item.amount), sort_order: index,
  })));
  if (itemResult.error) return Response.json({ error: itemResult.error.message }, { status: 500 });
  return Response.json({ occurrence: updated.data });
}
