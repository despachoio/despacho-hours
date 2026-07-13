"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicInvoice, PublicPaymentStatus } from "./types";

const TERMINAL_STATUSES: PublicPaymentStatus[] = [
  "paid",
  "succeeded",
  "failed",
  "void",
  "unavailable",
];

export default function PaymentResultPage({ token }: { token: string }) {
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [paymentStatus, setPaymentStatus] =
    useState<PublicPaymentStatus>("processing");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const checkStatus = useCallback(
    async (poll = false) => {
      if (!poll) {
        setChecking(true);
        setTimedOut(false);
      }
      let attempts = 0;
      async function requestStatus() {
        const response = await fetch(
          `/api/public/invoices/${token}/payment-status`,
          { cache: "no-store" },
        );
        const result = (await response.json()) as {
          status?: PublicPaymentStatus;
          invoice?: PublicInvoice;
        };
        if (!mountedRef.current) return;
        const status = result.status || "unavailable";
        if (result.invoice) setInvoice(result.invoice);
        setPaymentStatus(status);
        setChecking(false);
        attempts += 1;

        if (!TERMINAL_STATUSES.includes(status) && attempts < 15) {
          timeoutRef.current = setTimeout(() => void requestStatus(), 2000);
          return;
        }
        if (!TERMINAL_STATUSES.includes(status) && attempts >= 15) {
          setTimedOut(true);
        }
      }
      await requestStatus();
    },
    [token],
  );

  useEffect(() => {
    mountedRef.current = true;
    timeoutRef.current = setTimeout(() => void checkStatus(true), 0);
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [checkStatus]);

  async function disableAutopay() {
    if (disabling) return;
    setDisabling(true);
    const response = await fetch(`/api/public/invoices/${token}/autopay`, {
      method: "DELETE",
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error || "Unable to disable Autopay");
    } else {
      setInvoice((current) =>
        current ? { ...current, autopayEnabled: false } : current,
      );
    }
    setDisabling(false);
  }

  let title = "Payment processing";
  let description =
    "Your payment was submitted. Please do not make another payment.";
  if (paymentStatus === "paid") {
    title = "Payment successful";
    description = invoice
      ? `Your payment for Invoice #${invoice.invoiceNumber} was received successfully.`
      : "Your payment was received successfully.";
  } else if (paymentStatus === "succeeded") {
    title = "Payment received";
    description =
      "Your card was charged successfully. Kairo is finalizing the invoice.";
  } else if (paymentStatus === "failed") {
    title = "Payment unsuccessful";
    description = "Your card was not charged. You can safely try again.";
  } else if (paymentStatus === "void") {
    title = "Invoice voided";
    description = "This invoice has been voided and cannot be paid.";
  } else if (paymentStatus === "unavailable") {
    title = "Payment status unavailable";
    description =
      "We could not confirm the payment status. Please contact sales@despacho.io before trying again.";
  }
  if (timedOut) {
    title = "Still confirming payment";
    description =
      "We received your payment submission and are still confirming its status. Please do not submit another payment. Refresh this page shortly or contact sales@despacho.io.";
  }

  const successful = paymentStatus === "paid";
  const unsuccessful =
    paymentStatus === "failed" ||
    paymentStatus === "void" ||
    paymentStatus === "unavailable";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-5 py-10">
      <section className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/50 sm:p-10">
        <Image src="/despacho-logo-full.png" alt="Despacho" width={180} height={58} className="mx-auto h-auto w-44" priority />
        {error ? <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
        {checking && !invoice ? <p className="mt-8 text-slate-500">Checking payment status…</p> : null}
        {!checking || invoice ? (
          <>
            <div className={`mx-auto mt-8 flex h-14 w-14 items-center justify-center rounded-full text-2xl ${successful ? "bg-emerald-100 text-emerald-700" : unsuccessful ? "bg-red-100 text-red-700" : "bg-blue-100 text-[#153E90]"}`}>
              {successful ? "✓" : unsuccessful ? "!" : "…"}
            </div>
            <h1 className="mt-5 text-3xl font-bold text-slate-950">{title}</h1>
            <p className="mt-3 leading-7 text-slate-500">{description}</p>
            {invoice?.autopayEnabled && successful ? (
              <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-bold text-emerald-800">Autopay enabled.</p>
                <button
                  type="button"
                  disabled={disabling}
                  onClick={() => void disableAutopay()}
                  className="mt-3 text-sm font-bold text-red-600 disabled:opacity-50"
                >
                  {disabling ? "Disabling…" : "Disable Autopay"}
                </button>
              </div>
            ) : null}
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              {timedOut || paymentStatus === "succeeded" || paymentStatus === "processing" ? (
                <button
                  type="button"
                  disabled={checking}
                  onClick={() => void checkStatus(false)}
                  className="rounded-xl bg-[#153E90] px-5 py-3 font-bold text-white disabled:opacity-60"
                >
                  {checking ? "Checking…" : "Refresh Status"}
                </button>
              ) : null}
              <a href={`/pay/invoice/${token}`} className="inline-flex rounded-xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700">
                Return to Invoice
              </a>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
