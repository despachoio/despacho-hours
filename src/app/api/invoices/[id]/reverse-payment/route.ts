import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type ReversePaymentBody = {
  reason?: unknown;
  notes?: unknown;
};

type ReversePaymentResult = {
  invoice_id: string;
  invoice_status: string;
  payment_id: string;
  total_reversed_hours: number;
  projects_affected: number;
};

function reversalError(message: string) {
  const knownErrors = [
    "Invoice not found",
    "Invoice is not paid",
    "Payment not found",
    "Payment has already been reversed.",
    "No wallet credits found for this payment",
  ];
  const known = knownErrors.find((error) => message.includes(error));
  if (known) return known;
  if (/project_hour_transactions|invoice_credit_reversal|wallet/i.test(message)) {
    return "Wallet reversal failed";
  }
  return `Payment reversal failed: ${message}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = authHeader.slice(7);
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
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

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("Reverse payment service-role configuration is missing");
    return Response.json(
      { error: "Payment reversal service is not configured" },
      { status: 500 }
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profileError) {
    console.error("Reverse payment profile lookup failed:", profileError);
    return Response.json(
      { error: "Unable to verify permissions" },
      { status: 500 }
    );
  }

  if (String(profile?.role || "").trim().toLowerCase() !== "super admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: ReversePaymentBody;
  try {
    body = (await request.json()) as ReversePaymentBody;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (!reason) {
    return Response.json({ error: "Reversal reason is required" }, { status: 400 });
  }

  const { id: invoiceId } = await params;
  const { data, error } = await adminClient
    .rpc("reverse_invoice_payment", {
      p_invoice_id: invoiceId,
      p_reason: reason,
      p_notes: notes || null,
      p_reversed_by: user.id,
    })
    .single();

  if (error || !data) {
    const actualMessage = error?.message || "Unknown database error";
    console.error("Reverse invoice payment RPC failed:", {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
      invoiceId,
    });
    const message = reversalError(actualMessage);
    const status = message === "Invoice not found" ? 404 :
      message === "Invoice is not paid" ||
      message === "Payment not found" ||
      message === "Payment has already been reversed." ? 409 : 500;
    return Response.json({ error: message }, { status });
  }

  const result = data as ReversePaymentResult;
  const notificationReset = await adminClient
    .from("invoices")
    .update({
      receipt_sent_at: null,
      receipt_sent_to: null,
      receipt_gmail_message_id: null,
      payment_intimation_sent_at: null,
      payment_intimation_sent_to: null,
      payment_intimation_gmail_message_id: null,
      payment_notification_status: "pending",
      payment_notification_claimed_at: null,
      payment_notification_error: null,
    })
    .eq("id", invoiceId);
  if (notificationReset.error) {
    console.error(
      "Payment notification state reset after reversal failed:",
      notificationReset.error,
    );
    return Response.json(
      {
        error:
          "Payment was reversed, but receipt notification state could not be reset",
      },
      { status: 500 },
    );
  }
  const { data: updatedInvoice, error: invoiceError } = await adminClient
    .from("invoices")
    .select(`
      status,
      paid_at,
      paid_amount,
      payment_method,
      payment_reference,
      payment_reversed_at,
      payment_reversal_reason
    `)
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !updatedInvoice) {
    console.error("Reversed invoice reload failed:", invoiceError);
    return Response.json(
      { error: "Payment was reversed, but the invoice could not be reloaded" },
      { status: 500 }
    );
  }

  return Response.json({
    success: true,
    paymentId: result.payment_id,
    totalReversedHours: Number(result.total_reversed_hours || 0),
    projectsAffected: Number(result.projects_affected || 0),
    invoice: updatedInvoice,
  });
}
