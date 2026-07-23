import { getProfileApiContext } from "@/lib/server/profile-auth";

export async function GET(request: Request) {
  const context = await getProfileApiContext(request);
  if ("error" in context) {
    return Response.json(
      { error: context.error },
      { status: context.status },
    );
  }

  const employeeId = context.profile.employee_id;
  const [
    employeeResult,
    statutoryResult,
    requestResult,
  ] = await Promise.all([
    context.admin
      .from("employees")
      .select(
        "id,employee_code,title,name,gender,email,role,department,date_of_joining,date_of_birth,epf_number,uan_number,reporting_manager_id,status",
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
      .select(
        "id,status,proposed_changes,review_notes,created_at,reviewed_at",
      )
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (employeeResult.error || !employeeResult.data) {
    return Response.json(
      { error: employeeResult.error?.message || "Employee profile not found" },
      { status: 404 },
    );
  }
  if (statutoryResult.error || requestResult.error) {
    return Response.json(
      {
        error:
          statutoryResult.error?.message ||
          requestResult.error?.message ||
          "Unable to load employee profile",
      },
      { status: 500 },
    );
  }

  let reportingManager: { id: string; name: string; title: string | null } | null =
    null;
  if (employeeResult.data.reporting_manager_id) {
    const managerResult = await context.admin
      .from("employees")
      .select("id,name,title")
      .eq("id", employeeResult.data.reporting_manager_id)
      .maybeSingle();
    reportingManager = managerResult.data || null;
  }

  return Response.json({
    employee: employeeResult.data,
    statutory: statutoryResult.data || {
      pan_number: null,
      aadhaar_number: null,
    },
    reportingManager,
    accessRole: context.profile.role,
    requests: requestResult.data || [],
  });
}
