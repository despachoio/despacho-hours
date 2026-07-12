import { createClient } from "@supabase/supabase-js";

const ACTIVE_TIMER_MESSAGE =
  "This employee has an active timer. Stop the timer before deactivating the account.";

type StatusBody = {
  status?: unknown;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Team status service configuration is missing");
    return Response.json(
      { error: "Team status service is not configured" },
      { status: 500 },
    );
  }

  const accessToken = authHeader.slice(7);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(accessToken);
  if (userError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (profileError) {
    console.error("Team status profile lookup failed:", profileError);
    return Response.json(
      { error: "Unable to verify permissions" },
      { status: 500 },
    );
  }
  if (String(profile?.role || "").trim().toLowerCase() !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: StatusBody;
  try {
    body = (await request.json()) as StatusBody;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const nextStatus =
    typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
  if (nextStatus !== "active" && nextStatus !== "inactive") {
    return Response.json(
      { error: "Status must be active or inactive" },
      { status: 400 },
    );
  }

  const { id: employeeId } = await params;
  const { data: employee, error: employeeError } = await adminClient
    .from("employees")
    .select("id,status")
    .eq("id", employeeId)
    .single();
  if (employeeError || !employee) {
    return Response.json({ error: "Employee not found" }, { status: 404 });
  }

  if (nextStatus === "inactive") {
    const { data: activeTimer, error: timerError } = await adminClient
      .from("active_timers")
      .select("id")
      .eq("employee_id", employeeId)
      .in("status", ["running", "paused"])
      .limit(1)
      .maybeSingle();
    if (timerError) {
      console.error("Team status timer check failed:", timerError);
      return Response.json(
        { error: "Unable to verify the employee timer status" },
        { status: 500 },
      );
    }
    if (activeTimer) {
      return Response.json({ error: ACTIVE_TIMER_MESSAGE }, { status: 409 });
    }
  }

  const { data: updatedEmployee, error: updateError } = await adminClient
    .from("employees")
    .update({ status: nextStatus })
    .eq("id", employeeId)
    .select("id,status")
    .single();
  if (updateError) {
    console.error("Team status update failed:", {
      message: updateError.message,
      details: updateError.details,
      hint: updateError.hint,
      code: updateError.code,
      employeeId,
    });
    return Response.json(
      { error: `Unable to update employee status: ${updateError.message}` },
      { status: 500 },
    );
  }

  return Response.json({ success: true, employee: updatedEmployee });
}
