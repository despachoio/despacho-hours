import {
  loadPublicInvoice,
  safeInvoicePayload,
} from "@/lib/public-invoice-payment";
import { getServerAdminClient } from "@/lib/stripe";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const invoice = await loadPublicInvoice(getServerAdminClient(), token);
    if (!invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }
    return Response.json({ invoice: safeInvoicePayload(invoice) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment service unavailable";
    return Response.json({ error: message }, { status: 500 });
  }
}
