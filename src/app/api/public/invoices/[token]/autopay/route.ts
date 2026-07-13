import { loadPublicInvoice } from "@/lib/public-invoice-payment";
import { getServerAdminClient } from "@/lib/stripe";

export async function DELETE(
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
    const disabledAt = new Date().toISOString();
    const update = await admin
      .from("clients")
      .update({
        autopay_enabled: false,
        stripe_default_payment_method_id: null,
      })
      .eq("id", invoice.client_id);
    if (update.error) throw new Error("Unable to disable Autopay");
    await admin
      .from("recurring_invoice_schedules")
      .update({ autopay_enabled: false })
      .eq("client_id", invoice.client_id);
    await admin.from("invoice_activities").insert({
      invoice_id: invoice.id,
      event_type: "autopay_disabled",
      description: "Autopay disabled by client",
      created_at: disabledAt,
    });
    return Response.json({ success: true, autopayEnabled: false });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to disable Autopay",
      },
      { status: 500 },
    );
  }
}
