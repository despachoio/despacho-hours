import { requireAdmin } from "@/lib/recurring-invoices";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; scheduledDate: string }> }) {
  const auth = await requireAdmin(request); if (auth.error) return auth.error;
  const { id, scheduledDate } = await params;
  let body: { reason?: unknown }; try { body = await request.json() as { reason?: unknown }; } catch { return Response.json({ error: "Invalid request body" }, { status: 400 }); }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) return Response.json({ error: "Skip reason is required" }, { status: 400 });
  const result = await auth.admin.from("recurring_invoice_occurrences").update({ status: "skipped", skip_reason: reason }).eq("recurring_schedule_id", id).eq("scheduled_date", scheduledDate).eq("status", "pending").select("id").single();
  if (result.error) return Response.json({ error: "Occurrence not found or cannot be skipped" }, { status: 409 });
  return Response.json({ success: true });
}
