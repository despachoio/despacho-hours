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
      setError("Unable to send the reset link. Please try again.");
      return;
    }
    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-5 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
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
              className="mt-2 w-full rounded-2xl border border-slate-200 px-5 py-3 outline-none transition focus:border-[#153E90] focus:ring-4 focus:ring-blue-100"
            />
            {error ? (
              <p role="alert" className="mt-3 text-sm font-semibold text-red-600">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={sending}
              className="mt-5 w-full rounded-2xl bg-slate-950 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        <Link
          href="/login"
          className="mt-5 block w-full rounded-2xl border border-slate-200 py-3 text-center font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Back to Login
        </Link>
      </section>
    </main>
  );
}
