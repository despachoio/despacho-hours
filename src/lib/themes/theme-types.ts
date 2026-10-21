export const KAIRO_THEME_IDS = [
  "despacho-blue",
  "royal-purple",
  "ocean-teal",
  "graphite",
  "powder-blue",
  "peach-whisper",
  "cashmere-beige",
  "soft-pistachio",
] as const;

export type KairoThemeId = (typeof KAIRO_THEME_IDS)[number];

export type KairoThemePalette = {
  heroStart: string;
  heroEnd: string;
  primary: string;
  primaryHover: string;
  primaryForeground: string;
  heading: string;
  activeTab: string;
  activeTabText: string;
  pastel: string;
  pageBackground: string;
  signatureHighlight?: string;
  heroText: string;
  heroMuted: string;
};

export type KairoThemeDefinition = {
  id: KairoThemeId;
  name: string;
  description: string;
  heroAppearance: "dark" | "light";
  palette: KairoThemePalette;
};
