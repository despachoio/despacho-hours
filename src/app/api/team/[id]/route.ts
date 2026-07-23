import { createClient } from "@supabase/supabase-js";

export async function DELETE(
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
    return Response.json(
      { error: "Team management is not configured on the server" },
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
  const { data: callerProfile, error: callerError } = await adminClient
    .from("profiles")
    .select("role,employee_id")
    .eq("user_id", user.id)
    .single();
  if (callerError) {
    return Response.json(
      { error: "Unable to verify permissions" },
      { status: 500 },
    );
  }

  const callerRole = String(callerProfile?.role || "").trim().toLowerCase();
  if (!["admin", "super admin", "finance admin"].includes(callerRole)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: employeeId } = await params;
  if (callerProfile?.employee_id === employeeId) {
    return Response.json(
      { error: "You cannot delete your own account." },
      { status: 409 },
    );
  }

  const [{ data: employee, error: employeeError }, { data: targetProfile }] =
    await Promise.all([
      adminClient
        .from("employees")
        .select("id,name,email,user_id")
        .eq("id", employeeId)
        .single(),
      adminClient
        .from("profiles")
        .select("role")
        .eq("employee_id", employeeId)
        .maybeSingle(),
    ]);
  if (employeeError || !employee) {
    return Response.json({ error: "Employee not found" }, { status: 404 });
  }

  const targetRole = String(targetProfile?.role || "").trim().toLowerCase();
  if (targetRole === "finance admin" && callerRole !== "finance admin") {
    return Response.json(
      { error: "Only a Finance Admin can delete a Finance Admin account." },
      { status: 403 },
    );
  }
  if (
    targetRole === "super admin" &&
    !["finance admin", "super admin"].includes(callerRole)
  ) {
    return Response.json(
      {
        error:
          "Only a Finance Admin or Super Admin can delete a Super Admin account.",
      },
      { status: 403 },
    );
  }

  const { count: timeEntryCount, error: historyError } = await adminClient
    .from("time_entries")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", employeeId);
  if (historyError) {
    return Response.json(
      { error: "Unable to verify employee history" },
      { status: 500 },
    );
  }
  if ((timeEntryCount || 0) > 0) {
    return Response.json(
      {
        error:
          "This employee has time history and cannot be permanently deleted. Deactivate the employee to preserve payroll and audit records.",
      },
      { status: 409 },
    );
  }

  if (employee.user_id) {
    const { error: authDeleteError } =
      await adminClient.auth.admin.deleteUser(employee.user_id);
    if (authDeleteError) {
      return Response.json(
        { error: `Unable to remove login access: ${authDeleteError.message}` },
        { status: 500 },
      );
    }
  }

  const { error: deleteError } = await adminClient
    .from("employees")
    .delete()
    .eq("id", employeeId);
  if (deleteError) {
    return Response.json(
      { error: `Unable to delete employee: ${deleteError.message}` },
      { status: 500 },
    );
  }

  return Response.json({ success: true });
}
