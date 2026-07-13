import {
  loadPublicInvoice,
  publicInvoiceState,
} from "@/lib/public-invoice-payment";
import { getServerAdminClient } from "@/lib/stripe";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const admin = getServerAdminClient();
    const invoice = await loadPublicInvoice(admin, token);
    if (!invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (publicInvoiceState(invoice.status) !== "payable") {
      return Response.json({ recorded: false });
    }

    const { error } = await admin.from("invoice_activities").insert({
      invoice_id: invoice.id,
      event_type: "payment_page_viewed",
      description: "Client opened the online payment page",
      created_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);

    console.info("Invoice payment page viewed", { invoiceId: invoice.id });
    return Response.json({ recorded: true });
  } catch (error) {
    console.error("Invoice payment page activity failed", {
      error: error instanceof Error ? error.message : "Unknown server error",
    });
    return Response.json(
      { error: "Unable to record payment page activity" },
      { status: 500 },
    );
  }
}
