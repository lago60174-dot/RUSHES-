export const C = {
  bg:           "#07090F",
  bgAlt:        "#0B1018",
  surface:      "#0F1623",
  surfaceAlt:   "#141D2E",
  card:         "#192338",
  cardHover:    "#1E2B44",
  border:       "#1E2D45",
  borderLight:  "#2A3F60",

  violet:       "#7C3AED",
  violetLight:  "#A78BFA",
  violetBg:     "rgba(124,58,237,0.12)",
  violetGlow:   "rgba(124,58,237,0.25)",

  cyan:         "#06B6D4",
  cyanLight:    "#67E8F9",
  cyanBg:       "rgba(6,182,212,0.1)",

  emerald:      "#10B981",
  emeraldBg:    "rgba(16,185,129,0.1)",

  coral:        "#F43F5E",
  coralBg:      "rgba(244,63,94,0.1)",

  amber:        "#F59E0B",
  amberBg:      "rgba(245,158,11,0.1)",

  textPrimary:   "#EEF2FF",
  textSecondary: "#7B8DB0",
  textMuted:     "#3D4F6E",
};

export const FONT_DISPLAY = "'Space Grotesk', system-ui, -apple-system, sans-serif";
export const FONT_MONO    = "'IBM Plex Mono', 'SFMono-Regular', monospace";

export const PLATFORMS: Record<string, { label: string; short: string; color: string }> = {
  tiktok:    { label: "TikTok",          short: "TT", color: "#4DD9D2" },
  instagram: { label: "Instagram",       short: "IG", color: "#D6457D" },
  youtube:   { label: "YouTube Shorts",  short: "YT", color: "#E25555" },
  facebook:  { label: "Facebook",        short: "FB", color: "#5B8DEF" },
};

export const TABS = [
  { key: "calendar",  label: "Calendrier",     icon: "📅" },
  { key: "dashboard", label: "Tableau de bord", icon: "📊" },
  { key: "history",   label: "Historique",      icon: "🏆" },
  { key: "ai",        label: "Analyse IA",      icon: "✦" },
  { key: "clips",     label: "Découpage",       icon: "✂" },
];

export const MIN_VIDEOS_FOR_ANALYSIS = 5;
