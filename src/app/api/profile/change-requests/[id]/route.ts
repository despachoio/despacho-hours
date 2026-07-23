import { isAdminLevelRole, isFinanceAdminRole } from "@/lib/roles";
import { getProfileApiContext } from "@/lib/server/profile-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  let body: { decision?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const decision = String(body.decision || "").trim().toLowerCase();
  const notes =
    typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : "";
  if (!["approved", "rejected"].includes(decision)) {
    return Response.json(
      { error: "Decision must be approved or rejected." },
      { status: 400 },
    );
  }

  const { id } = await params;
  if (!isFinanceAdminRole(context.profile.role)) {
    const requestResult = await context.admin
      .from("employee_profile_change_requests")
      .select("current_values,proposed_changes")
      .eq("id", id)
      .single();
    if (requestResult.error || !requestResult.data) {
      return Response.json(
        { error: "Profile change request not found." },
        { status: 404 },
      );
    }
    const financeKeys = [
      "epf_number",
      "uan_number",
      "bank_account_number",
      "bank_name",
      "ifsc_code",
      "branch_name",
    ];
    if (
      financeKeys.some(
        (key) =>
          requestResult.data.current_values?.[key] !==
          requestResult.data.proposed_changes?.[key],
      )
    ) {
      return Response.json(
        {
          error:
            "Only a Finance Admin can review a request containing finance changes.",
        },
        { status: 403 },
      );
    }
  }
  const result = await context.userClient.rpc(
    "review_employee_profile_change_request",
    {
      p_request_id: id,
      p_decision: decision,
      p_notes: notes || null,
    },
  );
  if (result.error) {
    const forbidden = /not authorised|super admin/i.test(result.error.message);
    const conflict = /already been reviewed/i.test(result.error.message);
    return Response.json(
      { error: result.error.message },
      { status: forbidden ? 403 : conflict ? 409 : 500 },
    );
  }

  return Response.json({ success: true, request: result.data });
}
