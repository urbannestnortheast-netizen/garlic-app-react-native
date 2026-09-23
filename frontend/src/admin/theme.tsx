import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { adminColors, adminColorsDark, adminSpacing, adminRadius, adminType } from "@/src/theme";

type AdminTheme = {
  colors: typeof adminColors;
  spacing: typeof adminSpacing;
  radius: typeof adminRadius;
  type: typeof adminType;
  isDark: boolean;
};

const Ctx = createContext<AdminTheme | null>(null);

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const value = useMemo<AdminTheme>(
    () => ({
      colors: isDark ? adminColorsDark : adminColors,
      spacing: adminSpacing,
      radius: adminRadius,
      type: adminType,
      isDark,
    }),
    [isDark],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminTheme(): AdminTheme {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdminTheme outside <AdminThemeProvider>");
  return c;
}
