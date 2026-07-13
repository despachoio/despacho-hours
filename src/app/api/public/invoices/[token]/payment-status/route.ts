import {
  loadPublicInvoice,
  publicInvoiceState,
  safeInvoicePayload,
} from "@/lib/public-invoice-payment";
import {
  reconcileStripePaymentIntent,
  validatePaymentIntentForInvoice,
} from "@/lib/stripe-reconciliation";
import { getServerAdminClient, getStripe } from "@/lib/stripe";

type NormalizedPaymentStatus =
  | "unpaid"
  | "requires_payment_method"
  | "requires_action"
  | "processing"
  | "succeeded"
  | "failed"
  | "paid"
  | "void"
  | "unavailable";

function normalizeStripeStatus(status: string): NormalizedPaymentStatus {
  if (status === "requires_payment_method") return "requires_payment_method";
  if (status === "requires_action" || status === "requires_confirmation") {
    return "requires_action";
  }
  if (status === "processing") return "processing";
  if (status === "succeeded") return "succeeded";
  if (status === "canceled") return "failed";
  return "unavailable";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const admin = getServerAdminClient();
    let invoice = await loadPublicInvoice(admin, token);
    if (!invoice) {
      return Response.json({ status: "unavailable" }, { status: 404 });
    }

    const invoiceState = publicInvoiceState(invoice.status);
    if (invoiceState === "paid") {
      return Response.json({
        status: "paid",
        invoice: safeInvoicePayload(invoice),
      });
    }
    if (invoiceState === "void") {
      return Response.json({
        status: "void",
        invoice: safeInvoicePayload(invoice),
      });
    }
    if (invoiceState !== "payable") {
      return Response.json({
        status: "unavailable",
        invoice: safeInvoicePayload(invoice),
      });
    }
    if (!invoice.stripe_payment_intent_id) {
      return Response.json({
        status: "unpaid",
        invoice: safeInvoicePayload(invoice),
      });
    }

    let paymentIntent;
    try {
      paymentIntent = await getStripe().paymentIntents.retrieve(
        invoice.stripe_payment_intent_id,
      );
      validatePaymentIntentForInvoice(paymentIntent, invoice);
    } catch (error) {
      console.error("Stripe payment status unavailable", {
        invoiceId: invoice.id,
        paymentIntentId: invoice.stripe_payment_intent_id,
        error: error instanceof Error ? error.message : "Unknown Stripe error",
      });
      return Response.json({
        status: "unavailable",
        invoice: safeInvoicePayload(invoice),
      });
    }

    let normalizedStatus = normalizeStripeStatus(paymentIntent.status);
    if (normalizedStatus === "succeeded") {
      const priorPayment = await admin
        .from("payments")
        .select("status")
        .eq("stripe_payment_intent_id", paymentIntent.id)
        .maybeSingle();
      if (priorPayment.error) throw new Error(priorPayment.error.message);
      if (priorPayment.data?.status === "reversed") {
        return Response.json({
          status: "failed",
          invoice: safeInvoicePayload(invoice),
          failureMessage:
            "The previous payment was reversed. A new payment attempt is required.",
        });
      }
      try {
        await reconcileStripePaymentIntent({
          admin,
          invoice,
          paymentIntent,
          origin: "status",
        });
        invoice = (await loadPublicInvoice(admin, token)) || invoice;
        if (publicInvoiceState(invoice.status) === "paid") {
          normalizedStatus = "paid";
          console.info("Stripe reconciliation completed", {
            origin: "status",
            invoiceId: invoice.id,
            paymentIntentId: paymentIntent.id,
          });
        } else {
          throw new Error("Payment RPC completed but invoice is not Paid");
        }
      } catch (error) {
        console.error("Stripe payment finalisation failure", {
          origin: "status",
          invoiceId: invoice.id,
          paymentIntentId: paymentIntent.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        // Stripe has confirmed the charge. Keep the safe succeeded state so the
        // customer is never invited to submit another payment while operations
        // can investigate the database reconciliation failure.
      }
    }

    return Response.json({
      status: normalizedStatus,
      invoice: safeInvoicePayload(invoice),
      failureMessage:
        normalizedStatus === "requires_payment_method"
          ? paymentIntent.last_payment_error?.message || null
          : null,
    });
  } catch (error) {
    console.error("Stripe payment status failed", {
      error: error instanceof Error ? error.message : "Unknown server error",
    });
    return Response.json({ status: "unavailable" }, { status: 500 });
  }
}
