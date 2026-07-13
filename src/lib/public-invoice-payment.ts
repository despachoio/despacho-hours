import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadPublicInvoice(admin: SupabaseClient, token: string) {
  const { data: invoice, error } = await admin
    .from("invoices")
    .select(
      "id,invoice_number,client_id,issue_date,due_date,currency,total_amount,status,public_payment_token,stripe_payment_intent_id,stripe_payment_attempt_number,stripe_checkout_status,payment_link_created_at,payment_failure_message,generated_from_recurring,recurring_schedule_id,sent_to,clients(id,name,stripe_customer_id,autopay_enabled,stripe_default_payment_method_id),invoice_items(description,hours,quantity,amount,projects(name,project_code))",
    )
    .eq("public_payment_token", token)
    .maybeSingle();

  if (error || !invoice) return null;
  const client = Array.isArray(invoice.clients)
    ? invoice.clients[0]
    : invoice.clients;
  let recurringActive = false;
  if (invoice.generated_from_recurring && invoice.recurring_schedule_id) {
    const { data: schedule } = await admin
      .from("recurring_invoice_schedules")
      .select("status")
      .eq("id", invoice.recurring_schedule_id)
      .maybeSingle();
    recurringActive = schedule?.status === "active";
  }
  return {
    ...invoice,
    clients: client || null,
    recurringActive,
  };
}

export function publicInvoiceState(statusValue: string) {
  const status = String(statusValue || "").trim().toLowerCase();
  if (status === "paid") return "paid" as const;
  if (status === "void") return "void" as const;
  if (status === "draft") return "unavailable" as const;
  if (status === "cancelled") return "unavailable" as const;
  if (status === "sent" || status === "overdue") return "payable" as const;
  return "unavailable" as const;
}

export function safeInvoicePayload(
  invoice: NonNullable<Awaited<ReturnType<typeof loadPublicInvoice>>>,
) {
  return {
    invoiceNumber: invoice.invoice_number,
    clientName: invoice.clients?.name || "Client",
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    currency: invoice.currency,
    totalAmount: Number(invoice.total_amount || 0),
    status: invoice.status,
    state: publicInvoiceState(invoice.status),
    checkoutStatus: invoice.stripe_checkout_status,
    failureMessage: invoice.payment_failure_message,
    autopayEligible: invoice.recurringActive,
    autopayEnabled: invoice.clients?.autopay_enabled === true,
    items: (invoice.invoice_items || []).map((item) => {
      const project = Array.isArray(item.projects)
        ? item.projects[0]
        : item.projects;
      return {
        description: item.description,
        hours: Number(item.hours || 0),
        quantity: Number(item.quantity || 0),
        amount: Number(item.amount || 0),
        projectName: project?.name || null,
        projectCode: project?.project_code || null,
      };
    }),
  };
}
