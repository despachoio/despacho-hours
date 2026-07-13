import type Stripe from "stripe";
import { loadPublicInvoice } from "@/lib/public-invoice-payment";
import { reconcileStripePaymentIntent } from "@/lib/stripe-reconciliation";
import {
  getServerAdminClient,
  getStripe,
  getStripeWebhookSecret,
  safeStripeError,
} from "@/lib/stripe";

function stripeId(value: string | { id: string } | null) {
  return typeof value === "string" ? value : value?.id || null;
}

async function invoiceForIntent(
  paymentIntent: Stripe.PaymentIntent,
  admin: ReturnType<typeof getServerAdminClient>,
) {
  const invoiceId = paymentIntent.metadata.kairo_invoice_id;
  const token = paymentIntent.metadata.public_payment_token;
  if (!invoiceId || !token) throw new Error("Stripe invoice metadata is missing");
  const invoice = await loadPublicInvoice(admin, token);
  if (!invoice || invoice.id !== invoiceId) {
    throw new Error("Invoice not found");
  }
  if (invoice.stripe_payment_intent_id !== paymentIntent.id) {
    throw new Error("Stripe PaymentIntent does not match invoice");
  }
  return invoice;
}

async function recordActivity(
  admin: ReturnType<typeof getServerAdminClient>,
  invoiceId: string,
  eventType: string,
  description: string,
) {
  const { error } = await admin.from("invoice_activities").insert({
    invoice_id: invoiceId,
    event_type: eventType,
    description,
    created_at: new Date().toISOString(),
  });
  if (error) {
    console.error("Optional invoice activity insert failed", {
      invoiceId,
      eventType,
      error: error.message,
    });
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json(
      { error: "Webhook signature verification failed" },
      { status: 400 },
    );
  }
  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      getStripeWebhookSecret(),
    );
    console.info("Stripe webhook signature verified", {
      eventId: event.id,
      eventType: event.type,
    });
  } catch {
    return Response.json(
      { error: "Webhook signature verification failed" },
      { status: 400 },
    );
  }

  const admin = getServerAdminClient();
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  console.info("Stripe webhook received", {
    eventId: event.id,
    eventType: event.type,
    paymentIntentId: paymentIntent.id,
  });
  const existing = await admin
    .from("stripe_webhook_events")
    .select("result")
    .eq("id", event.id)
    .maybeSingle();
  if (existing.error) {
    console.error("Stripe webhook lookup failed", {
      eventId: event.id,
      error: existing.error.message,
    });
    return Response.json(
      { error: "Unable to verify webhook processing state" },
      { status: 500 },
    );
  }
  if (existing.data?.result === "processed") {
    console.info("Stripe webhook already processed", {
      eventId: event.id,
      eventType: event.type,
    });
    return Response.json({ received: true, duplicate: true });
  }
  if (existing.data?.result === "processing") {
    console.warn("Stripe webhook is already processing", {
      eventId: event.id,
      eventType: event.type,
    });
    return Response.json(
      { error: "Webhook processing is still in progress" },
      { status: 500 },
    );
  }
  if (existing.data) {
    const retryReservation = await admin
      .from("stripe_webhook_events")
      .update({ result: "processing", error_message: null })
      .eq("id", event.id);
    if (retryReservation.error) {
      console.error("Stripe webhook retry reservation failed", {
        eventId: event.id,
        error: retryReservation.error.message,
      });
      return Response.json(
        { error: "Unable to reserve webhook retry" },
        { status: 500 },
      );
    }
  } else {
    const reservation = await admin.from("stripe_webhook_events").insert({
      id: event.id,
      event_type: event.type,
      payment_intent_id: paymentIntent.id,
      result: "processing",
    });
    if (reservation.error?.code === "23505") {
      const concurrent = await admin
        .from("stripe_webhook_events")
        .select("result")
        .eq("id", event.id)
        .maybeSingle();
      if (concurrent.data?.result === "processed") {
        console.info("Stripe webhook already processed", {
          eventId: event.id,
          eventType: event.type,
        });
        return Response.json({ received: true, duplicate: true });
      }
      return Response.json(
        { error: "Webhook processing is still in progress" },
        { status: 500 },
      );
    }
    if (reservation.error) {
      return Response.json({ error: "Unable to reserve webhook event" }, { status: 500 });
    }
  }

  let invoiceId: string | null = null;
  try {
    if (
      ![
        "payment_intent.succeeded",
        "payment_intent.payment_failed",
        "payment_intent.processing",
        "payment_intent.canceled",
      ].includes(event.type)
    ) {
      const ignored = await admin
        .from("stripe_webhook_events")
        .update({ result: "processed", processed_at: new Date().toISOString() })
        .eq("id", event.id);
      if (ignored.error) {
        throw new Error(
          `Unable to record ignored webhook: ${ignored.error.message}`,
        );
      }
      return Response.json({ received: true, ignored: true });
    }

    const invoice = await invoiceForIntent(paymentIntent, admin);
    invoiceId = invoice.id;
    if (event.type === "payment_intent.succeeded") {
      await reconcileStripePaymentIntent({
        admin,
        invoice,
        paymentIntent,
        origin: "webhook",
      });
      const customerId = stripeId(paymentIntent.customer);
      const paymentMethodId = stripeId(paymentIntent.payment_method);

      if (
        paymentIntent.metadata.autopay_consent === "true" &&
        invoice.recurringActive &&
        customerId &&
        paymentMethodId
      ) {
        const stripe = getStripe();
        await stripe.paymentMethods
          .attach(paymentMethodId, { customer: customerId })
          .catch(() => undefined);
        await stripe.customers.update(customerId, {
          invoice_settings: { default_payment_method: paymentMethodId },
        });
        const clientUpdate = await admin
          .from("clients")
          .update({
            autopay_enabled: true,
            stripe_customer_id: customerId,
            stripe_default_payment_method_id: paymentMethodId,
            autopay_consent_at: new Date().toISOString(),
            autopay_consent_email:
              paymentIntent.metadata.autopay_consent_email || null,
          })
          .eq("id", invoice.client_id);
        if (clientUpdate.error) throw new Error(clientUpdate.error.message);
        if (invoice.recurring_schedule_id) {
          const scheduleUpdate = await admin
            .from("recurring_invoice_schedules")
            .update({
              autopay_enabled: true,
              autopay_provider: "stripe",
              autopay_customer_reference: customerId,
            })
            .eq("id", invoice.recurring_schedule_id);
          if (scheduleUpdate.error) {
            throw new Error(scheduleUpdate.error.message);
          }
        }
        await recordActivity(
          admin,
          invoice.id,
          "autopay_enabled",
          "Autopay enabled with client consent",
        );
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const failure =
        paymentIntent.last_payment_error?.message || "Stripe payment failed";
      const failureUpdate = await admin
        .from("invoices")
        .update({
          stripe_checkout_status: "failed",
          payment_failed_at: new Date().toISOString(),
          payment_failure_message: failure,
        })
        .eq("id", invoice.id);
      if (failureUpdate.error) throw new Error(failureUpdate.error.message);
      await recordActivity(
        admin,
        invoice.id,
        "stripe_payment_failed",
        `Stripe payment failed: ${failure}`,
      );
    } else {
      const checkoutStatus =
        event.type === "payment_intent.processing" ? "processing" : "canceled";
      const statusUpdate = await admin
        .from("invoices")
        .update({ stripe_checkout_status: checkoutStatus })
        .eq("id", invoice.id);
      if (statusUpdate.error) throw new Error(statusUpdate.error.message);
      await recordActivity(
        admin,
        invoice.id,
        `stripe_payment_${checkoutStatus}`,
        `Stripe payment ${checkoutStatus}`,
      );
    }

    const processed = await admin
      .from("stripe_webhook_events")
      .update({
        result: "processed",
        processed_at: new Date().toISOString(),
        invoice_id: invoiceId,
      })
      .eq("id", event.id);
    if (processed.error) {
      throw new Error(
        `Unable to record webhook completion: ${processed.error.message}`,
      );
    }
    return Response.json({ received: true });
  } catch (error) {
    const message = safeStripeError(error);
    console.error("Stripe payment finalisation failure", {
      eventId: event.id,
      eventType: event.type,
      invoiceId,
      paymentIntentId: paymentIntent.id,
      error: message,
    });
    const failedEvent = await admin
      .from("stripe_webhook_events")
      .update({
        result: "failed",
        processed_at: new Date().toISOString(),
        invoice_id: invoiceId,
        error_message: message,
      })
      .eq("id", event.id);
    if (failedEvent.error) {
      console.error("Stripe webhook error persistence failed", {
        eventId: event.id,
        error: failedEvent.error.message,
        finalisationError: message,
      });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
