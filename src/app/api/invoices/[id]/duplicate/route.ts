import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type DuplicateBody = {
  issueDate?: unknown;
  dueDate?: unknown;
};

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
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
    console.error("Duplicate invoice service-role configuration is missing");
    return Response.json(
      { error: "Invoice duplication service is not configured" },
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
    console.error("Duplicate invoice profile lookup failed:", profileError);
    return Response.json({ error: "Unable to verify permissions" }, { status: 500 });
  }
  if (String(profile?.role || "").trim().toLowerCase() !== "super admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: DuplicateBody;
  try {
    body = (await request.json()) as DuplicateBody;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const issueDate = typeof body.issueDate === "string" ? body.issueDate.trim() : "";
  const dueDate = typeof body.dueDate === "string" ? body.dueDate.trim() : "";
  if (!isDate(issueDate) || !isDate(dueDate)) {
    return Response.json({ error: "Enter valid issue and due dates" }, { status: 400 });
  }
  if (dueDate < issueDate) {
    return Response.json(
      { error: "Due date cannot be earlier than issue date" },
      { status: 400 }
    );
  }

  const { id: sourceInvoiceId } = await params;
  if (!sourceInvoiceId) {
    return Response.json({ error: "Invoice not found" }, { status: 404 });
  }

  const { data: sourceInvoice, error: sourceError } = await adminClient
    .from("invoices")
    .select(`
      id,
      client_id,
      currency,
      subtotal,
      tax_amount,
      total_amount,
      hours_purchased,
      notes
    `)
    .eq("id", sourceInvoiceId)
    .single();

  if (sourceError || !sourceInvoice) {
    return Response.json({ error: "Invoice not found" }, { status: 404 });
  }

  const { data: sourceItems, error: itemsError } = await adminClient
    .from("invoice_items")
    .select("project_id,description,hours,quantity,unit_price,amount")
    .eq("invoice_id", sourceInvoiceId);

  if (itemsError) {
    console.error("Duplicate invoice source item lookup failed:", itemsError);
    return Response.json({ error: "Unable to load invoice items" }, { status: 500 });
  }
  if (!sourceItems?.length) {
    return Response.json({ error: "Source invoice has no line items" }, { status: 400 });
  }

  // Drafts intentionally have no invoice number. It is assigned by the send flow.
  const { data: duplicateInvoice, error: duplicateError } = await adminClient
    .from("invoices")
    .insert({
      client_id: sourceInvoice.client_id,
      issue_date: issueDate,
      due_date: dueDate,
      currency: sourceInvoice.currency,
      subtotal: sourceInvoice.subtotal,
      tax_amount: sourceInvoice.tax_amount,
      total_amount: sourceInvoice.total_amount,
      hours_purchased: sourceInvoice.hours_purchased,
      status: "draft",
      notes: sourceInvoice.notes,
    })
    .select("id,status")
    .single();

  if (duplicateError || !duplicateInvoice) {
    console.error("Duplicate invoice creation failed:", duplicateError);
    return Response.json({ error: "Unable to create duplicate invoice" }, { status: 500 });
  }

  const { error: copyError } = await adminClient.from("invoice_items").insert(
    sourceItems.map((item) => ({
      invoice_id: duplicateInvoice.id,
      project_id: item.project_id,
      description: item.description,
      hours: item.hours,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
    }))
  );

  if (copyError) {
    console.error("Duplicate invoice item copy failed:", copyError);
    const { error: cleanupError } = await adminClient
      .from("invoices")
      .delete()
      .eq("id", duplicateInvoice.id);
    if (cleanupError) {
      console.error("Duplicate invoice cleanup failed:", cleanupError);
    }
    return Response.json({ error: "Unable to copy invoice items" }, { status: 500 });
  }

  return Response.json({
    invoiceId: duplicateInvoice.id,
    status: duplicateInvoice.status,
  });
}
