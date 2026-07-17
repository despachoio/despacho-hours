import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const rememberMeStorage = {
  getItem(key: string) {
    if (typeof window === "undefined") return null;

    return (
      window.localStorage.getItem(key) ??
      window.sessionStorage.getItem(key)
    );
  },

  setItem(key: string, value: string) {
    if (typeof window === "undefined") return;

    const rememberMe =
      window.localStorage.getItem("kairo-remember-me") === "true";

    if (rememberMe) {
      window.localStorage.setItem(key, value);
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, value);
      window.localStorage.removeItem(key);
    }
  },

  removeItem(key: string) {
    if (typeof window === "undefined") return;

    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: rememberMeStorage,
    },
  },
);