"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState(false);

  async function updatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (updating) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setUpdating(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setUpdating(false);
    if (updateError) {
      setError(
        "Unable to update your password. The reset link may have expired.",
      );
      return;
    }

    setUpdated(true);
    window.setTimeout(() => router.replace("/login"), 1500);
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
          Reset your password
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          Choose a new password for your Kairo account.
        </p>

        {updated ? (
          <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
            <p className="font-bold text-emerald-800">
              Password updated successfully.
            </p>
            <p className="mt-1 text-sm text-emerald-700">
              Redirecting to login...
            </p>
          </div>
        ) : (
          <form onSubmit={updatePassword} className="mt-7 space-y-4">
            <div>
              <label
                htmlFor="new-password"
                className="text-sm font-semibold text-slate-700"
              >
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 shadow-sm outline-none transition-colors duration-200 focus:border-[#153E90] focus:ring-2 focus:ring-[#153E90]/15"
              />
            </div>
            <div>
              <label
                htmlFor="confirm-password"
                className="text-sm font-semibold text-slate-700"
              >
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 shadow-sm outline-none transition-colors duration-200 focus:border-[#153E90] focus:ring-2 focus:ring-[#153E90]/15"
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm font-semibold text-red-600">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={updating}
              className="h-12 w-full rounded-xl bg-[#0F172A] px-5 font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#153E90] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#153E90]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {updating ? "Updating..." : "Update Password"}
            </button>
          </form>
        )}

        <Link
          href="/login"
          className="mt-5 block rounded text-center text-sm font-semibold text-[#153E90] transition-colors duration-200 hover:text-[#123474] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#153E90]/30"
        >
          Back to Login
        </Link>
      </section>
    </main>
  );
}
