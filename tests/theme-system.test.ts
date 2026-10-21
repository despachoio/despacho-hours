import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_KAIRO_THEME, KAIRO_THEME_MAP, KAIRO_THEMES } from "../src/lib/themes/theme-config";
import { normalizeKairoTheme } from "../src/lib/themes/theme-utils";

const source = (path: string) => readFileSync(path, "utf8");

describe("personalized Kairo themes", () => {
  it("registers the eight approved themes with Despacho Blue as the default", () => {
    expect(DEFAULT_KAIRO_THEME).toBe("despacho-blue");
    expect(KAIRO_THEMES.map((theme) => theme.id)).toEqual([
      "despacho-blue", "royal-purple", "ocean-teal", "graphite",
      "powder-blue", "peach-whisper", "cashmere-beige", "soft-pistachio",
    ]);
    expect(KAIRO_THEME_MAP["despacho-blue"].palette.primary).toBe("#153E90");
    expect(KAIRO_THEME_MAP["royal-purple"].palette.primary).toBe("#6941A5");
    expect(KAIRO_THEME_MAP["powder-blue"].palette.signatureHighlight).toBe("#B8D8E8");
    expect(KAIRO_THEME_MAP["peach-whisper"].palette.heroText).toBe("#77513E");
    expect(KAIRO_THEME_MAP["cashmere-beige"].palette.heroStart).toBe("#E8DCC8");
    expect(KAIRO_THEME_MAP["soft-pistachio"].palette.heroEnd).toBe("#F2F6E9");
    expect(KAIRO_THEMES.slice(0, 4).every((theme) => theme.heroAppearance === "dark")).toBe(true);
    expect(KAIRO_THEMES.slice(4).every((theme) => theme.heroAppearance === "light")).toBe(true);
  });

  it("falls back safely for missing or invalid stored preferences", () => {
    expect(normalizeKairoTheme(null)).toBe(DEFAULT_KAIRO_THEME);
    expect(normalizeKairoTheme("unknown-theme")).toBe(DEFAULT_KAIRO_THEME);
    expect(normalizeKairoTheme("columbia-blue")).toBe("powder-blue");
    expect(normalizeKairoTheme("emerald")).toBe("powder-blue");
    expect(normalizeKairoTheme("pink-sand")).toBe("peach-whisper");
    expect(normalizeKairoTheme("slate-grey")).toBe("peach-whisper");
    expect(normalizeKairoTheme("jet-black")).toBe("cashmere-beige");
    expect(normalizeKairoTheme("rose-gold")).toBe("cashmere-beige");
    expect(normalizeKairoTheme("citrus")).toBe("soft-pistachio");
    expect(normalizeKairoTheme("charcoal-grey")).toBe("soft-pistachio");
    expect(normalizeKairoTheme("magic-mint")).toBe("soft-pistachio");
  });

  it("offers Change Theme from the profile menu and mounts the provider", () => {
    const layout = source("src/app/(app)/layout.tsx");
    expect(layout).toContain("Change Theme");
    expect(layout).toContain('<NavigationIcon name="palette" />');
    expect(layout).toContain("<KairoThemeProvider>");
    expect(layout).toContain("<ThemeSelectionDialog");
  });

  it("supports live preview, cancel restoration and persisted apply", () => {
    const dialog = source("src/components/theme/ThemeSelectionDialog.tsx");
    const provider = source("src/components/theme/KairoThemeProvider.tsx");
    expect(dialog).toContain("Personalize Your Kairo");
    expect(dialog).toContain("previewTheme(theme)");
    expect(dialog).toContain("restoreSavedTheme()");
    expect(dialog).toContain("Reset to Default");
    expect(dialog).toContain("Apply Theme");
    expect(provider).toContain('supabase.rpc("set_my_preferred_theme"');
    expect(provider).toContain("kairoThemeCacheKey(userId)");
    expect(provider).toContain("data-kairo-theme={theme}");
    expect(provider).toContain("data-kairo-hero-appearance");
    expect(dialog).toContain('appearance === "dark" ? "Dark Heroes" : "Light Heroes"');
    expect(dialog).toContain("definition.heroAppearance === appearance");
  });

  it("persists only whitelisted values for the authenticated profile", () => {
    const migration = source("supabase/migrations/202610210001_user_theme_preferences.sql");
    expect(migration).toContain("preferred_theme text not null default 'despacho-blue'");
    expect(migration).toContain("where user_id = auth.uid()");
    expect(migration).toContain("grant execute on function public.set_my_preferred_theme(text) to authenticated");
    expect(migration).toContain("profiles_preferred_theme_check");
  });

  it("replaces obsolete grey preferences without changing unrelated profile data", () => {
    const migration = source("supabase/migrations/202610210002_replace_grey_themes.sql");
    expect(migration).toContain("when 'slate-grey' then 'pink-sand'");
    expect(migration).toContain("when 'charcoal-grey' then 'magic-mint'");
    expect(migration).toContain("where preferred_theme in ('slate-grey', 'charcoal-grey')");
    expect(migration).toContain("'pink-sand', 'magic-mint'");
  });

  it("migrates Magic Mint preferences to Citrus and updates the database whitelist", () => {
    const migration = source("supabase/migrations/202610210003_replace_magic_mint_with_citrus.sql");
    expect(migration).toContain("set preferred_theme = 'citrus'");
    expect(migration).toContain("where preferred_theme = 'magic-mint'");
    expect(migration).toContain("'pink-sand', 'citrus'");
    expect(migration).toContain("where user_id = auth.uid()");
  });

  it("migrates Emerald and Rose Gold preferences to their replacements", () => {
    const migration = source("supabase/migrations/202610210004_replace_emerald_rose_gold_themes.sql");
    expect(migration).toContain("when 'emerald' then 'columbia-blue'");
    expect(migration).toContain("when 'rose-gold' then 'jet-black'");
    expect(migration).toContain("where preferred_theme in ('emerald', 'rose-gold')");
    expect(migration).toContain("'jet-black', 'graphite', 'pink-sand', 'citrus'");
  });

  it("refreshes legacy preferences to the four light hero themes", () => {
    const migration = source("supabase/migrations/202610210005_refresh_premium_theme_collection.sql");
    const styles = source("src/app/globals.css");
    expect(migration).toContain("when 'columbia-blue' then 'powder-blue'");
    expect(migration).toContain("when 'pink-sand' then 'peach-whisper'");
    expect(migration).toContain("when 'jet-black' then 'cashmere-beige'");
    expect(migration).toContain("when 'citrus' then 'soft-pistachio'");
    expect(migration).toContain("'powder-blue', 'peach-whisper', 'cashmere-beige', 'soft-pistachio'");
    for (const id of ["powder-blue", "peach-whisper", "cashmere-beige", "soft-pistachio"]) {
      expect(styles).toContain(`data-kairo-theme="${id}"`);
    }
    for (const id of ["columbia-blue", "pink-sand", "jet-black", "citrus"]) {
      expect(styles).not.toContain(`data-kairo-theme="${id}"`);
    }
  });

  it("keeps official payroll PDFs on fixed Despacho branding", () => {
    for (const path of [
      "src/components/payroll/PayslipPdfDocument.tsx",
      "src/components/payroll/YtdPayrollPdfDocument.tsx",
      "src/components/payroll/PayrollSummaryPdfDocument.tsx",
    ]) expect(source(path)).not.toContain("--kairo-primary");
  });
});
