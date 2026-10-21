import { DEFAULT_KAIRO_THEME } from "./theme-config";
import { KAIRO_THEME_IDS, type KairoThemeId } from "./theme-types";

export function isKairoThemeId(value: unknown): value is KairoThemeId {
  return typeof value === "string" && (KAIRO_THEME_IDS as readonly string[]).includes(value);
}

export function normalizeKairoTheme(value: unknown): KairoThemeId {
  if (value === "emerald") return "columbia-blue";
  if (value === "rose-gold") return "jet-black";
  if (value === "slate-grey") return "pink-sand";
  if (value === "charcoal-grey" || value === "magic-mint") return "citrus";
  return isKairoThemeId(value) ? value : DEFAULT_KAIRO_THEME;
}

export function kairoThemeCacheKey(userId: string) {
  return `kairo-theme:${userId}`;
}
