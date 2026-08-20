import {
  hasSuperAdminAccess,
  isAdminLevelRole,
  isFinanceAdminRole,
} from "@/lib/roles";
import {
  emptyEmployeeProfileChanges,
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

  const searchParams = new URL(request.url).searchParams;
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(
    50,
    Math.max(1, Number(searchParams.get("pageSize") || 25)),
  );
  const from = (page - 1) * pageSize;
  const result = await context.admin
    .from("employee_profile_change_requests")
    .select(
      "id,employee_id,current_values,proposed_changes,status,review_notes,created_at,employees(id,name,title,employee_code,role,department)",
      { count: "exact" },
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .range(from, from + pageSize - 1);
  if (result.error) {
    return Response.json({ error: result.error.message }, { status: 500 });
  }

  let requests = result.data || [];
  if (!hasSuperAdminAccess(context.profile.role)) {
    const employeeIds = requests.map((item) => item.employee_id);
    if (employeeIds.length) {
      const superAdminResult = await context.admin
        .from("profiles")
        .select("employee_id")
        .in("employee_id", employeeIds)
        .in("role", ["Finance Admin", "Super Admin"]);
      const blocked = new Set(
        (superAdminResult.data || []).map((item) => item.employee_id),
      );
      requests = requests.filter((item) => !blocked.has(item.employee_id));
    }
  }
  if (!isFinanceAdminRole(context.profile.role)) {
    const financeKeyList = [
      "epf_number",
      "uan_number",
      "bank_account_number",
      "bank_name",
      "ifsc_code",
      "branch_name",
    ];
    const financeKeys = new Set(financeKeyList);
    requests = requests
      .filter(
        (requestItem) =>
          !financeKeyList.some(
            (key) =>
              requestItem.current_values?.[key] !==
              requestItem.proposed_changes?.[key],
          ),
      )
      .map((requestItem) => ({
        ...requestItem,
        current_values: Object.fromEntries(
          Object.entries(requestItem.current_values || {}).filter(
            ([key]) => !financeKeys.has(key),
          ),
        ),
        proposed_changes: Object.fromEntries(
          Object.entries(requestItem.proposed_changes || {}).filter(
            ([key]) => !financeKeys.has(key),
          ),
        ),
      }));
  }

  return Response.json({
    requests,
    page,
    pageSize,
    total: result.count || 0,
  });
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
  if ("error" in validation) {
    return Response.json(
      { error: validation.error || "Enter valid employee details." },
      { status: 400 },
    );
  }

  const employeeId = context.profile.employee_id;
  const [
    employeeResult,
    statutoryResult,
    benefitResult,
    extendedResult,
    financeResult,
    pendingResult,
  ] =
    await Promise.all([
    context.admin
      .from("employees")
      .select(
        "employee_code,title,name,gender,email,role,level,department,date_of_joining,date_of_birth,epf_number,uan_number",
      )
      .eq("id", employeeId)
      .single(),
    context.admin
      .from("employee_statutory_details")
      .select("pan_number,aadhaar_number")
      .eq("employee_id", employeeId)
      .maybeSingle(),
    context.admin
      .from("employee_benefit_details")
      .select(
        "accidental_policy_number,accidental_policy_expiration_date,health_policy_number,health_policy_expiration_date",
      )
      .eq("employee_id", employeeId)
      .maybeSingle(),
    context.admin
      .from("employee_extended_details")
      .select(
        "phone_country_code,phone_number,marital_status,blood_group,bank_account_number,bank_name,ifsc_code,branch_name,address_line_1,address_line_2,address_line_3,city,state,country,pincode,father_name,mother_name,spouse_name,children,emergency_contact_person,emergency_contact_number,nominee_name,nominee_relationship,nominee_date_of_birth",
      )
      .eq("employee_id", employeeId)
      .maybeSingle(),
    context.admin
      .from("employee_finance_details")
      .select(
        "epf_number,uan_number,bank_account_number,bank_name,ifsc_code,branch_name",
      )
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
    extendedResult.error ||
    financeResult.error ||
    benefitResult.error ||
    pendingResult.error
  ) {
    return Response.json(
      {
        error:
          employeeResult.error?.message ||
          statutoryResult.error?.message ||
          extendedResult.error?.message ||
          financeResult.error?.message ||
          benefitResult.error?.message ||
          pendingResult.error?.message ||
          "Unable to prepare profile change request",
      },
      { status: 500 },
    );
  }

  const currentValues: EmployeeProfileChanges = {
    ...emptyEmployeeProfileChanges(),
    ...employeeResult.data,
    pan_number: statutoryResult.data?.pan_number || null,
    aadhaar_number: statutoryResult.data?.aadhaar_number || null,
    ...extendedResult.data,
    ...financeResult.data,
    ...benefitResult.data,
    children: Array.isArray(extendedResult.data?.children)
      ? extendedResult.data.children.map((child) => String(child || ""))
      : [],
  };
  const proposedChanges: EmployeeProfileChanges = {
    ...validation.value,
    employee_code: currentValues.employee_code,
    email: currentValues.email,
    role: currentValues.role,
    level: currentValues.level,
    department: currentValues.department,
    date_of_joining: currentValues.date_of_joining,
    epf_number: currentValues.epf_number,
    uan_number: currentValues.uan_number,
    accidental_policy_number:
      currentValues.accidental_policy_number,
    accidental_policy_expiration_date:
      currentValues.accidental_policy_expiration_date,
    health_policy_number: currentValues.health_policy_number,
    health_policy_expiration_date:
      currentValues.health_policy_expiration_date,
  };
  if (JSON.stringify(currentValues) === JSON.stringify(proposedChanges)) {
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
      proposed_changes: proposedChanges,
    })
    .select("id,status,created_at")
    .single();
  if (insertResult.error) {
    return Response.json({ error: insertResult.error.message }, { status: 500 });
  }

  return Response.json({ request: insertResult.data }, { status: 201 });
}
