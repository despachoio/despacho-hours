import type { KairoThemeDefinition, KairoThemeId } from "./theme-types";

export const DEFAULT_KAIRO_THEME: KairoThemeId = "despacho-blue";

export const KAIRO_THEMES: readonly KairoThemeDefinition[] = [
  { id: "despacho-blue", name: "Despacho Blue", description: "Kairo's original corporate blue.", palette: { heroStart: "#101B36", heroEnd: "#19469C", primary: "#153E90", primaryHover: "#103578", primaryForeground: "#FFFFFF", heading: "#153E90", activeTab: "#19469C", activeTabText: "#FFFFFF", pastel: "#EAF2FF", pageBackground: "#F8FAFC" } },
  { id: "emerald", name: "Emerald", description: "A composed green corporate palette.", palette: { heroStart: "#103F3A", heroEnd: "#07846E", primary: "#087F68", primaryHover: "#066A58", primaryForeground: "#FFFFFF", heading: "#14594D", activeTab: "#087F68", activeTabText: "#FFFFFF", pastel: "#E5F7F0", pageBackground: "#F8FCFA" } },
  { id: "royal-purple", name: "Royal Purple", description: "A refined violet executive palette.", palette: { heroStart: "#2B194F", heroEnd: "#7550B8", primary: "#6941A5", primaryHover: "#57358A", primaryForeground: "#FFFFFF", heading: "#503080", activeTab: "#6941A5", activeTabText: "#FFFFFF", pastel: "#F2ECFF", pageBackground: "#FBF9FF" } },
  { id: "ocean-teal", name: "Ocean Teal", description: "A modern blue-green workspace.", palette: { heroStart: "#103D53", heroEnd: "#087E9C", primary: "#087E9C", primaryHover: "#066A84", primaryForeground: "#FFFFFF", heading: "#15556B", activeTab: "#087E9C", activeTabText: "#FFFFFF", pastel: "#E5F7FC", pageBackground: "#F8FCFD" } },
  { id: "rose-gold", name: "Rose Gold", description: "An elegant muted rose palette.", palette: { heroStart: "#553044", heroEnd: "#B36D86", primary: "#99546F", primaryHover: "#80445D", primaryForeground: "#FFFFFF", heading: "#74425A", activeTab: "#99546F", activeTabText: "#FFFFFF", pastel: "#FFF0F3", pageBackground: "#FFFAFB" } },
  { id: "graphite", name: "Graphite", description: "A confident modern neutral theme.", palette: { heroStart: "#202938", heroEnd: "#515E70", primary: "#475569", primaryHover: "#364152", primaryForeground: "#FFFFFF", heading: "#334155", activeTab: "#475569", activeTabText: "#FFFFFF", pastel: "#EFF2F6", pageBackground: "#F8FAFC" } },
  { id: "slate-grey", name: "Slate Grey", description: "A cool grey with a blue undertone.", palette: { heroStart: "#343C49", heroEnd: "#566273", primary: "#566273", primaryHover: "#465160", primaryForeground: "#FFFFFF", heading: "#343C49", activeTab: "#475569", activeTabText: "#FFFFFF", pastel: "#F1F3F5", pageBackground: "#F9FAFB" } },
  { id: "charcoal-grey", name: "Charcoal Grey", description: "A sophisticated warm-neutral theme.", palette: { heroStart: "#474747", heroEnd: "#696969", primary: "#595959", primaryHover: "#474747", primaryForeground: "#FFFFFF", heading: "#404040", activeTab: "#525252", activeTabText: "#FFFFFF", pastel: "#F5F5F5", pageBackground: "#FAFAFA" } },
] as const;

export const KAIRO_THEME_MAP = Object.fromEntries(KAIRO_THEMES.map((theme) => [theme.id, theme])) as Record<KairoThemeId, KairoThemeDefinition>;
