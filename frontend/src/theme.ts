export const colors = {
  surface: "#FCFBF8",
  onSurface: "#2C2925",
  surfaceSecondary: "#F4EFE6",
  onSurfaceSecondary: "#4A4641",
  surfaceTertiary: "#EBE5DB",
  onSurfaceTertiary: "#5B5650",
  surfaceInverse: "#2C2925",
  onSurfaceInverse: "#FCFBF8",

  // Sage green - primary brand color from logo
  brand: "#4A5F45",
  brandPrimary: "#4A5F45",
  onBrandPrimary: "#FCFBF8",
  brandDark: "#3A4E38",
  brandLight: "#D4E0D0",

  // Peach/coral accent - Nestasia-inspired
  accent: "#F5CBB6",
  accentLight: "#FAE5D6",
  accentDark: "#E8A98E",
  onAccent: "#3D1A19",

  brandSecondary: "#C5D1C5",
  onBrandSecondary: "#2C2925",
  brandTertiary: "#E9E2D8",
  onBrandTertiary: "#2C2925",

  success: "#A7C4B5",
  warning: "#E3C099",
  error: "#DDA7A5",
  info: "#B5C8D4",
  sale: "#E8A98E",

  border: "#EBE5DB",
  borderStrong: "#C2BAB0",
  divider: "#EBE5DB",
  mutedText: "#8B857D",

  // Category tile pastels
  tileRose: "#F5D6D0",
  tilePeach: "#F5CBB6",
  tileMint: "#D4E0D0",
  tileSand: "#EAD9C4",
  tileLilac: "#DAD1E4",
  tileSky: "#CDDAE0",
  tileCream: "#F4EFE6",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 0, md: 4, lg: 8, pill: 999 };

export const fonts = {
  display: "CormorantGaramond",
  displayBold: "CormorantGaramondBold",
  text: "DMSans",
  textMedium: "DMSansMedium",
  textBold: "DMSansBold",
};

export const type = {
  displayXL: { fontFamily: fonts.display, fontSize: 40, lineHeight: 48, color: colors.onSurface },
  displayLG: { fontFamily: fonts.display, fontSize: 32, lineHeight: 40, color: colors.onSurface },
  displayMD: { fontFamily: fonts.display, fontSize: 24, lineHeight: 32, color: colors.onSurface },
  displaySM: { fontFamily: fonts.display, fontSize: 20, lineHeight: 28, color: colors.onSurface },
  body: { fontFamily: fonts.text, fontSize: 14, lineHeight: 22, color: colors.onSurfaceSecondary },
  bodyLg: { fontFamily: fonts.text, fontSize: 16, lineHeight: 24, color: colors.onSurfaceSecondary },
  meta: { fontFamily: fonts.text, fontSize: 12, lineHeight: 18, color: colors.mutedText, letterSpacing: 0.5 },
  button: { fontFamily: fonts.textMedium, fontSize: 14, letterSpacing: 1, textTransform: "uppercase" as const },
};

// Round tile pastel palette rotation (Nestasia-style)
export const tilePalette = [
  colors.tilePeach,
  colors.tileRose,
  colors.tileMint,
  colors.tileSand,
  colors.tileLilac,
  colors.tileSky,
  colors.tileCream,
];

// ============================================================================
// ADMIN COCKPIT — warm ivory / terracotta palette used ONLY inside /admin/*
// Storefront theme (above) is untouched.
// ============================================================================
export const adminColors = {
  // Surfaces (warm ivory, beige)
  bg: "#FAF6EF",           // page background (warm ivory)
  surface: "#FFFFFF",       // card surfaces
  surfaceAlt: "#F3EBDD",    // secondary surface (soft beige)
  surfaceMuted: "#EFE6D6",  // hover / rest bg for chips
  onSurface: "#1F1A14",     // near-black text (warm)
  onSurfaceSecondary: "#5C5347",
  mutedText: "#8E8578",

  // Terracotta accent (primary CTA)
  primary: "#B45F3B",       // warm terracotta
  primaryHover: "#9E4E2E",
  onPrimary: "#FFFFFF",
  primarySoft: "#EAD6C8",   // pastel wash of primary
  primarySoftText: "#7A3B22",

  // Semantic (accessible, non-color-only-conveying)
  success: "#4F7A48",        // sage-adjacent (WCAG AA on white)
  successSoft: "#DEEAD8",
  warning: "#B27A2E",         // warm amber
  warningSoft: "#F1E1C1",
  danger: "#B4341F",          // deep red
  dangerSoft: "#F3D7CE",
  info: "#3F6478",
  infoSoft: "#D5E1E8",

  // Structural
  border: "#E5DBC8",
  borderStrong: "#C9BCA1",
  divider: "#EFE6D6",
  overlay: "rgba(31,26,20,0.42)",
};

// Dark-mode variant
export const adminColorsDark = {
  bg: "#141210",
  surface: "#1E1B17",
  surfaceAlt: "#26221C",
  surfaceMuted: "#302B23",
  onSurface: "#F5EFE3",
  onSurfaceSecondary: "#B8AE9D",
  mutedText: "#867E6F",

  primary: "#D07A55",
  primaryHover: "#B96140",
  onPrimary: "#141210",
  primarySoft: "#3A2A1F",
  primarySoftText: "#EAC9B5",

  success: "#77A46E",
  successSoft: "#233223",
  warning: "#D3A05C",
  warningSoft: "#3A2E17",
  danger: "#DC6B54",
  dangerSoft: "#3A1E17",
  info: "#75A2B7",
  infoSoft: "#1F2F38",

  border: "#3A342A",
  borderStrong: "#5B5343",
  divider: "#2A251F",
  overlay: "rgba(0,0,0,0.55)",
};

export const adminSpacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 };
export const adminRadius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 };

export const adminType = {
  displayXL: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 36, letterSpacing: -0.5 },
  displayLG: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  displayMD: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26 },
  h1: { fontFamily: fonts.textBold, fontSize: 22, lineHeight: 28 },
  h2: { fontFamily: fonts.textBold, fontSize: 18, lineHeight: 24 },
  h3: { fontFamily: fonts.textBold, fontSize: 15, lineHeight: 20, letterSpacing: 0.2 },
  bodyLg: { fontFamily: fonts.text, fontSize: 15, lineHeight: 22 },
  body: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20 },
  bodySm: { fontFamily: fonts.text, fontSize: 12, lineHeight: 18 },
  label: { fontFamily: fonts.textMedium, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: "uppercase" as const },
  metric: { fontFamily: fonts.displayBold, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  button: { fontFamily: fonts.textBold, fontSize: 13, letterSpacing: 0.8, textTransform: "uppercase" as const },
};

