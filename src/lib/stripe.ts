import "server-only";

import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

let stripeClient: Stripe | null = null;

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe configuration is missing");
  stripeClient ||= new Stripe(key);
  return stripeClient;
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("Stripe webhook configuration is missing");
  return secret;
}

export function getServerAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Payment service is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getAppUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL is not configured");
  return url;
}

const CURRENCY_EXPONENTS = { USD: 2, CAD: 2, INR: 2 } as const;

export type SupportedCurrency = keyof typeof CURRENCY_EXPONENTS;

export function supportedCurrency(value: string): SupportedCurrency {
  const currency = value.trim().toUpperCase();
  if (!(currency in CURRENCY_EXPONENTS)) {
    throw new Error(`Unsupported currency: ${currency || "unknown"}`);
  }
  return currency as SupportedCurrency;
}

export function toMinorUnits(value: number | string, currencyValue: string) {
  const currency = supportedCurrency(currencyValue);
  const exponent = CURRENCY_EXPONENTS[currency];
  const normalized = Number(value).toFixed(exponent);
  const result = Math.round(Number(normalized) * 10 ** exponent);
  if (!Number.isSafeInteger(result) || result <= 0) {
    throw new Error("Invoice amount must be a positive supported value");
  }
  return result;
}

export function fromMinorUnits(value: number, currencyValue: string) {
  const currency = supportedCurrency(currencyValue);
  return value / 10 ** CURRENCY_EXPONENTS[currency];
}

export function paymentUrl(token: string) {
  return `${getAppUrl()}/pay/invoice/${token}`;
}

export function stripePaymentMethodTypes() {
  const configured =
    process.env.STRIPE_DEFAULT_PAYMENT_METHOD_TYPES || "card";
  return configured
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean) as NonNullable<
    Stripe.PaymentIntentCreateParams["payment_method_types"]
  >;
}

export function safeStripeError(error: unknown) {
  if (error instanceof Stripe.errors.StripeError) {
    return error.message || "Stripe payment failed";
  }
  return error instanceof Error ? error.message : "Unable to process payment";
}
