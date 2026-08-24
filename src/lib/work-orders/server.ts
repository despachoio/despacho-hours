import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeRole } from "@/lib/roles";
import {
  assertWorkOrderAccess,
  canTransitionWorkOrder,
  type WorkOrderStatus,
} from "./access";
import type { WorkOrderInput } from "./types";

export type WorkOrderActor = {
  admin: SupabaseClient;
  client: SupabaseClient;
  userId: string;
  employeeId: string;
  role: string;
  name: string;
};
export async function workOrderActor(
  request: Request,
): Promise<WorkOrderActor> {
  const token = (request.headers.get("authorization") || "").replace(
    /^Bearer\s+/i,
    "",
  );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
    anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !serviceKey || !anonKey)
    throw new Error("Unauthorized");
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const user = await admin.auth.getUser(token);
  if (user.error || !user.data.user) throw new Error("Unauthorized");
  const profile = await admin
    .from("profiles")
    .select("employee_id,role,full_name")
    .eq("user_id", user.data.user.id)
    .single();
  if (profile.error) throw new Error("Unauthorized");
  const role = normalizeRole(profile.data.role);
  assertWorkOrderAccess(role);
  return {
    admin,
    client,
    userId: user.data.user.id,
    employeeId: profile.data.employee_id,
    role,
    name: profile.data.full_name || "User",
  };
}

async function audit(
  actor: WorkOrderActor,
  workOrderId: string,
  action: string,
  previous?: unknown,
  next?: unknown,
  versionId?: string,
) {
  const result = await actor.admin.from("work_order_audit_log").insert({
    work_order_id: workOrderId,
    version_id: versionId || null,
    action,
    actor_user_id: actor.userId,
    actor_role: actor.role,
    previous_value: previous || null,
    new_value: next || null,
  });
  if (result.error) throw new Error(result.error.message);
}
const value = (v: unknown) => String(v || "").trim();
function validate(input: WorkOrderInput, generate = false) {
  if (
    !input.companyName.trim() ||
    !input.effectiveDate ||
    !input.projectStartDate ||
    !input.serviceType.trim() ||
    !input.engagementModel.trim()
  )
    throw new Error("Complete the required customer, date and service fields");
  if (input.customerType === "existing_client" && !input.clientId)
    throw new Error("Select the existing Client for this Work Order");
  if (
    input.customerType === "new_client" &&
    generate &&
    (!value(input.contactName) || !value(input.email))
  )
    throw new Error(
      "Contact name and email are required before generating a new-client Work Order",
    );
  if (input.email && !/^\S+@\S+\.\S+$/.test(input.email))
    throw new Error("Enter a valid customer email address");
  if (!input.engagementOverview.trim())
    throw new Error("Add an engagement overview");
  if (input.resourceCount != null && input.resourceCount < 0)
    throw new Error("Resources cannot be negative");
  if (input.monthlyFee != null && input.monthlyFee < 0)
    throw new Error("Fees cannot be negative");
  if (input.hoursPerResourceMonth != null && input.hoursPerResourceMonth < 0)
    throw new Error("Monthly hours cannot be negative");
  if (input.hoursPerDay != null && input.hoursPerDay < 0)
    throw new Error("Daily hours cannot be negative");
  if (
    input.daysPerWeek != null &&
    (input.daysPerWeek < 0 || input.daysPerWeek > 7)
  )
    throw new Error("Days per week must be between 0 and 7");
  if (
    input.endingType === "specific_date" &&
    (!input.endDate || input.endDate < input.projectStartDate)
  )
    throw new Error("Ending date must be on or after the project start date");
  if (
    input.pricingPhases?.some(
      (phase) => !phase.label.trim() || phase.amount < 0,
    )
  )
    throw new Error(
      "Each pricing phase requires a label and a non-negative amount",
    );
  if (
    generate &&
    input.commercialModel === "tiered" &&
    !input.pricingPhases?.length
  )
    throw new Error("Add at least one pricing phase for tiered pricing");
  if (
    generate &&
    !input.monthlyFee &&
    !input.pricingPhases?.length &&
    !value(input.pricingNotes)
  )
    throw new Error("Add a fee, pricing phase, or custom pricing note");
  if (generate && !input.termsTemplateId)
    throw new Error(
      "Select an approved Terms template before generating the Work Order",
    );
}
function values(input: WorkOrderInput, actor: WorkOrderActor) {
  return {
    customer_type: input.customerType,
    client_id: input.clientId || null,
    company_name: input.companyName.trim(),
    contact_name: value(input.contactName) || null,
    email: value(input.email) || null,
    phone: value(input.phone) || null,
    address: value(input.address) || null,
    city: value(input.city) || null,
    state: value(input.state) || null,
    postal_code: value(input.postalCode) || null,
    country: value(input.country) || null,
    template_type: input.templateType,
    commercial_model: input.commercialModel,
    billing_basis: input.billingBasis,
    resource_count: input.resourceCount ?? null,
    hours_per_resource_month: input.hoursPerResourceMonth ?? null,
    hours_per_day: input.hoursPerDay ?? null,
    days_per_week: input.daysPerWeek ?? null,
    working_commitment_custom: value(input.workingCommitmentCustom) || null,
    currency: input.currency,
    monthly_fee: input.monthlyFee ?? null,
    pricing_notes: value(input.pricingNotes) || null,
    location: value(input.location) || null,
    rate_increase_terms: value(input.rateIncreaseTerms) || null,
    effective_date: input.effectiveDate,
    first_invoice_date: input.firstInvoiceDate || null,
    project_start_date: input.projectStartDate,
    ending_type: input.endingType,
    end_date: input.endDate || null,
    service_type: input.serviceType,
    engagement_model: input.engagementModel,
    engagement_overview: input.engagementOverview,
    payment_terms_days: input.paymentTermsDays ?? null,
    payment_terms_custom: value(input.paymentTermsCustom) || null,
    late_payment_terms: value(input.latePaymentTerms) || null,
    long_term_clause_enabled: !!input.longTermClauseEnabled,
    future_hires_clause_enabled: !!input.futureHiresClauseEnabled,
    additional_headcount_clause_enabled:
      !!input.additionalHeadcountClauseEnabled,
    premium_work_clause_enabled: !!input.premiumWorkClauseEnabled,
    custom_terms: value(input.customTerms) || null,
    terms_template_id: input.termsTemplateId || null,
    updated_by: actor.userId,
    updated_at: new Date().toISOString(),
  };
}

