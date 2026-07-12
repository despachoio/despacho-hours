import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type VoidInvoiceBody = {
  reason?: unknown;
  notes?: unknown;
};

function statusError(status: string) {
  switch (status) {
    case "draft": return "Draft invoices cannot be voided";
    case "paid": return "Paid invoices cannot be voided";
    case "void": return "Invoice is already void";
    case "cancelled": return "Cancelled invoices cannot be voided";
    default: return "Only sent or overdue invoices can be voided";
  }
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
    console.error("Void invoice service-role configuration is missing");
    return Response.json({ error: "Void invoice service is not configured" }, { status: 500 });
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
    console.error("Void invoice profile lookup failed:", profileError);
    return Response.json({ error: "Unable to verify permissions" }, { status: 500 });
  }
  if (String(profile?.role || "").trim().toLowerCase() !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: VoidInvoiceBody;
  try {
    body = (await request.json()) as VoidInvoiceBody;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (!reason) {
    return Response.json({ error: "Void reason is required" }, { status: 400 });
  }

  const { id: invoiceId } = await params;
  const { data: invoice, error: invoiceError } = await adminClient
    .from("invoices")
    .select("id,status")
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    return Response.json({ error: "Invoice not found" }, { status: 404 });
  }

  const normalizedStatus = String(invoice.status || "").trim().toLowerCase();
  if (!['sent', 'overdue'].includes(normalizedStatus)) {
    return Response.json({ error: statusError(normalizedStatus) }, { status: 409 });
  }

  const voidedAt = new Date().toISOString();
  const { data: updatedInvoice, error: updateError } = await adminClient
    .from("invoices")
    .update({
      status: "void",
      voided_at: voidedAt,
      voided_by: user.id,
      void_reason: reason,
      void_notes: notes || null,
    })
    .eq("id", invoiceId)
    .in("status", ["sent", "overdue"])
    .select("id,status,voided_at,voided_by,void_reason,void_notes")
    .maybeSingle();

  if (updateError) {
    console.error("Void invoice update failed:", {
      message: updateError.message,
      details: updateError.details,
      hint: updateError.hint,
      code: updateError.code,
      invoiceId,
    });
    return Response.json(
      { error: `Unable to void invoice: ${updateError.message}` },
      { status: 500 }
    );
  }
  if (!updatedInvoice) {
    return Response.json(
      { error: "Invoice status changed before it could be voided" },
      { status: 409 }
    );
  }

  return Response.json({ success: true, invoice: updatedInvoice });
}
