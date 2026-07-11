"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();

  const [email, setEmail] = useState("admin@despacho.io");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function handleLogin() {
    try {
      setMessage("Signing in...");

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setMessage("Unexpected login error.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
        <div className="text-center mb-8">
          <img
            src="/despacho-logo.png"
            alt="Despacho"
            className="mx-auto mb-4 h-16 w-16 rounded-2xl object-contain"
          />

          <h1 className="text-4xl font-bold tracking-tight text-slate-950">
            KAIRO
          </h1>

          <p className="mt-2 text-slate-500">
            Everything work. One place.
          </p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Email address
            </label>

            <input
              type="email"
              placeholder="you@despacho.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-slate-950"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>

            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-slate-950"
            />
          </div>

          <button
            type="button"
            onClick={handleLogin}
            className="w-full rounded-2xl bg-slate-950 py-3 font-semibold text-white hover:bg-slate-800"
          >
            Sign in
          </button>
        </div>

        {message && (
          <p className="mt-4 text-center text-sm text-slate-600">
            {message}
          </p>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          © 2026 Despacho Inc. Internal use only.
        </p>
      </div>
    </main>
  );
}