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
