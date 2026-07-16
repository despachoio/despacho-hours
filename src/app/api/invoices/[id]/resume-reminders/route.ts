import { createClient } from "@supabase/supabase-js";
import { loadCompanySettings } from "@/lib/settings/companySettings";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BUSINESS_OFFSET = "+05:30";

function businessDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
function atBusinessMidnight(date: string) {
  return new Date(`${date}T00:00:00${BUSINESS_OFFSET}`);
}
function addDays(date: string, days: number) {
  const value = atBusinessMidnight(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer "))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const token = authHeader.slice(7);
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(token);
  if (userError || !user)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey)
    return Response.json(
      { error: "Reminder service is not configured" },
      { status: 500 },
    );
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (
    String(profile?.role || "")
      .trim()
      .toLowerCase() !== "super admin"
  )
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { data: invoice } = await admin
    .from("invoices")
    .select(
      "id,status,due_date,reminders_enabled,reminder_count,last_reminder_sent_at",
    )
    .eq("id", id)
    .single();
  if (
    !invoice ||
    !["sent", "overdue"].includes(String(invoice.status).toLowerCase())
  )
    return Response.json(
      { error: "Invoice not eligible for reminders" },
      { status: 409 },
    );
  if (invoice.reminders_enabled === true)
    return Response.json(
      { error: "Reminders are already active" },
      { status: 409 },
    );

  const today = businessDate(new Date());
  const settings = await loadCompanySettings(admin);
  const nextReminder = [
    ...settings.default_reminder_before_due_days.map((days) =>
      addDays(invoice.due_date, -Math.abs(Number(days))),
    ),
    ...settings.default_reminder_after_due_days.map((days) =>
      addDays(invoice.due_date, Math.abs(Number(days))),
    ),
  ]
    .filter((date) => businessDate(date) >= today)
    .sort((first, second) => first.getTime() - second.getTime())[0];
  const resumedAt = new Date().toISOString();
  const { data: updated, error } = await admin
    .from("invoices")
    .update({
      reminders_enabled: true,
      reminders_stopped_at: null,
      reminders_stopped_by: null,
      reminders_stop_reason: null,
      next_reminder_at: nextReminder?.toISOString() || null,
    })
    .eq("id", id)
    .eq("reminders_enabled", false)
    .select(
      "reminders_enabled,reminders_stopped_at,reminders_stop_reason,next_reminder_at",
    )
    .single();
  if (error)
    return Response.json(
      { error: `Unable to resume reminders: ${error.message}` },
      { status: 500 },
    );

  await admin.from("invoice_activities").insert({
    invoice_id: id,
    event_type: "reminders_resumed",
    description: "Automatic reminders resumed",
    created_at: resumedAt,
  });
  return Response.json({ success: true, invoice: updated });
}
