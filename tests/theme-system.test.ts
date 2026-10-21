import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_KAIRO_THEME, KAIRO_THEME_MAP, KAIRO_THEMES } from "../src/lib/themes/theme-config";
import { normalizeKairoTheme } from "../src/lib/themes/theme-utils";

const source = (path: string) => readFileSync(path, "utf8");

describe("personalized Kairo themes", () => {
  it("registers the eight approved themes with Despacho Blue as the default", () => {
    expect(DEFAULT_KAIRO_THEME).toBe("despacho-blue");
    expect(KAIRO_THEMES.map((theme) => theme.id)).toEqual([
      "despacho-blue", "emerald", "royal-purple", "ocean-teal",
      "rose-gold", "graphite", "pink-sand", "citrus",
    ]);
    expect(KAIRO_THEME_MAP["despacho-blue"].palette.primary).toBe("#153E90");
    expect(KAIRO_THEME_MAP.emerald.palette.primary).toBe("#087F68");
    expect(KAIRO_THEME_MAP["royal-purple"].palette.primary).toBe("#6941A5");
    expect(KAIRO_THEME_MAP["pink-sand"].palette.heroEnd).toBe("#FFA8B6");
    expect(KAIRO_THEME_MAP.citrus.palette.signatureHighlight).toBe("#F7C331");
  });

  it("falls back safely for missing or invalid stored preferences", () => {
    expect(normalizeKairoTheme(null)).toBe(DEFAULT_KAIRO_THEME);
    expect(normalizeKairoTheme("unknown-theme")).toBe(DEFAULT_KAIRO_THEME);
    expect(normalizeKairoTheme("rose-gold")).toBe("rose-gold");
    expect(normalizeKairoTheme("slate-grey")).toBe("pink-sand");
    expect(normalizeKairoTheme("charcoal-grey")).toBe("citrus");
    expect(normalizeKairoTheme("magic-mint")).toBe("citrus");
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
    const styles = source("src/app/globals.css");
    expect(migration).toContain("when 'slate-grey' then 'pink-sand'");
    expect(migration).toContain("when 'charcoal-grey' then 'magic-mint'");
    expect(migration).toContain("where preferred_theme in ('slate-grey', 'charcoal-grey')");
    expect(migration).toContain("'pink-sand', 'magic-mint'");
    expect(styles).toContain('data-kairo-theme="pink-sand"');
    expect(styles).toContain('data-kairo-theme="citrus"');
    expect(styles).not.toContain('data-kairo-theme="slate-grey"');
    expect(styles).not.toContain('data-kairo-theme="charcoal-grey"');
    expect(styles).not.toContain('data-kairo-theme="magic-mint"');
  });

  it("migrates Magic Mint preferences to Citrus and updates the database whitelist", () => {
    const migration = source("supabase/migrations/202610210003_replace_magic_mint_with_citrus.sql");
    expect(migration).toContain("set preferred_theme = 'citrus'");
    expect(migration).toContain("where preferred_theme = 'magic-mint'");
    expect(migration).toContain("'pink-sand', 'citrus'");
    expect(migration).toContain("where user_id = auth.uid()");
  });

  it("keeps official payroll PDFs on fixed Despacho branding", () => {
    for (const path of [
      "src/components/payroll/PayslipPdfDocument.tsx",
      "src/components/payroll/YtdPayrollPdfDocument.tsx",
      "src/components/payroll/PayrollSummaryPdfDocument.tsx",
    ]) expect(source(path)).not.toContain("--kairo-primary");
  });
});
