import { createClient } from "@supabase/supabase-js";
import { sendInvoicePaymentNotifications } from "@/lib/invoice-payment-notifications";

const BATCH_SIZE = 50;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    request.headers.get("authorization") !== `Bearer ${secret}`
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return Response.json(
      { error: "Payment notification service is not configured" },
      { status: 500 },
    );
  }
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const staleBefore = new Date(Date.now() - 10 * 60_000).toISOString();
  const [retryable, stale] = await Promise.all([
    admin
      .from("invoices")
      .select("id")
      .eq("status", "paid")
      .in("payment_notification_status", ["pending", "failed"])
      .order("paid_at", { ascending: true })
      .limit(BATCH_SIZE),
    admin
      .from("invoices")
      .select("id")
      .eq("status", "paid")
      .eq("payment_notification_status", "processing")
      .lte("payment_notification_claimed_at", staleBefore)
      .order("paid_at", { ascending: true })
      .limit(BATCH_SIZE),
  ]);
  const queryError = retryable.error || stale.error;
  if (queryError) {
    return Response.json(
      { error: `Payment notification query failed: ${queryError.message}` },
      { status: 500 },
    );
  }

  const invoiceIds = Array.from(
    new Set([
      ...(retryable.data || []).map((invoice) => invoice.id),
      ...(stale.data || []).map((invoice) => invoice.id),
    ]),
  ).slice(0, BATCH_SIZE);
  const summary = {
    attempted: invoiceIds.length,
    completed: 0,
    incomplete: 0,
  };
  for (const invoiceId of invoiceIds) {
    const result = await sendInvoicePaymentNotifications(admin, invoiceId);
    if (result.sent) summary.completed++;
    else if (!result.skipped) summary.incomplete++;
  }
  return Response.json(summary);
}
