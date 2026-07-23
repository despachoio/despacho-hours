import "server-only";

import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { loadPublicInvoice } from "@/lib/public-invoice-payment";
import {
  enableInvoicePaymentNotifications,
  sendInvoicePaymentNotifications,
} from "@/lib/invoice-payment-notifications";
import {
  fromMinorUnits,
  supportedCurrency,
  toMinorUnits,
} from "@/lib/stripe";

type PublicInvoiceRecord = NonNullable<
  Awaited<ReturnType<typeof loadPublicInvoice>>
>;

function stripeId(value: string | { id: string } | null) {
  return typeof value === "string" ? value : value?.id || null;
}

export function validatePaymentIntentForInvoice(
  paymentIntent: Stripe.PaymentIntent,
  invoice: PublicInvoiceRecord,
) {
  if (paymentIntent.metadata.kairo_invoice_id !== invoice.id) {
    throw new Error("Stripe PaymentIntent invoice metadata does not match");
  }
  if (invoice.stripe_payment_intent_id !== paymentIntent.id) {
    throw new Error("Stripe PaymentIntent does not match invoice");
  }

  const currency = supportedCurrency(invoice.currency);
  if (paymentIntent.currency.toUpperCase() !== currency) {
    throw new Error("Payment currency does not match invoice");
  }
  if (paymentIntent.amount !== toMinorUnits(invoice.total_amount, currency)) {
    throw new Error("Payment amount does not match invoice");
  }

  return currency;
}

export async function reconcileStripePaymentIntent({
  admin,
  invoice,
  paymentIntent,
  origin,
}: {
  admin: SupabaseClient;
  invoice: PublicInvoiceRecord;
  paymentIntent: Stripe.PaymentIntent;
  origin: "webhook" | "status";
}) {
  const currency = validatePaymentIntentForInvoice(paymentIntent, invoice);
  if (paymentIntent.status !== "succeeded") {
    throw new Error("Stripe PaymentIntent has not succeeded");
  }
  if (paymentIntent.amount_received !== toMinorUnits(invoice.total_amount, currency)) {
    throw new Error("Payment amount received does not match invoice");
  }

  console.info("Stripe reconciliation started", {
    origin,
    invoiceId: invoice.id,
    paymentIntentId: paymentIntent.id,
  });

  const existing = await admin
    .from("payments")
    .select("id,status,stripe_payment_intent_id")
    .eq("invoice_id", invoice.id)
    .in("source", ["stripe", "autopay"])
    .eq("status", "completed")
    .maybeSingle();

  if (existing.error) {
    console.error("Stripe reconciliation failed", {
      origin,
      invoiceId: invoice.id,
      paymentIntentId: paymentIntent.id,
      error: existing.error.message,
    });
    throw new Error(existing.error.message);
  }
  if (existing.data) {
    console.info("Stripe reconciliation already completed", {
      origin,
      invoiceId: invoice.id,
      paymentIntentId: paymentIntent.id,
      recordedPaymentIntentId: existing.data.stripe_payment_intent_id,
    });
  }

  const source =
    paymentIntent.metadata.payment_source === "autopay"
      ? "autopay"
      : "stripe";
  console.info("Stripe payment RPC called", {
    origin,
    invoiceId: invoice.id,
    paymentIntentId: paymentIntent.id,
    rpc: "record_stripe_invoice_payment",
  });
  const rpc = await admin.rpc("record_stripe_invoice_payment", {
    p_invoice_id: invoice.id,
    p_amount: fromMinorUnits(paymentIntent.amount_received, currency),
    p_currency: currency,
    p_payment_intent_id: paymentIntent.id,
    p_charge_id: stripeId(paymentIntent.latest_charge),
    p_customer_id: stripeId(paymentIntent.customer),
    p_payment_method_id: stripeId(paymentIntent.payment_method),
    p_source: source,
  });

  if (rpc.error) {
    console.error("Stripe payment finalisation failure", {
      origin,
      invoiceId: invoice.id,
      paymentIntentId: paymentIntent.id,
      rpc: "record_stripe_invoice_payment",
      message: rpc.error.message,
      details: rpc.error.details,
      hint: rpc.error.hint,
      code: rpc.error.code,
    });
    throw new Error(rpc.error.message);
  }

  const result = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
  console.info("Stripe payment RPC result", {
    origin,
    invoiceId: invoice.id,
    paymentIntentId: paymentIntent.id,
    paymentId: result?.payment_id,
    invoiceStatus: result?.invoice_status,
    creditedHours: result?.credited_hours,
    projectsAffected: result?.projects_affected,
  });
  console.info("Stripe reconciliation succeeded", {
    origin,
    invoiceId: invoice.id,
    paymentIntentId: paymentIntent.id,
    paymentId: result?.payment_id,
  });
  if (!existing.data) {
    await enableInvoicePaymentNotifications(admin, invoice.id);
  }
  await sendInvoicePaymentNotifications(admin, invoice.id);
  return {
    alreadyCompleted: Boolean(existing.data),
    paymentId: result?.payment_id as string,
  };
}
