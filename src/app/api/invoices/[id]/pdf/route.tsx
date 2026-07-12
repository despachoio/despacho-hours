import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@supabase/supabase-js";
import { InvoicePdfDocument } from "@/components/invoices/InvoicePdfDocument";
import {
  loadCompanyLogo,
  loadCompanySettings,
} from "@/lib/settings/companySettings";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = authHeader.slice(7);

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(accessToken);

  if (userError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceRoleKey) {
    console.error(
      "PDF server configuration error: SUPABASE_SERVICE_ROLE_KEY is missing",
    );

    return Response.json(
      { error: "PDF service is not configured on the server" },
      { status: 500 },
    );
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profileError) {
    console.error("PDF profile lookup failed:", profileError);

    return Response.json(
      { error: "Unable to verify permissions" },
      { status: 500 },
    );
  }

  const normalizedRole = String(profile?.role || "")
    .trim()
    .toLowerCase();

  console.log("PDF authenticated user:", user.id);
  console.log("PDF profile role:", profile?.role);
  console.log("PDF normalized role:", normalizedRole);

  if (normalizedRole !== "admin") {
    console.error(
      "PDF 403 returned at admin role check. Forbidden for role:",
      profile?.role,
    );

    return Response.json(
      {
        error: "Forbidden",
        role: profile?.role || null,
      },
      { status: 403 },
    );
  }

  const { data: invoice, error: invoiceError } = await adminClient
    .from("invoices")
    .select(
      `
      *,
      clients(id, name)
    `,
    )
    .eq("id", id)
    .single();

  if (invoiceError || !invoice) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const { data: items, error: itemsError } = await adminClient
    .from("invoice_items")
    .select(
      `
      *,
      projects(id, name, project_code)
    `,
    )
    .eq("invoice_id", id);

  if (itemsError) {
    return NextResponse.json(
      { error: "Failed to load invoice items" },
      { status: 500 },
    );
  }

  const companySettings = await loadCompanySettings(adminClient);
  const { dataUrl: logoSrc } = await loadCompanyLogo(companySettings);

  const pdfBuffer = await renderToBuffer(
    <InvoicePdfDocument
      invoice={invoice}
      items={items ?? []}
      logoSrc={logoSrc}
      companySettings={companySettings}
    />,
  );

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Invoice-${invoice.invoice_number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
