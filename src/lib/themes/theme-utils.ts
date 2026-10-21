import { DEFAULT_KAIRO_THEME } from "./theme-config";
import { KAIRO_THEME_IDS, type KairoThemeId } from "./theme-types";

export function isKairoThemeId(value: unknown): value is KairoThemeId {
  return typeof value === "string" && (KAIRO_THEME_IDS as readonly string[]).includes(value);
}

export function normalizeKairoTheme(value: unknown): KairoThemeId {
  if (value === "columbia-blue" || value === "emerald") return "powder-blue";
  if (value === "pink-sand" || value === "slate-grey") return "peach-whisper";
  if (value === "jet-black" || value === "rose-gold") return "cashmere-beige";
  if (value === "citrus" || value === "charcoal-grey" || value === "magic-mint") return "soft-pistachio";
  return isKairoThemeId(value) ? value : DEFAULT_KAIRO_THEME;
}

export function kairoThemeCacheKey(userId: string) {
  return `kairo-theme:${userId}`;
}
