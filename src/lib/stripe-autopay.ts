import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPublicInvoice } from "@/lib/public-invoice-payment";
import { reconcileStripePaymentIntent } from "@/lib/stripe-reconciliation";
import {
  getStripe,
  safeStripeError,
  stripePaymentMethodTypes,
  supportedCurrency,
  toMinorUnits,
} from "@/lib/stripe";

export async function attemptRecurringInvoiceAutopay(
  admin: SupabaseClient,
  invoiceId: string,
) {
  const { data: invoice, error } = await admin
    .from("invoices")
    .select(
      "id,invoice_number,client_id,status,currency,total_amount,public_payment_token,sent_to,recurring_schedule_id,autopay_attempted_at,stripe_payment_intent_id,clients(stripe_customer_id,autopay_enabled,stripe_default_payment_method_id)",
    )
    .eq("id", invoiceId)
    .single();
  if (error || !invoice) throw new Error("Invoice not found");
  if (invoice.autopay_attempted_at) return { attempted: false, reason: "already_attempted" };
  if (!["sent", "overdue"].includes(String(invoice.status).toLowerCase())) {
    return { attempted: false, reason: "not_payable" };
  }
  const client = Array.isArray(invoice.clients)
    ? invoice.clients[0]
    : invoice.clients;
  if (
    !client?.autopay_enabled ||
    !client.stripe_customer_id ||
    !client.stripe_default_payment_method_id
  ) {
    return { attempted: false, reason: "autopay_disabled" };
  }
  if (!invoice.recurring_schedule_id) {
    return { attempted: false, reason: "not_recurring" };
  }
  const { data: schedule } = await admin
    .from("recurring_invoice_schedules")
    .select("status,autopay_enabled")
    .eq("id", invoice.recurring_schedule_id)
    .maybeSingle();
  if (schedule?.status !== "active" || schedule.autopay_enabled !== true) {
    return { attempted: false, reason: "schedule_autopay_disabled" };
  }

  const attemptedAt = new Date().toISOString();
  const currency = supportedCurrency(invoice.currency);
  const stripe = getStripe();
  try {
    let intent = invoice.stripe_payment_intent_id
      ? await stripe.paymentIntents.retrieve(invoice.stripe_payment_intent_id)
      : null;
    if (intent?.status === "succeeded") {
      const publicInvoice = await loadPublicInvoice(
        admin,
        String(invoice.public_payment_token),
      );
      if (!publicInvoice) throw new Error("Invoice not found");
      await reconcileStripePaymentIntent({
        admin,
        invoice: publicInvoice,
        paymentIntent: intent,
        origin: "status",
      });
      return {
        attempted: true,
        paymentIntentId: intent.id,
        status: "succeeded",
      };
    }
    if (intent?.status === "processing") {
      return {
        attempted: true,
        paymentIntentId: intent.id,
        status: "processing",
      };
    }
    if (intent?.status === "canceled") {
      return {
        attempted: true,
        paymentIntentId: intent.id,
        status: "failed",
        error: "The Stripe PaymentIntent was canceled",
      };
    }
    if (!intent) {
      intent = await stripe.paymentIntents.create(
        {
          amount: toMinorUnits(invoice.total_amount, currency),
          currency: currency.toLowerCase(),
          customer: client.stripe_customer_id,
          payment_method: client.stripe_default_payment_method_id,
          payment_method_types: stripePaymentMethodTypes(),
          description: `Kairo recurring Invoice #${invoice.invoice_number}`,
          receipt_email:
            invoice.sent_to?.split(",")[0]?.trim() || undefined,
          metadata: {
            kairo_invoice_id: invoice.id,
            kairo_invoice_number: String(invoice.invoice_number),
            kairo_client_id: invoice.client_id,
            public_payment_token: String(invoice.public_payment_token),
            payment_source: "autopay",
            autopay_consent: "false",
          },
        },
        { idempotencyKey: `kairo-invoice-payment-intent:${invoice.id}` },
      );
      console.info("Stripe PaymentIntent created", {
        invoiceId: invoice.id,
        paymentIntentId: intent.id,
        attemptNumber: 1,
        source: "autopay",
      });
    } else {
      console.info("Stripe PaymentIntent reused", {
        invoiceId: invoice.id,
        paymentIntentId: intent.id,
        status: intent.status,
        source: "autopay",
      });
    }
    const stored = await admin
      .from("invoices")
      .update({
        stripe_payment_intent_id: intent.id,
        stripe_checkout_status: intent.status,
        autopay_attempted_at: attemptedAt,
        payment_attempted_at: attemptedAt,
        payment_failure_message: null,
      })
      .eq("id", invoice.id);
    if (stored.error) throw new Error("Unable to save Autopay attempt");

    await admin.from("invoice_activities").insert({
      invoice_id: invoice.id,
      event_type: "autopay_attempted",
      description: "Stripe Autopay attempted",
      created_at: attemptedAt,
    });
    const confirmed = await stripe.paymentIntents.confirm(intent.id, {
      payment_method: client.stripe_default_payment_method_id,
      off_session: true,
    });
    await admin
      .from("invoices")
      .update({ stripe_checkout_status: confirmed.status })
      .eq("id", invoice.id);
    return { attempted: true, paymentIntentId: intent.id, status: confirmed.status };
  } catch (stripeError) {
    const message = safeStripeError(stripeError);
    await admin
      .from("invoices")
      .update({
        stripe_checkout_status: "failed",
        autopay_attempted_at: attemptedAt,
        payment_failed_at: attemptedAt,
        payment_failure_message: message,
      })
      .eq("id", invoice.id);
    await admin.from("invoice_activities").insert({
      invoice_id: invoice.id,
      event_type: "autopay_action_required",
      description: `Autopay action required: ${message}`,
      created_at: attemptedAt,
    });
    return { attempted: true, status: "failed", error: message };
  }
}
