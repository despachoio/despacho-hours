import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type RecordPaymentBody = {
  amount?: unknown;
  paymentDate?: unknown;
  paymentMethod?: unknown;
  referenceNumber?: unknown;
  notes?: unknown;
};

type PaymentRpcResult = {
  payment_id: string;
  invoice_status: string;
  paid_at: string;
  paid_amount: number;
  payment_method: string;
  payment_reference: string | null;
};

const PAYMENT_METHODS = new Set([
  "bank_transfer",
  "credit_card",
  "ach",
  "cheque",
  "cash",
  "other",
]);

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function paymentError(message: string) {
  if (message.includes("Invoice has already been paid")) {
    return "Invoice has already been paid.";
  }
  if (message.includes("Void invoices cannot be paid")) {
    return "Void invoices cannot be paid";
  }
  if (message.includes("Cancelled invoices cannot be paid")) {
    return "Cancelled invoices cannot be paid";
  }
  if (message.includes("Partial payments are not supported")) {
    return "Partial payments are not supported yet.";
  }
  if (message.includes("No billable invoice items found")) {
    return "No billable invoice items found";
  }
  if (
    /project_hour_transactions|project_hour_wallets|wallet|invoice_credit/i.test(
      message
    )
  ) {
    return "Wallet credit failed";
  }

  return `Payment recording failed: ${message}`;
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
    console.error("Record payment service-role configuration is missing");
    return Response.json(
      { error: "Payment recording service is not configured" },
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
    console.error("Record payment profile lookup failed:", profileError);
    return Response.json(
      { error: "Unable to verify permissions" },
      { status: 500 }
    );
  }

  if (String(profile?.role || "").trim().toLowerCase() !== "super admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: RecordPaymentBody;
  try {
    body = (await request.json()) as RecordPaymentBody;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const amount = Number(body.amount);
  const paymentDate =
    typeof body.paymentDate === "string" ? body.paymentDate.trim() : "";
  const paymentMethod =
    typeof body.paymentMethod === "string" ? body.paymentMethod.trim() : "";
  const referenceNumber =
    typeof body.referenceNumber === "string" ? body.referenceNumber.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !isDate(paymentDate) ||
    !PAYMENT_METHODS.has(paymentMethod)
  ) {
    return Response.json(
      { error: "Enter valid payment details" },
      { status: 400 }
    );
  }

  const { id: invoiceId } = await params;
  const { data: invoice, error: invoiceError } = await adminClient
    .from("invoices")
    .select("id, status, total_amount, currency")
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    return Response.json({ error: "Invoice not found" }, { status: 404 });
  }

  const normalizedStatus = String(invoice.status || "").trim().toLowerCase();
  if (normalizedStatus === "paid") {
    return Response.json(
      { error: "Invoice has already been paid." },
      { status: 409 }
    );
  }
  if (normalizedStatus === "void") {
    return Response.json(
      { error: "Void invoices cannot be paid" },
      { status: 409 }
    );
  }
  if (normalizedStatus === "cancelled") {
    return Response.json(
      { error: "Cancelled invoices cannot be paid" },
      { status: 409 }
    );
  }

  if (amount.toFixed(2) !== Number(invoice.total_amount || 0).toFixed(2)) {
    return Response.json(
      { error: "Partial payments are not supported yet." },
      { status: 400 }
    );
  }

  const { data: invoiceItems, error: itemsError } = await adminClient
    .from("invoice_items")
    .select("id, project_id, hours, amount")
    .eq("invoice_id", invoiceId);

  if (itemsError) {
    console.error("Record payment invoice item lookup failed:", itemsError);
    return Response.json(
      { error: "Payment recording failed: invoice items could not be loaded" },
      { status: 500 }
    );
  }

  const billableItems = (invoiceItems || []).filter(
    (item) => item.project_id && Number(item.hours || 0) > 0
  );
  if (billableItems.length === 0) {
    return Response.json(
      { error: "No billable invoice items found" },
      { status: 400 }
    );
  }

  const { data: paymentResult, error: paymentRpcError } = await adminClient
    .rpc("record_invoice_payment", {
      p_invoice_id: invoiceId,
      p_amount: amount,
      p_payment_date: paymentDate,
      p_payment_method: paymentMethod,
      p_reference_number: referenceNumber || null,
      p_notes: notes || null,
      p_created_by: user.id,
    })
    .single();

  if (paymentRpcError || !paymentResult) {
    const actualError = paymentRpcError?.message || "Unknown database error";
    console.error("Record invoice payment RPC failed:", {
      message: paymentRpcError?.message,
      details: paymentRpcError?.details,
      hint: paymentRpcError?.hint,
      code: paymentRpcError?.code,
      invoiceId,
    });
    const error = paymentError(actualError);

    return Response.json(
      { error },
      { status: error === "Invoice has already been paid." ? 409 : 500 }
    );
  }

  const recordedPayment = paymentResult as PaymentRpcResult;

  return Response.json({
    success: true,
    paymentId: recordedPayment.payment_id,
    invoice: {
      status: recordedPayment.invoice_status,
      paid_at: recordedPayment.paid_at,
      paid_amount: Number(recordedPayment.paid_amount),
      payment_method: recordedPayment.payment_method,
      payment_reference: recordedPayment.payment_reference,
    },
  });
}
