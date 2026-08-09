import { createClient } from "@supabase/supabase-js";
import {
  createSettingsAdminClient,
  loadCompanySettings,
} from "@/lib/settings/companySettings";

const EDITABLE_FIELDS = [
  "company_name",
  "legal_name",
  "address_line_1",
  "address_line_2",
  "city",
  "state_province",
  "postal_code",
  "country",
  "business_email",
  "website",
  "phone",
  "logo_url",
  "invoice_logo_url",
  "default_currency",
  "default_payment_terms_days",
  "invoice_number_prefix",
  "invoice_number_start",
  "default_tax_rate",
  "tax_label",
  "tax_registration_number",
  "bank_name",
  "bank_address",
  "institution_number",
  "routing_number",
  "swift_bic",
  "transit_number",
  "account_number",
  "account_name",
  "payroll_bank_customer_id",
  "payroll_bank_account_number",
  "payroll_bank_ifsc_code",
  "payroll_bank_branch_code",
  "payroll_bank_currency",
  "payment_instructions",
  "default_invoice_notes",
  "default_reminder_before_due_days",
  "default_reminder_after_due_days",
  "default_reminder_subject",
  "default_friendly_reminder_message",
  "default_overdue_reminder_message",
  "default_recurring_frequency",
  "default_recurring_generate_as_draft",
  "timezone",
  "date_format",
  "time_format",
] as const;

const GENERAL_FIELDS = [
  "company_name",
  "legal_name",
  "address_line_1",
  "address_line_2",
  "city",
  "state_province",
  "postal_code",
  "country",
  "business_email",
  "website",
  "phone",
  "logo_url",
  "timezone",
  "date_format",
  "time_format",
] as const;

function selectFields(
  settings: Record<string, unknown>,
  fields: readonly string[],
) {
  return Object.fromEntries(fields.map((field) => [field, settings[field]]));
}

async function requireAdmin(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer "))
    return {
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  const token = header.slice(7);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon)
    return {
      response: Response.json(
        { error: "Company settings service is not configured" },
        { status: 500 },
      ),
    };
  const authClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
  } = await authClient.auth.getUser(token);
  if (!user)
    return {
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  const admin = createSettingsAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (error)
    return {
      response: Response.json(
        { error: "Unable to verify settings access" },
        { status: 500 },
      ),
    };
  const role = String(profile?.role || "").trim().toLowerCase();
  if (!["finance admin", "super admin", "admin"].includes(role))
    return { response: Response.json({ error: "Forbidden" }, { status: 403 }) };
  return { user, admin, role, response: null };
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validationError(body: Record<string, unknown>) {
  if (!text(body.company_name)) return "Company name is required.";
  const email = text(body.business_email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return "Enter a valid business email.";
  const website = text(body.website);
  if (website) {
    try {
      new URL(website);
    } catch {
      return "Enter a valid website URL including https://.";
    }
  }
  if (Number(body.default_payment_terms_days) < 0)
    return "Payment terms cannot be negative.";
  if (Number(body.default_tax_rate) < 0) return "Tax rate cannot be negative.";
  if (Number(body.invoice_number_start) <= 0)
    return "Invoice number start must be positive.";
  if (!text(body.timezone)) return "Timezone is required.";
  if (!text(body.date_format)) return "Date format is required.";
  if (!text(body.time_format)) return "Time format is required.";
  return null;
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const settings = await loadCompanySettings(auth.admin);
  return Response.json({
    role: auth.role,
    settings:
      ["finance admin", "super admin"].includes(auth.role)
        ? settings
        : selectFields(
            settings as unknown as Record<string, unknown>,
            GENERAL_FIELDS,
          ),
  });
}

export async function PUT(request: Request) {
  const auth = await requireAdmin(request);
  if (auth.response || !auth.admin || !auth.user) return auth.response;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const validation = validationError(body);
  if (validation) return Response.json({ error: validation }, { status: 400 });

  const payload: Record<string, unknown> = {
    singleton_key: true,
    updated_by: auth.user.id,
    updated_at: new Date().toISOString(),
  };
  const allowedFields =
    ["finance admin", "super admin"].includes(auth.role)
      ? EDITABLE_FIELDS
      : GENERAL_FIELDS;
  for (const field of allowedFields) {
    if (Object.hasOwn(body, field)) payload[field] = body[field];
  }
  const { data, error } = await auth.admin
    .from("company_settings")
    .upsert(payload, { onConflict: "singleton_key" })
    .select("*")
    .single();
  if (error) {
    console.error("Company settings save failed:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    return Response.json(
      { error: `Settings could not be saved: ${error.message}` },
      { status: 500 },
    );
  }
  return Response.json({
    role: auth.role,
    settings:
      ["finance admin", "super admin"].includes(auth.role)
        ? data
        : selectFields(data as Record<string, unknown>, GENERAL_FIELDS),
  });
}
