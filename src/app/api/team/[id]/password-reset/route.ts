import { createClient } from "@supabase/supabase-js";

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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !appUrl) {
    console.error("Team password reset service configuration is missing", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasAnonKey: Boolean(anonKey),
      hasServiceRoleKey: Boolean(serviceRoleKey),
      hasAppUrl: Boolean(appUrl),
    });
    return Response.json(
      { error: "Password reset is not configured on the server" },
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
    console.error("Team password reset profile lookup failed:", profileError);
    return Response.json(
      { error: "Unable to verify permissions" },
      { status: 500 },
    );
  }
  if (String(profile?.role || "").trim().toLowerCase() !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: employeeId } = await params;
  const { data: employee, error: employeeError } = await adminClient
    .from("employees")
    .select("id,email,user_id")
    .eq("id", employeeId)
    .single();

  if (employeeError || !employee) {
    return Response.json({ error: "Employee not found" }, { status: 404 });
  }
  if (!employee.user_id || !employee.email?.trim()) {
    return Response.json(
      { error: "This employee does not have login access configured" },
      { status: 409 },
    );
  }

  const resetClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: resetError } = await resetClient.auth.resetPasswordForEmail(
    employee.email.trim(),
    { redirectTo: `${appUrl}/reset-password` },
  );

  if (resetError) {
    console.error("Team password reset email failed:", {
      message: resetError.message,
      status: resetError.status,
      code: resetError.code,
      employeeId,
    });
    return Response.json(
      { error: `Unable to send password reset email: ${resetError.message}` },
      { status: resetError.status === 429 ? 429 : 500 },
    );
  }

  return Response.json({ success: true });
}
