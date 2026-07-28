export const colors = {
  surface: "#FCFBF8",
  onSurface: "#2C2925",
  surfaceSecondary: "#F4EFE6",
  onSurfaceSecondary: "#4A4641",
  surfaceTertiary: "#EBE5DB",
  onSurfaceTertiary: "#5B5650",
  surfaceInverse: "#2C2925",
  onSurfaceInverse: "#FCFBF8",
  brand: "#E6CCBE",
  brandPrimary: "#D4A5A5",
  onBrandPrimary: "#2C2925",
  brandSecondary: "#C5D1C5",
  onBrandSecondary: "#2C2925",
  brandTertiary: "#E9E2D8",
  onBrandTertiary: "#2C2925",
  success: "#A7C4B5",
  warning: "#E3C099",
  error: "#DDA7A5",
  border: "#EBE5DB",
  borderStrong: "#C2BAB0",
  divider: "#EBE5DB",
  mutedText: "#8B857D",
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
