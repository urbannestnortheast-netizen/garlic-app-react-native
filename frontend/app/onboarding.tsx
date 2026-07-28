import React from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { colors, radius, spacing, type } from "@/src/theme";

const { height } = Dimensions.get("window");

export default function Onboarding() {
  const router = useRouter();
  return (
    <View style={styles.root} testID="onboarding-screen">
      <Image
        source={{ uri: "https://images.unsplash.com/photo-1609081144289-eacc3108cd03" }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={400}
      />
      <LinearGradient
        colors={["transparent", "rgba(44,41,37,0.35)", "rgba(44,41,37,0.9)"]}
        locations={[0.35, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <Text style={styles.tag} testID="brand-tagline">URBAN NEST PRESENTS</Text>
        <Text style={styles.brand}>Garlic</Text>
        <Text style={styles.tagline}>
          Aesthetic home essentials, crockery & decor curated for a softer life.
        </Text>
        <Pressable
          testID="enter-nest-button"
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          onPress={() => router.replace("/(tabs)")}
        >
          <Text style={styles.ctaText}>Enter the Nest</Text>
        </Pressable>
        <Pressable
          testID="signin-link"
          style={styles.signInLink}
          onPress={() => router.push("/(auth)/login")}
        >
          <Text style={styles.signInText}>Already a member? Sign in</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceInverse },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl + spacing.md,
    minHeight: height * 0.5,
  },
  tag: { ...type.meta, color: "#F1E7DD", marginBottom: spacing.md },
  brand: {
    fontFamily: "CormorantGaramondBold",
    fontSize: 64,
    lineHeight: 68,
    color: colors.onSurfaceInverse,
    marginBottom: spacing.md,
  },
  tagline: {
    ...type.bodyLg,
    color: "#F1E7DD",
    marginBottom: spacing.xl,
    maxWidth: "90%",
  },
  cta: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  ctaText: {
    fontFamily: "DMSansBold",
    color: colors.onBrandPrimary,
    fontSize: 14,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  signInLink: { marginTop: spacing.lg, alignItems: "center" },
  signInText: { color: "#F1E7DD", fontFamily: "DMSans", fontSize: 14 },
});
