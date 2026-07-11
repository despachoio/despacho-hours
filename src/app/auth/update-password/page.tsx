"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function UpdatePasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function updatePassword() {
    if (!password) return;

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Password updated successfully");

    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc]">

      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm">

        <h1 className="text-2xl font-bold">
          Create Password
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Enter your new Kairo password.
        </p>


        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
          className="mt-6 w-full rounded-2xl border px-5 py-3"
        />


        <button
          onClick={updatePassword}
          disabled={loading}
          className="mt-5 w-full rounded-2xl bg-slate-950 py-3 font-semibold text-white"
        >

          {loading ? "Saving..." : "Set Password"}

        </button>

      </div>

    </main>
  );
}