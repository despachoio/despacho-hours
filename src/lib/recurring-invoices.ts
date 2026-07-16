import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const BUSINESS_TIMEZONE = "Asia/Kolkata";

export type RecurringSchedule = {
  id: string;
  client_id: string;
  name: string;
  status: "active" | "paused" | "cancelled" | "completed";
  frequency: "weekly" | "monthly" | "quarterly" | "yearly" | "custom";
  interval_count: number;
  start_date: string;
  end_date: string | null;
  next_generation_date: string;
  currency: string;
  payment_terms_days: number;
  tax_amount: number;
  discount_amount: number;
  notes: string | null;
  email_to: string | null;
  email_cc: string | null;
  email_subject: string | null;
  email_body: string | null;
  auto_send: boolean;
  autopay_enabled: boolean;
};

export type RecurringItem = {
  project_id: string | null;
  description: string;
  hours: number;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
};

export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Recurring invoice service is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireAdmin(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer "))
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const token = authHeader.slice(7);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon)
    return {
      error: Response.json(
        { error: "Recurring invoice service is not configured" },
        { status: 500 },
      ),
    };
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser(token);
  if (error || !user)
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (
    String(profile?.role || "")
      .trim()
      .toLowerCase() !== "super admin"
  ) {
    return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { admin, user, error: null };
}

export function businessDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function clampedDate(
  year: number,
  zeroBasedMonth: number,
  preferredDay: number,
) {
  const normalized = new Date(Date.UTC(year, zeroBasedMonth, 1));
  const finalDay = new Date(
    Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return `${normalized.getUTCFullYear()}-${pad(normalized.getUTCMonth() + 1)}-${pad(Math.min(preferredDay, finalDay))}`;
}

export function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function renderEmailTemplate(
  template: string | null,
  values: Record<string, string>,
) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
    template || "",
  );
}

export function scheduledDateAt(
  schedule: Pick<
    RecurringSchedule,
    "start_date" | "frequency" | "interval_count"
  >,
  occurrenceIndex: number,
) {
  const start = parts(schedule.start_date);
  const interval = Math.max(1, Number(schedule.interval_count || 1));
  if (schedule.frequency === "weekly")
    return addDays(schedule.start_date, occurrenceIndex * interval * 7);
  if (schedule.frequency === "custom")
    return addDays(schedule.start_date, occurrenceIndex * interval);
  const months =
    schedule.frequency === "monthly"
      ? interval
      : schedule.frequency === "quarterly"
        ? interval * 3
        : interval * 12;
  return clampedDate(
    start.year,
    start.month - 1 + occurrenceIndex * months,
    start.day,
  );
}

export function nextScheduledDate(
  schedule: Pick<
    RecurringSchedule,
    "start_date" | "frequency" | "interval_count"
  >,
  afterDate: string,
) {
  for (let index = 0; index < 2400; index += 1) {
    const candidate = scheduledDateAt(schedule, index);
    if (candidate > afterDate) return candidate;
  }
  throw new Error("Unable to calculate next recurring date");
}

export async function refreshPendingOccurrences(
  admin: SupabaseClient,
  schedule: RecurringSchedule,
  createdBy?: string,
) {
  const rows: {
    recurring_schedule_id: string;
    scheduled_date: string;
    status: string;
    created_by?: string;
  }[] = [];
  let index = 0;
  while (rows.length < 12 && index < 2400) {
    const date = scheduledDateAt(schedule, index++);
    if (date < schedule.next_generation_date) continue;
    if (schedule.end_date && date > schedule.end_date) break;
    rows.push({
      recurring_schedule_id: schedule.id,
      scheduled_date: date,
      status: "pending",
      ...(createdBy ? { created_by: createdBy } : {}),
    });
  }
  if (!rows.length) return;
  const { error } = await admin
    .from("recurring_invoice_occurrences")
    .upsert(rows, {
      onConflict: "recurring_schedule_id,scheduled_date",
      ignoreDuplicates: true,
    });
  if (error)
    throw new Error(`Unable to refresh upcoming occurrences: ${error.message}`);
}

