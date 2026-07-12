import { refreshPendingOccurrences, requireAdmin, type RecurringSchedule } from "@/lib/recurring-invoices";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request); if (auth.error) return auth.error;
  const { id } = await params;
  let body: { status?: unknown; nextGenerationDate?: unknown };
  try { body = await request.json() as typeof body; } catch { return Response.json({ error: "Invalid request body" }, { status: 400 }); }
  const status = typeof body.status === "string" ? body.status : "";
  if (!["active", "paused", "cancelled"].includes(status)) return Response.json({ error: "Invalid schedule status" }, { status: 400 });
  const nextDate = typeof body.nextGenerationDate === "string" ? body.nextGenerationDate : "";
  if (status === "active" && !/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return Response.json({ error: "Next generation date is required when resuming" }, { status: 400 });
  const result = await auth.admin.from("recurring_invoice_schedules").update({ status, ...(status === "active" ? { next_generation_date: nextDate } : {}) }).eq("id", id).select("*").single();
  if (result.error || !result.data) return Response.json({ error: "Schedule not found" }, { status: 404 });
  if (status === "cancelled") {
    await auth.admin.from("recurring_invoice_occurrences").update({ status: "cancelled" }).eq("recurring_schedule_id", id).eq("status", "pending");
  }
  if (status === "active") await refreshPendingOccurrences(auth.admin, result.data as RecurringSchedule, auth.user.id);
  return Response.json({ schedule: result.data });
}
