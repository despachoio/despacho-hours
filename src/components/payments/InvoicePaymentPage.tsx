"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import InvoicePaymentSummary from "./InvoicePaymentSummary";
import StripePaymentForm from "./StripePaymentForm";
import type { PublicInvoice, PublicPaymentStatus } from "./types";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

type StatusResponse = {
  status?: PublicPaymentStatus;
  invoice?: PublicInvoice;
  failureMessage?: string | null;
  error?: string;
};

export default function InvoicePaymentPage({ token }: { token: string }) {
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [paymentStatus, setPaymentStatus] =
    useState<PublicPaymentStatus>("unavailable");
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(false);
  const viewRecordedRef = useRef(false);

  const preparePayment = useCallback(
    async (replaceCanceledIntent = false) => {
      setPreparing(true);
      setError("");
      const response = await fetch(
        `/api/public/invoices/${token}/payment-intent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            autopayConsent: false,
            replaceCanceledIntent,
          }),
        },
      );
      const result = (await response.json()) as StatusResponse & {
        clientSecret?: string;
      };
      if (result.invoice) setInvoice(result.invoice);
      if (result.status) setPaymentStatus(result.status);
      if (result.clientSecret) {
        setClientSecret(result.clientSecret);
      } else {
        setClientSecret("");
      }
      if (!response.ok) {
        setError(result.error || "Unable to prepare payment");
      }
      setPreparing(false);
    },
    [token],
  );

  useEffect(() => {
    let active = true;
    if (!viewRecordedRef.current) {
      viewRecordedRef.current = true;
      void fetch(`/api/public/invoices/${token}/payment-view`, {
        method: "POST",
      });
    }
    async function load() {
      const response = await fetch(
        `/api/public/invoices/${token}/payment-status`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as StatusResponse;
      if (!active) return;
      if (result.invoice) setInvoice(result.invoice);
      const status = result.status || "unavailable";
      setPaymentStatus(status);
      if (!response.ok && !result.invoice) {
        setError(result.error || "Invoice not found");
        setLoading(false);
        return;
      }
      if (
        status === "unpaid" ||
        status === "requires_payment_method" ||
        status === "requires_action"
      ) {
        await preparePayment(false);
      }
      if (active) setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [preparePayment, token]);

  let stateTitle = "";
  let stateDescription = "";
  if (paymentStatus === "paid") {
    stateTitle = "Invoice already paid";
    stateDescription = "This invoice has been paid. No further payment is required.";
  } else if (paymentStatus === "succeeded") {
    stateTitle = "Payment received";
    stateDescription =
      "Your card was charged successfully. Kairo is finalizing the invoice. Please do not submit another payment.";
  } else if (paymentStatus === "processing") {
    stateTitle = "Payment processing";
    stateDescription =
      "Your payment was submitted. Please do not make another payment.";
  } else if (paymentStatus === "void") {
    stateTitle = "Invoice voided";
    stateDescription = "This invoice has been voided and cannot be paid.";
  } else if (paymentStatus === "unavailable") {
    stateTitle = "Payment unavailable";
    stateDescription = "This invoice is not available for online payment.";
  } else if (paymentStatus === "failed") {
    stateTitle = "Payment unsuccessful";
    stateDescription = "Your card was not charged. You can safely start a new attempt.";
  }

  const showPaymentForm =
    Boolean(clientSecret && stripePromise) &&
    (paymentStatus === "unpaid" ||
      paymentStatus === "requires_payment_method" ||
      paymentStatus === "requires_action");

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-5 py-8 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <Image src="/despacho-logo-full.png" alt="Despacho" width={190} height={60} className="h-auto w-40 sm:w-48" priority />
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">Secure payment</span>
        </header>
        {loading ? <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">Checking payment status…</div> : null}
        {!loading && error && !invoice ? <div role="alert" className="rounded-3xl border border-red-200 bg-white p-8 text-center font-semibold text-red-700 shadow-sm">{error}</div> : null}
        {!loading && invoice ? (
          <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
            <InvoicePaymentSummary invoice={invoice} />
            {showPaymentForm ? (
              <Elements
                stripe={stripePromise}
                options={{ clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#153E90", borderRadius: "12px" } } }}
              >
                <StripePaymentForm token={token} autopayEligible={invoice.autopayEligible} />
              </Elements>
            ) : stateTitle ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-950">{stateTitle}</h2>
                <p className="mt-3 leading-7 text-slate-500">{stateDescription}</p>
                {error ? <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
                {paymentStatus === "failed" ? (
                  <button
                    type="button"
                    disabled={preparing}
                    onClick={() => void preparePayment(true)}
                    className="mt-6 rounded-xl bg-[#153E90] px-5 py-3 font-bold text-white shadow-sm transition-colors hover:bg-[#0F172A] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#153E90]/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {preparing ? "Preparing…" : "Try payment again"}
                  </button>
                ) : null}
                {paymentStatus === "processing" || paymentStatus === "succeeded" ? (
                  <a href={`/pay/invoice/${token}/result`} className="mt-6 inline-flex rounded-xl bg-[#153E90] px-5 py-3 font-bold text-white shadow-sm transition-colors hover:bg-[#0F172A] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#153E90]/20">
                    Check payment status
                  </a>
                ) : null}
              </section>
            ) : !error ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
                {preparing ? "Preparing secure payment…" : "Stripe configuration is missing."}
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