export async function generateOccurrence(
  admin: SupabaseClient,
  scheduleId: string,
  scheduledDate: string,
  createdBy?: string,
) {
  const { data: scheduleData, error: scheduleError } = await admin
    .from("recurring_invoice_schedules")
    .select("*")
    .eq("id", scheduleId)
    .single();
  if (scheduleError || !scheduleData) throw new Error("Schedule not found");
  const schedule = scheduleData as RecurringSchedule;
  if (schedule.status === "paused") throw new Error("Schedule is paused");
  if (schedule.status === "cancelled") throw new Error("Schedule is cancelled");
  if (schedule.status !== "active") throw new Error("Schedule is not active");
  if (schedule.end_date && scheduledDate > schedule.end_date)
    throw new Error("Occurrence is outside the schedule");

  let { data: occurrence } = await admin
    .from("recurring_invoice_occurrences")
    .select("*")
    .eq("recurring_schedule_id", scheduleId)
    .eq("scheduled_date", scheduledDate)
    .maybeSingle();
  if (!occurrence) {
    const created = await admin
      .from("recurring_invoice_occurrences")
      .insert({
        recurring_schedule_id: scheduleId,
        scheduled_date: scheduledDate,
        status: "pending",
        created_by: createdBy || null,
      })
      .select("*")
      .single();
    if (created.error || !created.data)
      throw new Error(
        `Recurring invoice generation failed: ${created.error?.message || "Unable to create occurrence"}`,
      );
    occurrence = created.data;
  }
  if (occurrence.status === "generated" || occurrence.generated_invoice_id)
    throw new Error("Occurrence already generated");
  if (occurrence.status === "skipped") throw new Error("Occurrence skipped");
  if (occurrence.status === "cancelled")
    throw new Error("Occurrence cancelled");

  const [
    { data: defaults, error: defaultsError },
    { data: overrides, error: overridesError },
  ] = await Promise.all([
    admin
      .from("recurring_invoice_items")
      .select(
        "project_id,description,hours,quantity,unit_price,amount,sort_order",
      )
      .eq("recurring_schedule_id", scheduleId)
      .order("sort_order"),
    admin
      .from("recurring_invoice_occurrence_items")
      .select(
        "project_id,description,hours,quantity,unit_price,amount,sort_order",
      )
      .eq("occurrence_id", occurrence.id)
      .order("sort_order"),
  ]);
  if (defaultsError || overridesError)
    throw new Error(
      `Recurring invoice generation failed: ${(defaultsError || overridesError)?.message}`,
    );
  const items = ((overrides?.length ? overrides : defaults) ||
    []) as RecurringItem[];
  if (!items.length) throw new Error("Recurring invoice has no line items");

  const issueDate = occurrence.issue_date || scheduledDate;
  const dueDate =
    occurrence.due_date ||
    addDays(issueDate, Number(schedule.payment_terms_days || 0));
  const currency = occurrence.currency || schedule.currency;
  const tax = Number(occurrence.tax_amount ?? schedule.tax_amount ?? 0);
  const discount = Number(
    occurrence.discount_amount ?? schedule.discount_amount ?? 0,
  );
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );
  const total = Math.max(0, subtotal + tax - discount);
  const hours = items.reduce((sum, item) => sum + Number(item.hours || 0), 0);
  const periodEnd = addDays(nextScheduledDate(schedule, scheduledDate), -1);

  const { data: invoice, error: invoiceError } = await admin
    .from("invoices")
    .insert({
      client_id: schedule.client_id,
      issue_date: issueDate,
      due_date: dueDate,
      currency,
      subtotal,
      tax_amount: tax,
      discount_amount: discount,
      total_amount: total,
      hours_purchased: hours,
      status: "draft",
      notes: occurrence.notes ?? schedule.notes,
      recurring_schedule_id: schedule.id,
      recurring_occurrence_id: occurrence.id,
      recurring_period_start: scheduledDate,
      recurring_period_end: periodEnd,
      generated_from_recurring: true,
      draft_email_to: occurrence.email_to ?? schedule.email_to,
      draft_email_cc: occurrence.email_cc ?? schedule.email_cc,
      draft_email_subject: occurrence.email_subject ?? schedule.email_subject,
      draft_email_body: occurrence.email_body ?? schedule.email_body,
    })
    .select("id,invoice_number,status")
    .single();

  if (invoiceError || !invoice) {
    if (invoiceError?.code === "23505")
      throw new Error("Duplicate invoice prevented");
    if (/invoice_number/i.test(invoiceError?.message || ""))
      throw new Error("Invoice number generation failed");
    throw new Error(
      `Recurring invoice generation failed: ${invoiceError?.message || "Unable to create invoice"}`,
    );
  }

  const { data: client } = await admin
    .from("clients")
    .select("name")
    .eq("id", schedule.client_id)
    .single();
  const templateValues = {
    client_name: client?.name || "Client",
    invoice_number: String(invoice.invoice_number),
    currency,
    total_amount: total.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    due_date: dueDate,
  };
  const renderedSubject = renderEmailTemplate(
    occurrence.email_subject ?? schedule.email_subject,
    templateValues,
  );
  const renderedBody = renderEmailTemplate(
    occurrence.email_body ?? schedule.email_body,
    templateValues,
  );
  await admin
    .from("invoices")
    .update({
      draft_email_subject: renderedSubject || null,
      draft_email_body: renderedBody || null,
    })
    .eq("id", invoice.id);

  const itemInsert = await admin.from("invoice_items").insert(
    items.map((item) => ({
      invoice_id: invoice.id,
      project_id: item.project_id,
      description: item.description,
      hours: Number(item.hours || 0),
      quantity: Number(item.quantity || 1),
      unit_price: Number(item.unit_price || 0),
      amount: Number(item.amount || 0),
    })),
  );
  if (itemInsert.error) {
    await admin.from("invoices").delete().eq("id", invoice.id);
    throw new Error(
      `Recurring invoice generation failed: ${itemInsert.error.message}`,
    );
  }

  const generatedAt = new Date().toISOString();
  const nextDate = nextScheduledDate(schedule, scheduledDate);
  await admin
    .from("recurring_invoice_occurrences")
    .update({
      status: "generated",
      generated_invoice_id: invoice.id,
      issue_date: issueDate,
      due_date: dueDate,
    })
    .eq("id", occurrence.id)
    .eq("status", "pending");

  const completed = Boolean(schedule.end_date && nextDate > schedule.end_date);
  await admin
    .from("recurring_invoice_schedules")
    .update({
      last_generated_at: generatedAt,
      last_generated_invoice_id: invoice.id,
      next_generation_date: nextDate,
      ...(completed ? { status: "completed" } : {}),
    })
    .eq("id", schedule.id);

  if (!completed)
    await refreshPendingOccurrences(
      admin,
      { ...schedule, next_generation_date: nextDate },
      createdBy,
    );
  return {
    invoice,
    occurrenceId: occurrence.id,
    schedule,
    autoSend: schedule.auto_send,
  };
}
