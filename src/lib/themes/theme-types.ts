export const KAIRO_THEME_IDS = [
  "despacho-blue",
  "emerald",
  "royal-purple",
  "ocean-teal",
  "rose-gold",
  "graphite",
  "pink-sand",
  "citrus",
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
};

export type KairoThemeDefinition = {
  id: KairoThemeId;
  name: string;
  description: string;
  palette: KairoThemePalette;
};
