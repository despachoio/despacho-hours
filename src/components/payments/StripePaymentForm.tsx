"use client";

import { useRef, useState } from "react";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

export default function StripePaymentForm({
  token,
  autopayEligible,
}: {
  token: string;
  autopayEligible: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [autopayConsent, setAutopayConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submitLockRef = useRef(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements || submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    setError("");
    if (autopayConsent) {
      const consentResponse = await fetch(
        `/api/public/invoices/${token}/payment-intent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ autopayConsent: true }),
        },
      );
      const consentResult = (await consentResponse.json()) as {
        error?: string;
        status?: string;
      };
      if (
        consentResult.status === "paid" ||
        consentResult.status === "succeeded" ||
        consentResult.status === "processing"
      ) {
        window.location.assign(`/pay/invoice/${token}/result`);
        return;
      }
      if (!consentResponse.ok) {
        setError(consentResult.error || "Unable to enable Autopay consent");
        submitLockRef.current = false;
        setSubmitting(false);
        return;
      }
    }
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/pay/invoice/${token}/result`,
      },
      redirect: "if_required",
    });
    if (result.error) {
      setError(result.error.message || "Stripe payment failed");
      submitLockRef.current = false;
      setSubmitting(false);
      return;
    }
    if (
      result.paymentIntent?.status === "succeeded" ||
      result.paymentIntent?.status === "processing"
    ) {
      window.location.assign(`/pay/invoice/${token}/result`);
      return;
    }

    setError("Payment requires another action. Please review your details.");
    submitLockRef.current = false;
    setSubmitting(false);
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
      <h2 className="text-xl font-bold text-slate-950">Secure card payment</h2>
      <p className="mt-1 text-sm text-slate-500">Payment details are securely processed by Stripe.</p>
      <fieldset disabled={submitting} aria-busy={submitting}>
        <div className={submitting ? "pointer-events-none mt-6 opacity-70" : "mt-6"}>
          <PaymentElement />
        </div>
      {autopayEligible ? (
        <label className="mt-6 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
          <input
            type="checkbox"
            checked={autopayConsent}
            onChange={(event) => setAutopayConsent(event.target.checked)}
            className="mt-1"
          />
          <span>
            <strong className="block text-sm text-slate-900">Enable Autopay for future recurring invoices</strong>
            <span className="mt-1 block text-xs leading-5 text-slate-500">
              By enabling Autopay, you authorize Despacho Inc. to charge this saved payment method for future invoices generated under this recurring billing arrangement. You will receive an invoice email for each charge.
            </span>
          </span>
        </label>
      ) : null}
      </fieldset>
      {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="mt-6 w-full rounded-2xl bg-[#153E90] px-5 py-3.5 font-bold text-white shadow-lg shadow-blue-900/15 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Processing payment…" : "Make Payment"}
      </button>
    </form>
  );
}
