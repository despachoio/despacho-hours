import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const token = authHeader.slice(7);
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await userClient.auth.getUser(token);
  if (userError || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return Response.json({ error: "Reminder service is not configured" }, { status: 500 });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await admin.from("profiles").select("role").eq("user_id", user.id).single();
  if (!["finance admin", "super admin"].includes(String(profile?.role || "").trim().toLowerCase())) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null) as { reason?: unknown } | null;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason) return Response.json({ error: "Reason is required" }, { status: 400 });

  const { id } = await params;
  const { data: invoice } = await admin.from("invoices").select("id,status,reminders_enabled").eq("id", id).single();
  if (!invoice || !["sent", "overdue"].includes(String(invoice.status).toLowerCase())) return Response.json({ error: "Invoice not eligible for reminders" }, { status: 409 });
  if (invoice.reminders_enabled === false) return Response.json({ error: "Reminders are already stopped" }, { status: 409 });

  const stoppedAt = new Date().toISOString();
  const { data: updated, error } = await admin.from("invoices").update({ reminders_enabled: false, reminders_stopped_at: stoppedAt, reminders_stopped_by: user.id, reminders_stop_reason: reason, next_reminder_at: null }).eq("id", id).eq("reminders_enabled", true).select("reminders_enabled,reminders_stopped_at,reminders_stop_reason,next_reminder_at").single();
  if (error) return Response.json({ error: `Unable to stop reminders: ${error.message}` }, { status: 500 });

  await admin.from("invoice_activities").insert({ invoice_id: id, event_type: "reminders_stopped", description: `Automatic reminders stopped: ${reason}`, created_at: stoppedAt });
  return Response.json({ success: true, invoice: updated });
}
