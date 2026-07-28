import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/src/theme";

type Size = "sm" | "md" | "lg" | "xl";

const SIZES: Record<Size, { g: number; s: number; gap: number; line: number; lineW: number }> = {
  sm: { g: 20, s: 8, gap: 2, line: 1, lineW: 22 },
  md: { g: 28, s: 9, gap: 3, line: 1, lineW: 28 },
  lg: { g: 44, s: 10, gap: 6, line: 1, lineW: 40 },
  xl: { g: 64, s: 12, gap: 10, line: 1.5, lineW: 60 },
};

export default function BrandLogo({
  size = "md",
  color = colors.onSurface,
  subtitleColor,
  testID = "brand-logo",
}: {
  size?: Size;
  color?: string;
  subtitleColor?: string;
  testID?: string;
}) {
  const s = SIZES[size];
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.flourishRow}>
        <View style={[styles.line, { width: s.lineW, height: s.line, backgroundColor: color, opacity: 0.6 }]} />
        <Text
          style={{
            fontFamily: "CormorantGaramondBold",
            fontSize: s.g,
            lineHeight: s.g * 1.05,
            color,
            fontStyle: "italic",
            letterSpacing: 0.5,
            paddingHorizontal: 10,
          }}
        >
          Garlic
        </Text>
        <View style={[styles.line, { width: s.lineW, height: s.line, backgroundColor: color, opacity: 0.6 }]} />
      </View>
      <Text
        style={{
          fontFamily: "DMSansMedium",
          fontSize: s.s,
          letterSpacing: 3,
          color: subtitleColor || color,
          opacity: 0.75,
          marginTop: s.gap,
        }}
      >
        BY URBAN NEST
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  flourishRow: { flexDirection: "row", alignItems: "center" },
  line: {},
});
