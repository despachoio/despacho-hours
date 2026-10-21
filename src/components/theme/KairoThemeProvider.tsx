"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { DEFAULT_KAIRO_THEME, KAIRO_THEME_MAP } from "@/lib/themes/theme-config";
import type { KairoThemeId } from "@/lib/themes/theme-types";
import { kairoThemeCacheKey, normalizeKairoTheme } from "@/lib/themes/theme-utils";

type KairoThemeContextValue = {
  theme: KairoThemeId;
  savedTheme: KairoThemeId;
  loading: boolean;
  previewTheme: (theme: KairoThemeId) => void;
  restoreSavedTheme: () => void;
  saveTheme: (theme: KairoThemeId) => Promise<void>;
};

const KairoThemeContext = createContext<KairoThemeContextValue | null>(null);

export function KairoThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<KairoThemeId>(DEFAULT_KAIRO_THEME);
  const [savedTheme, setSavedTheme] = useState<KairoThemeId>(DEFAULT_KAIRO_THEME);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadTheme() {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      const id = data.user?.id || "";
      setUserId(id);
      if (!id) {
        setTheme(DEFAULT_KAIRO_THEME);
        setSavedTheme(DEFAULT_KAIRO_THEME);
        setLoading(false);
        return;
      }

      const cached = normalizeKairoTheme(window.localStorage.getItem(kairoThemeCacheKey(id)));
      setTheme(cached);
      setSavedTheme(cached);
      const result = await supabase.from("profiles").select("preferred_theme").eq("user_id", id).maybeSingle();
      if (!active) return;
      const persisted = result.error ? cached : normalizeKairoTheme(result.data?.preferred_theme);
      setTheme(persisted);
      setSavedTheme(persisted);
      window.localStorage.setItem(kairoThemeCacheKey(id), persisted);
      setLoading(false);
    }
    void loadTheme();
    return () => { active = false; };
  }, []);

  const previewTheme = useCallback((nextTheme: KairoThemeId) => setTheme(nextTheme), []);
  const restoreSavedTheme = useCallback(() => setTheme(savedTheme), [savedTheme]);
  const saveTheme = useCallback(async (nextTheme: KairoThemeId) => {
    if (!userId) throw new Error("Your authenticated profile is not available.");
    setTheme(nextTheme);
    const result = await supabase.rpc("set_my_preferred_theme", { p_theme: nextTheme });
    if (result.error) {
      setTheme(savedTheme);
      throw new Error(result.error.message || "Unable to save your theme preference.");
    }
    setSavedTheme(nextTheme);
    window.localStorage.setItem(kairoThemeCacheKey(userId), nextTheme);
  }, [savedTheme, userId]);

  const value = useMemo(() => ({ theme, savedTheme, loading, previewTheme, restoreSavedTheme, saveTheme }), [loading, previewTheme, restoreSavedTheme, saveTheme, savedTheme, theme]);

  return <KairoThemeContext.Provider value={value}><div data-kairo-theme={theme} data-kairo-hero-appearance={KAIRO_THEME_MAP[theme].heroAppearance} className="kairo-theme-root min-h-screen">{children}</div></KairoThemeContext.Provider>;
}

export function useKairoTheme() {
  const context = useContext(KairoThemeContext);
  if (!context) throw new Error("useKairoTheme must be used inside KairoThemeProvider");
  return context;
}
