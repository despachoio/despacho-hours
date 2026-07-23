import { isAdminLevelRole, isSuperAdminRole } from "@/lib/roles";
import {
  validateEmployeeProfileChanges,
  type EmployeeProfileChanges,
} from "@/lib/employee-profile";
import { getProfileApiContext } from "@/lib/server/profile-auth";

export async function GET(request: Request) {
  const context = await getProfileApiContext(request);
  if ("error" in context) {
    return Response.json(
      { error: context.error },
      { status: context.status },
    );
  }
  if (!isAdminLevelRole(context.profile.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await context.admin
    .from("employee_profile_change_requests")
    .select(
      "id,employee_id,current_values,proposed_changes,status,review_notes,created_at,employees(id,name,title,employee_code)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (result.error) {
    return Response.json({ error: result.error.message }, { status: 500 });
  }

  let requests = result.data || [];
  if (!isSuperAdminRole(context.profile.role)) {
    const employeeIds = requests.map((item) => item.employee_id);
    if (employeeIds.length) {
      const superAdminResult = await context.admin
        .from("profiles")
        .select("employee_id")
        .in("employee_id", employeeIds)
        .ilike("role", "super admin");
      const blocked = new Set(
        (superAdminResult.data || []).map((item) => item.employee_id),
      );
      requests = requests.filter((item) => !blocked.has(item.employee_id));
    }
  }

  return Response.json({ requests });
}

export async function POST(request: Request) {
  const context = await getProfileApiContext(request);
  if ("error" in context) {
    return Response.json(
      { error: context.error },
      { status: context.status },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const validation = validateEmployeeProfileChanges(body);
  if (validation.error) {
    return Response.json({ error: validation.error }, { status: 400 });
  }

  const employeeId = context.profile.employee_id;
  const [employeeResult, statutoryResult, pendingResult] = await Promise.all([
    context.admin
      .from("employees")
      .select(
        "employee_code,title,name,gender,email,role,department,date_of_joining,date_of_birth,epf_number,uan_number",
      )
      .eq("id", employeeId)
      .single(),
    context.admin
      .from("employee_statutory_details")
      .select("pan_number,aadhaar_number")
      .eq("employee_id", employeeId)
      .maybeSingle(),
    context.admin
      .from("employee_profile_change_requests")
      .select("id")
      .eq("employee_id", employeeId)
      .eq("status", "pending")
      .maybeSingle(),
  ]);
  if (pendingResult.data) {
    return Response.json(
      { error: "You already have a profile change awaiting approval." },
      { status: 409 },
    );
  }
  if (
    employeeResult.error ||
    !employeeResult.data ||
    statutoryResult.error ||
    pendingResult.error
  ) {
    return Response.json(
      {
        error:
          employeeResult.error?.message ||
          statutoryResult.error?.message ||
          pendingResult.error?.message ||
          "Unable to prepare profile change request",
      },
      { status: 500 },
    );
  }

  const currentValues: EmployeeProfileChanges = {
    ...employeeResult.data,
    pan_number: statutoryResult.data?.pan_number || null,
    aadhaar_number: statutoryResult.data?.aadhaar_number || null,
  };
  if (JSON.stringify(currentValues) === JSON.stringify(validation.value)) {
    return Response.json(
      { error: "No profile changes were detected." },
      { status: 400 },
    );
  }

  const insertResult = await context.admin
    .from("employee_profile_change_requests")
    .insert({
      employee_id: employeeId,
      requested_by: context.user.id,
      current_values: currentValues,
      proposed_changes: validation.value,
    })
    .select("id,status,created_at")
    .single();
  if (insertResult.error) {
    return Response.json({ error: insertResult.error.message }, { status: 500 });
  }

  return Response.json({ request: insertResult.data }, { status: 201 });
}
