import { createClient } from "@supabase/supabase-js";
import { dispatchTimeOffNotifications } from "@/lib/time-off/notifications";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return Response.json(
      { error: "Time Off notifications are not configured" },
      { status: 500 },
    );
  }

  const token = bearerToken(request);
  if (!token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const user = await admin.auth.getUser(token);
  if (user.error || !user.data.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await dispatchTimeOffNotifications(admin, {
      queueScheduledReminders: false,
    });
    return Response.json(result);
  } catch (cause) {
    console.error("Immediate Time Off notification dispatch failed", cause);
    return Response.json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "Unable to send Time Off notifications",
      },
      { status: 500 },
    );
  }
}
