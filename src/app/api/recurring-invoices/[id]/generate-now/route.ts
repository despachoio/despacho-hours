import { generateOccurrence, requireAdmin } from "@/lib/recurring-invoices";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request); if (auth.error) return auth.error;
  const { id } = await params;
  let body: { scheduledDate?: unknown };
  try { body = await request.json() as { scheduledDate?: unknown }; } catch { return Response.json({ error: "Invalid request body" }, { status: 400 }); }
  const scheduledDate = typeof body.scheduledDate === "string" ? body.scheduledDate : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) return Response.json({ error: "Scheduled occurrence is required" }, { status: 400 });
  try {
    const generated = await generateOccurrence(auth.admin, id, scheduledDate, auth.user.id);
    return Response.json({ invoiceId: generated.invoice.id, status: generated.invoice.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recurring invoice generation failed";
    const status = /not found/i.test(message) ? 404 : /paused|cancelled|already|skipped|duplicate/i.test(message) ? 409 : 500;
    return Response.json({ error: message }, { status });
  }
}
