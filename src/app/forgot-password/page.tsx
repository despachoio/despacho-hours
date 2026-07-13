"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function sendResetLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("Email is required.");
      return;
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    if (!appUrl) {
      setError("Password reset is not configured.");
      return;
    }

    setSending(true);
    setError("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      { redirectTo: `${appUrl}/reset-password` },
    );
    setSending(false);

    if (resetError) {
  console.error(resetError);

  setError(
    `${resetError.message} (${resetError.status ?? "no-status"})`
  );

  return;
}
    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-5 py-10">
      <section className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 sm:p-10">
        <div className="flex justify-center">
          <Image
            src="/kairo-logo-full.png"
            alt="Kairo"
            width={240}
            height={120}
            className="h-30 w-60 rounded-2xl object-contain"
            priority
          />
        </div>

        <h1 className="mt-6 text-center text-2xl font-bold text-slate-950">
          Forgot your password?
        </h1>
        <p className="mt-2 text-center text-sm leading-6 text-slate-500">
          Enter your email address and we&apos;ll send you a password reset link.
        </p>

        {sent ? (
          <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
            <p className="font-bold text-emerald-800">
              Password reset link sent.
            </p>
            <p className="mt-1 text-sm text-emerald-700">
              Please check your email.
            </p>
          </div>
        ) : (
          <form onSubmit={sendResetLink} className="mt-7">
            <label
              htmlFor="reset-email"
              className="text-sm font-semibold text-slate-700"
            >
              Email
            </label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(error)}
              className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 shadow-sm outline-none transition-colors duration-200 focus:border-[#153E90] focus:ring-2 focus:ring-[#153E90]/15"
            />
            {error ? (
              <p role="alert" className="mt-3 text-sm font-semibold text-red-600">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={sending}
              className="mt-5 h-12 w-full rounded-xl bg-[#0F172A] px-5 font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#153E90] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#153E90]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        <Link
          href="/login"
          className="mt-5 block w-full rounded-xl border border-slate-300 bg-white py-3 text-center font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#153E90]/30"
        >
          Back to Login
        </Link>
      </section>
    </main>
  );
}