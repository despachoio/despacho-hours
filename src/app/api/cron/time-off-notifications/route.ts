import { createClient } from "@supabase/supabase-js";
import { dispatchTimeOffNotifications } from "@/lib/time-off/notifications";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return Response.json({ error: "Time Off notifications are not configured" }, { status: 500 });
  }
  try {
    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return Response.json(await dispatchTimeOffNotifications(admin));
  } catch (cause) {
    return Response.json({
      error: cause instanceof Error ? cause.message : "Unable to send Time Off notifications",
    }, { status: 500 });
  }
}
