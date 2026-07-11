"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function handleAuth() {
      await supabase.auth.getSession();
      router.replace("/auth/update-password");
    }

    handleAuth();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc]">
      <p className="text-sm font-semibold text-slate-600">
        Setting up your account...
      </p>
    </main>
  );
}