export async function reserveWorkOrderNumber(
  request: Request,
  newClient: boolean,
) {
  const actor = await workOrderActor(request);
  const r = await actor.client.rpc("reserve_work_order_identity", {
    p_new_client: newClient,
  });
  if (r.error) throw new Error(r.error.message);
  return r.data?.[0];
}
export async function workOrderBootstrap(request: Request) {
  const actor = await workOrderActor(request);
  const [clients, terms] = await Promise.all([
    actor.admin
      .from("clients")
      .select(
        "id,name,business_client_id,status,client_contacts(name,email,phone,is_primary,is_active)",
      )
      .eq("status", "active")
      .order("name"),
    actor.admin
      .from("terms_templates")
      .select("id,name,version,effective_from")
      .eq("active", true)
      .order("effective_from", { ascending: false }),
  ]);
  if (clients.error || terms.error)
    throw new Error((clients.error || terms.error)?.message);
  return { clients: clients.data, terms: terms.data };
}
export async function saveWorkOrder(
  request: Request,
  input: WorkOrderInput,
  generate = false,
) {
  const actor = await workOrderActor(request);
  validate(input, generate);
  let record;
  let payload: { [key: string]: unknown } = { ...values(input, actor) };
  if (input.customerType === "existing_client") {
    const client = await actor.admin
      .from("clients")
      .select("id,business_client_id")
      .eq("id", input.clientId!)
      .single();
    if (client.error)
      throw new Error("The selected Client is no longer available");
    payload = {
      ...payload,
      client_business_id: client.data.business_client_id ?? null,
    };
  }
  if (input.id) {
    const existing = await actor.admin
      .from("work_orders")
      .select("*")
      .eq("id", input.id)
      .single();
    if (existing.error) throw new Error(existing.error.message);
    if (!["draft", "generated"].includes(existing.data.status))
      throw new Error("Sent or signed Work Orders require a new revision");
    record = await actor.admin
      .from("work_orders")
      .update(payload)
      .eq("id", input.id)
      .select("*")
      .single();
    if (!record.error)
      await audit(actor, input.id, "edited", existing.data, record.data);
  } else {
    if (!input.reservationId)
      throw new Error("Reserve a Work Order number first");
    record = await actor.admin
      .from("work_orders")
      .insert({
        ...payload,
        reservation_id: input.reservationId,
        created_by: actor.userId,
      })
      .select("*")
      .single();
    if (!record.error)
      await actor.admin
        .from("work_order_number_reservations")
        .update({ work_order_id: record.data.id })
        .eq("id", input.reservationId);
    if (!record.error)
      await audit(actor, record.data.id, "created", undefined, record.data);
  }
  if (record.error)
    throw new Error(
      record.error.code === "23505"
        ? "Work Order number or Client ID is already in use."
        : record.error.message,
    );
  const id = record.data.id;
  await actor.admin
    .from("work_order_pricing_phases")
    .delete()
    .eq("work_order_id", id);
  if (input.pricingPhases?.length) {
    const phases = await actor.admin.from("work_order_pricing_phases").insert(
      input.pricingPhases.map((p, i) => ({
        work_order_id: id,
        sort_order: i + 1,
        label: p.label,
        description: p.description || null,
        start_month: p.startMonth ?? null,
        end_month: p.endMonth ?? null,
        amount: p.amount,
        currency: p.currency,
        billing_basis: p.billingBasis,
      })),
    );
    if (phases.error) throw new Error(phases.error.message);
  }
  if (!generate) return record.data;
  const terms = await actor.admin
    .from("terms_templates")
    .select("*")
    .eq("id", input.termsTemplateId!)
    .eq("active", true)
    .single();
  if (terms.error) throw new Error("The selected Terms template is not active");
  const phases = await actor.admin
    .from("work_order_pricing_phases")
    .select("*")
    .eq("work_order_id", id)
    .order("sort_order");
  const version = Number(record.data.current_version || 0) + 1;
  const snapshot = {
    workOrder: { ...record.data, ...values(input, actor) },
    pricingPhases: phases.data || [],
    terms: terms.data,
  };
  const v = await actor.admin
    .from("work_order_versions")
    .insert({
      work_order_id: id,
      version_number: version,
      terms_template_id: terms.data.id,
      terms_version: terms.data.version,
      snapshot_json: snapshot,
      generated_by: actor.userId,
    })
    .select("*")
    .single();
  if (v.error) throw new Error(v.error.message);
  const done = await actor.admin
    .from("work_orders")
    .update({
      status: "generated",
      current_version: version,
      terms_version: terms.data.version,
      updated_by: actor.userId,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (done.error) throw new Error(done.error.message);
  await audit(actor, id, "generated", record.data, done.data, v.data.id);
  return done.data;
}
export async function searchWorkOrders(
  request: Request,
  params: URLSearchParams,
) {
  const actor = await workOrderActor(request);
  const page = Math.max(Number(params.get("page") || 1), 1),
    limit = 25;
  let q = actor.admin
    .from("work_orders")
    .select(
      "id,work_order_number,client_business_id,company_name,status,effective_date,project_start_date,resource_count,commercial_model,currency,monthly_fee,current_version,updated_at",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  const number = params.get("number"),
    company = params.get("company"),
    status = params.get("status"),
    from = params.get("from"),
    to = params.get("to");
  if (number) q = q.ilike("work_order_number", `%${number}%`);
  if (company) q = q.ilike("company_name", `%${company}%`);
  if (status) q = q.eq("status", status);
  if (from) q = q.gte("effective_date", from);
  if (to) q = q.lte("effective_date", to);
  const result = await q;
  if (result.error) throw new Error(result.error.message);
  return { rows: result.data, count: result.count, page, pageSize: limit };
}
export async function loadWorkOrder(request: Request, id: string) {
  const actor = await workOrderActor(request);
  const [wo, versions, auditLog, phases, latestVersion] = await Promise.all([
    actor.admin.from("work_orders").select("*").eq("id", id).single(),
    actor.admin
      .from("work_order_versions")
      .select("id,version_number,terms_version,generated_at")
      .eq("work_order_id", id)
      .order("version_number", { ascending: false }),
    actor.admin
      .from("work_order_audit_log")
      .select("*")
      .eq("work_order_id", id)
      .order("created_at", { ascending: false }),
    actor.admin
      .from("work_order_pricing_phases")
      .select("*")
      .eq("work_order_id", id)
      .order("sort_order"),
    actor.admin
      .from("work_order_versions")
      .select("id,version_number,terms_version,snapshot_json,generated_at")
      .eq("work_order_id", id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (
    wo.error ||
    versions.error ||
    auditLog.error ||
    phases.error ||
    latestVersion.error
  )
    throw new Error(
      (
        wo.error ||
        versions.error ||
        auditLog.error ||
        phases.error ||
        latestVersion.error
      )?.message,
    );
  return {
    workOrder: wo.data,
    versions: versions.data,
    audit: auditLog.data,
    pricingPhases: phases.data,
    latestVersion: latestVersion.data,
  };
}
export async function changeWorkOrderStatus(
  request: Request,
  id: string,
  to: WorkOrderStatus,
) {
  const actor = await workOrderActor(request);
  const existing = await actor.admin
    .from("work_orders")
    .select("*")
    .eq("id", id)
    .single();
  if (existing.error) throw new Error(existing.error.message);
  if (!canTransitionWorkOrder(existing.data.status, to))
    throw new Error(
      `Cannot change a Work Order from ${existing.data.status} to ${to}`,
    );
  const timestamps =
    to === "sent"
      ? { sent_at: new Date().toISOString() }
      : to === "signed"
        ? { signed_at: new Date().toISOString() }
        : to === "onboarded"
          ? { onboarded_at: new Date().toISOString() }
          : to === "cancelled"
            ? { cancelled_at: new Date().toISOString() }
            : {};
  const updated = await actor.admin
    .from("work_orders")
    .update({ status: to, ...timestamps, updated_by: actor.userId })
    .eq("id", id)
    .select("*")
    .single();
  if (updated.error) throw new Error(updated.error.message);
  await audit(
    actor,
    id,
    "status_changed",
    { status: existing.data.status },
    { status: to },
  );
  return updated.data;
}

export async function deleteWorkOrder(request: Request, id: string) {
  const actor = await workOrderActor(request);
  const existing = await actor.admin
    .from("work_orders")
    .select("*")
    .eq("id", id)
    .single();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data.status !== "draft")
    throw new Error(
      "Only draft Work Orders can be permanently deleted. Cancel generated Work Orders instead.",
    );
  await audit(actor, id, "deleted", existing.data);
  const removed = await actor.admin.from("work_orders").delete().eq("id", id);
  if (removed.error) throw new Error(removed.error.message);
  return { ok: true };
}

export async function createWorkOrderRevision(request: Request, id: string) {
  const actor = await workOrderActor(request);
  const source = await actor.admin
    .from("work_orders")
    .select("*")
    .eq("id", id)
    .single();
  if (source.error) throw new Error(source.error.message);
  if (!["generated", "sent", "signed"].includes(source.data.status))
    throw new Error(
      "Only generated, sent or signed Work Orders require a revision",
    );
  const reserved = await actor.client.rpc("reserve_work_order_identity", {
    p_new_client: false,
  });
  if (reserved.error) throw new Error(reserved.error.message);
  const r = reserved.data?.[0];
  const omitted = new Set([
    "id",
    "reservation_id",
    "work_order_number",
    "sequence_number",
    "status",
    "current_version",
    "created_at",
    "updated_at",
    "sent_at",
    "signed_at",
    "onboarded_at",
    "cancelled_at",
    "docusign_envelope_id",
    "docusign_status",
    "signed_document_path",
  ]);
  const clone = Object.fromEntries(
    Object.entries(source.data).filter(([key]) => !omitted.has(key)),
  );
  const inserted = await actor.admin
    .from("work_orders")
    .insert({
      ...clone,
      reservation_id: r.id,
      parent_work_order_id: id,
      status: "draft",
      current_version: 0,
      created_by: actor.userId,
      updated_by: actor.userId,
    })
    .select("*")
    .single();
  if (inserted.error) throw new Error(inserted.error.message);
  await actor.admin
    .from("work_order_number_reservations")
    .update({ work_order_id: inserted.data.id })
    .eq("id", r.id);
  const phases = await actor.admin
    .from("work_order_pricing_phases")
    .select("*")
    .eq("work_order_id", id);
  if (phases.error) throw new Error(phases.error.message);
  if (phases.data?.length) {
    const copiedRows = phases.data.map((row) => {
      const copy = { ...row, work_order_id: inserted.data.id };
      delete copy.id;
      return copy;
    });
    const copied = await actor.admin
      .from("work_order_pricing_phases")
      .insert(copiedRows);
    if (copied.error) throw new Error(copied.error.message);
  }
  await audit(
    actor,
    inserted.data.id,
    "revision_created",
    { sourceWorkOrderId: id },
    inserted.data,
  );
  return inserted.data;
}

export async function createClientFromWorkOrder(
  request: Request,
  id: string,
  confirmedDuplicateId?: string,
) {
  const actor = await workOrderActor(request);
  const wo = await actor.admin
    .from("work_orders")
    .select("*")
    .eq("id", id)
    .single();
  if (wo.error) throw new Error(wo.error.message);
  if (wo.data.status !== "signed")
    throw new Error(
      "A Client can be created only after the Work Order is signed",
    );
  if (wo.data.client_id) return { clientId: wo.data.client_id, existing: true };
  const [byBusinessId, byName] = await Promise.all([
    wo.data.client_business_id
      ? actor.admin
          .from("clients")
          .select("id,name,business_client_id")
          .eq("business_client_id", wo.data.client_business_id)
      : Promise.resolve({ data: [], error: null }),
    actor.admin
      .from("clients")
      .select("id,name,business_client_id")
      .ilike("name", wo.data.company_name),
  ]);
  if (byBusinessId.error || byName.error)
    throw new Error((byBusinessId.error || byName.error)?.message);
  const found = Array.from(
    new Map(
      [...(byBusinessId.data || []), ...(byName.data || [])].map(
        (candidate) => [candidate.id, candidate],
      ),
    ).values(),
  );
  if (found.length && !confirmedDuplicateId)
    return { requiresDecision: true, candidates: found };
  if (confirmedDuplicateId && confirmedDuplicateId !== "__create_new__") {
    if (!found.some((candidate) => candidate.id === confirmedDuplicateId))
      throw new Error("The selected duplicate Client is no longer available");
    const linked = await actor.admin
      .from("work_orders")
      .update({ client_id: confirmedDuplicateId, updated_by: actor.userId })
      .eq("id", id);
    if (linked.error) throw new Error(linked.error.message);
    await audit(actor, id, "existing_client_linked", undefined, {
      clientId: confirmedDuplicateId,
    });
    return { clientId: confirmedDuplicateId, existing: true };
  }
  if (!wo.data.email)
    throw new Error(
      "A primary contact email is required before creating the Client",
    );
  const created = await actor.admin
    .from("clients")
    .insert({
      name: wo.data.company_name,
      status: "active",
      business_client_id: wo.data.client_business_id,
    })
    .select("id")
    .single();
  if (created.error)
    throw new Error(
      created.error.code === "23505"
        ? "A Client with this Client ID already exists."
        : created.error.message,
    );
  const names = String(wo.data.contact_name || "")
    .trim()
    .split(/\s+/);
  const contact = await actor.admin.from("client_contacts").insert({
    client_id: created.data.id,
    first_name: names[0] || "Primary",
    last_name: names.slice(1).join(" ") || "Contact",
    name: wo.data.contact_name || "Primary Contact",
    email: wo.data.email,
    phone: wo.data.phone || null,
    is_primary: true,
    is_active: true,
  });
  if (contact.error) throw new Error(contact.error.message);
  const linked = await actor.admin
    .from("work_orders")
    .update({ client_id: created.data.id, updated_by: actor.userId })
    .eq("id", id);
  if (linked.error) throw new Error(linked.error.message);
  await audit(actor, id, "client_created", undefined, {
    clientId: created.data.id,
  });
  return { clientId: created.data.id, existing: false };
}

export async function createProjectFromWorkOrder(
  request: Request,
  id: string,
  projectCode: string,
  projectName?: string,
) {
  const actor = await workOrderActor(request);
  const wo = await actor.admin
    .from("work_orders")
    .select("*")
    .eq("id", id)
    .single();
  if (wo.error) throw new Error(wo.error.message);
  if (!wo.data.client_id || wo.data.status !== "signed")
    throw new Error(
      "Create or link the Client after signature before creating a Project",
    );
  if (!projectCode.trim())
    throw new Error(
      "Project code is required because Kairo's existing project workflow uses an explicitly assigned code",
    );
  const created = await actor.admin
    .from("projects")
    .insert({
      client_id: wo.data.client_id,
      project_code: projectCode.trim(),
      name: projectName?.trim() || wo.data.service_type,
      start_date: wo.data.project_start_date,
      status: "active",
      is_billable: true,
      purchased_hours: 0,
      used_hours: 0,
      remaining_hours: 0,
    })
    .select("id")
    .single();
  if (created.error) throw new Error(created.error.message);
  const linked = await actor.admin
    .from("work_orders")
    .update({
      project_id: created.data.id,
      status: "onboarded",
      onboarded_at: new Date().toISOString(),
      updated_by: actor.userId,
    })
    .eq("id", id);
  if (linked.error) throw new Error(linked.error.message);
  await audit(actor, id, "project_created", undefined, {
    projectId: created.data.id,
    projectCode,
  });
  return created.data;
}
