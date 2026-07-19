"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { requiresAdminMobileAccess } from "@/lib/client-device";
import { isAdminLevelRole } from "@/lib/roles";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  const loginLockRef = useRef(false);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loginLockRef.current) return;

    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      alert("Please enter your email and password.");
      return;
    }

    loginLockRef.current = true;
    setIsLoggingIn(true);
    setLoginError("");

    try {
      if (rememberMe) {
        window.localStorage.setItem("kairo-remember-me", "true");
      } else {
        window.localStorage.removeItem("kairo-remember-me");
      }

      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        alert(error.message);
        return;
      }

      if (requiresAdminMobileAccess()) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", authData.user.id)
          .single();

        if (profileError || !isAdminLevelRole(profile?.role)) {
          await supabase.auth.signOut();
          setPassword("");
          setLoginError(
            "The Kairo mobile app is available only to Admin and Super Admin accounts.",
          );
          return;
        }
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Login failed:", error);
      alert("Unable to log in. Please try again.");
    } finally {
      loginLockRef.current = false;
      setIsLoggingIn(false);
    }
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
            priority
            className="h-30 w-60 rounded-2xl object-contain"
          />
        </div>

        <p className="mt-2 text-center text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
          The Pulse of Despacho
        </p>

        {loginError ? (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700"
          >
            {loginError}
          </div>
        ) : null}

        <form
          onSubmit={login}
          aria-busy={isLoggingIn}
          className={`${loginError ? "mt-5" : "mt-8"} space-y-4`}
        >
          <input
            type="email"
            placeholder="Email"
            name="email"
            aria-label="Email"
            autoComplete="email"
            required
            disabled={isLoggingIn}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 shadow-sm outline-none transition-colors duration-200 placeholder:text-slate-400 focus:border-[#153E90] focus:ring-2 focus:ring-[#153E90]/15 disabled:cursor-not-allowed disabled:bg-slate-50"
          />

          <input
            type="password"
            placeholder="Password"
            name="password"
            aria-label="Password"
            autoComplete="current-password"
            required
            disabled={isLoggingIn}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 shadow-sm outline-none transition-colors duration-200 placeholder:text-slate-400 focus:border-[#153E90] focus:ring-2 focus:ring-[#153E90]/15 disabled:cursor-not-allowed disabled:bg-slate-50"
          />

          <div className="flex items-center justify-between gap-4">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={rememberMe}
                disabled={isLoggingIn}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-[#153E90] disabled:cursor-not-allowed"
              />

              <span className="text-sm font-medium text-slate-700">
                Remember me on this device
              </span>
            </label>

            <Link
              href="/forgot-password"
              className="shrink-0 rounded text-sm font-semibold text-[#153E90] transition-colors duration-200 hover:text-[#123474] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#153E90]/30"
            >
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoggingIn}
            className="h-12 w-full rounded-xl bg-[#0F172A] px-5 font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#153E90] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#153E90]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoggingIn ? "Logging in…" : "Login"}
          </button>
        </form>
      </section>
    </main>
  );
}
