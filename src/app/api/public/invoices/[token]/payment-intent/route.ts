import type Stripe from "stripe";
import {
  loadPublicInvoice,
  publicInvoiceState,
  safeInvoicePayload,
} from "@/lib/public-invoice-payment";
import {
  reconcileStripePaymentIntent,
  validatePaymentIntentForInvoice,
} from "@/lib/stripe-reconciliation";
import {
  getServerAdminClient,
  getStripe,
  safeStripeError,
  stripePaymentMethodTypes,
  supportedCurrency,
  toMinorUnits,
} from "@/lib/stripe";

type PaymentIntentBody = {
  autopayConsent?: unknown;
  replaceCanceledIntent?: unknown;
};

function responseForIntent(
  paymentIntent: Stripe.PaymentIntent,
  invoice: NonNullable<Awaited<ReturnType<typeof loadPublicInvoice>>>,
) {
  const status =
    paymentIntent.status === "requires_confirmation"
      ? "requires_action"
      : paymentIntent.status;
  if (status === "processing" || status === "succeeded") {
    return Response.json({
      status,
      message:
        status === "succeeded"
          ? "Payment has already been received."
          : "Payment is processing. Please do not submit another payment.",
      invoice: safeInvoicePayload(invoice),
    });
  }
  if (
    ![
      "requires_payment_method",
      "requires_confirmation",
      "requires_action",
    ].includes(status)
  ) {
    return Response.json(
      { status: "unavailable", error: "Payment is unavailable" },
      { status: 409 },
    );
  }
  if (!paymentIntent.client_secret) {
    throw new Error("Unable to prepare payment");
  }
  return Response.json({
    status,
    clientSecret: paymentIntent.client_secret,
    invoice: safeInvoicePayload(invoice),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const admin = getServerAdminClient();
    let invoice = await loadPublicInvoice(admin, token);
    if (!invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }
    const state = publicInvoiceState(invoice.status);
    if (state === "paid") {
      return Response.json({
        status: "paid",
        message: "Invoice has already been paid.",
        invoice: safeInvoicePayload(invoice),
      });
    }
    if (state === "void") {
      return Response.json(
        { status: "void", error: "Invoice has been voided" },
        { status: 409 },
      );
    }
    if (state !== "payable") {
      return Response.json(
        { status: "unavailable", error: "Invoice is not payable" },
        { status: 409 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as PaymentIntentBody;
    const autopayConsent =
      body.autopayConsent === true && invoice.recurringActive;
    const replaceCanceledIntent = body.replaceCanceledIntent === true;
    const currency = supportedCurrency(invoice.currency);
    const amount = toMinorUnits(invoice.total_amount, currency);
    const receiptEmail = invoice.sent_to?.split(",")[0]?.trim() || undefined;
    const stripe = getStripe();
    let customerId = invoice.clients?.stripe_customer_id || null;
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          name: invoice.clients?.name || undefined,
          metadata: { kairo_client_id: invoice.client_id },
        },
        { idempotencyKey: `kairo-client-${invoice.client_id}` },
      );
      customerId = customer.id;
      const customerUpdate = await admin
        .from("clients")
        .update({ stripe_customer_id: customerId })
        .eq("id", invoice.client_id)
        .is("stripe_customer_id", null);
      if (customerUpdate.error) {
        throw new Error("Unable to save Stripe customer");
      }
    }

    const metadata = {
      kairo_invoice_id: invoice.id,
      kairo_invoice_number: String(invoice.invoice_number),
      kairo_client_id: invoice.client_id,
      public_payment_token: String(invoice.public_payment_token),
      payment_source: "stripe",
      autopay_consent: autopayConsent ? "true" : "false",
      autopay_consent_email: autopayConsent ? receiptEmail || "" : "",
    };
    let paymentIntent: Stripe.PaymentIntent | null = null;
    if (invoice.stripe_payment_intent_id) {
      paymentIntent = await stripe.paymentIntents.retrieve(
        invoice.stripe_payment_intent_id,
      );
      validatePaymentIntentForInvoice(paymentIntent, invoice);
      console.info("Stripe PaymentIntent reused", {
        invoiceId: invoice.id,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
      });

      const priorPayment = await admin
        .from("payments")
        .select("status")
        .eq("stripe_payment_intent_id", paymentIntent.id)
        .maybeSingle();
      if (priorPayment.error) throw new Error(priorPayment.error.message);
      const replacingReversedPayment =
        priorPayment.data?.status === "reversed" && replaceCanceledIntent;
      if (priorPayment.data?.status === "reversed") {
        if (!replaceCanceledIntent) {
          return Response.json(
            {
              status: "failed",
              error:
                "The previous payment was reversed. Start a new payment attempt to repay this invoice.",
            },
            { status: 409 },
          );
        }
      } else if (paymentIntent.status === "succeeded") {
        await reconcileStripePaymentIntent({
          admin,
          invoice,
          paymentIntent,
          origin: "status",
        });
        invoice = (await loadPublicInvoice(admin, token)) || invoice;
        if (publicInvoiceState(invoice.status) === "paid") {
          return Response.json({
            status: "paid",
            message: "Invoice has already been paid.",
            invoice: safeInvoicePayload(invoice),
          });
        }
        return responseForIntent(paymentIntent, invoice);
      }

      if (!replacingReversedPayment && paymentIntent.status === "processing") {
        return responseForIntent(paymentIntent, invoice);
      }
      if (paymentIntent.status === "canceled" && !replaceCanceledIntent) {
        return Response.json(
          {
            status: "failed",
            error: "The previous payment attempt was canceled.",
          },
          { status: 409 },
        );
      }
      if (
        !replacingReversedPayment &&
        paymentIntent.status !== "canceled"
      ) {
        if (autopayConsent) {
          paymentIntent = await stripe.paymentIntents.update(paymentIntent.id, {
            metadata,
            receipt_email: receiptEmail,
            setup_future_usage: "off_session",
          });
        }
        await admin
          .from("invoices")
          .update({
            stripe_checkout_status: paymentIntent.status,
            payment_failure_message:
              paymentIntent.last_payment_error?.message || null,
          })
          .eq("id", invoice.id);
        return responseForIntent(paymentIntent, invoice);
      }
    }

    const attemptNumber = paymentIntent
      ? Number(invoice.stripe_payment_attempt_number || 1) + 1
      : 1;
    const idempotencyKey =
      attemptNumber === 1
        ? `kairo-invoice-payment-intent:${invoice.id}`
        : `kairo-invoice-payment-intent:${invoice.id}:attempt:${attemptNumber}`;
    paymentIntent = await stripe.paymentIntents.create(
      {
        amount,
        currency: currency.toLowerCase(),
        customer: customerId,
        payment_method_types: stripePaymentMethodTypes(),
        metadata,
        receipt_email: receiptEmail,
        setup_future_usage: autopayConsent ? "off_session" : undefined,
        description: `Kairo Invoice #${invoice.invoice_number}`,
      },
      { idempotencyKey },
    );
    console.info("Stripe PaymentIntent created", {
      invoiceId: invoice.id,
      paymentIntentId: paymentIntent.id,
      attemptNumber,
    });

    const now = new Date().toISOString();
    let updateQuery = admin
      .from("invoices")
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        stripe_payment_attempt_number: attemptNumber,
        stripe_checkout_status: paymentIntent.status,
        payment_link_created_at: invoice.payment_link_created_at || now,
        payment_attempted_at: now,
        payment_failure_message: null,
      })
      .eq("id", invoice.id);
    updateQuery = invoice.stripe_payment_intent_id
      ? updateQuery.eq(
          "stripe_payment_intent_id",
          invoice.stripe_payment_intent_id,
        )
      : updateQuery.is("stripe_payment_intent_id", null);
    const update = await updateQuery.select("id").maybeSingle();
    if (update.error || !update.data) {
      invoice = (await loadPublicInvoice(admin, token)) || invoice;
      if (invoice.stripe_payment_intent_id !== paymentIntent.id) {
        throw new Error("Another payment attempt is already active");
      }
    }

    return responseForIntent(paymentIntent, invoice);
  } catch (error) {
    const message = safeStripeError(error);
    const status = /configuration|NEXT_PUBLIC_APP_URL/i.test(message) ? 500 : 400;
    return Response.json({ error: message }, { status });
  }
}
