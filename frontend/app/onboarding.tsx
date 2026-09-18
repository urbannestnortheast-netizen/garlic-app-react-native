import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { colors, radius, spacing } from "@/src/theme";
import BrandLogo from "@/src/components/BrandLogo";

export default function Onboarding() {
  const router = useRouter();
  return (
    <View style={styles.root} testID="onboarding-screen">
      <View style={styles.hero}>
        <Image
          source={{ uri: "https://images.unsplash.com/photo-1609081144289-eacc3108cd03" }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={400}
        />
        <LinearGradient
          colors={["transparent", "rgba(252,251,248,0.4)", colors.surface]}
          locations={[0.5, 0.85, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={styles.bottom}>
        <BrandLogo size="xl" testID="brand-logo" />
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
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { height: "38%", width: "100%" },
  bottom: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
  },
  tagline: {
    color: colors.onSurfaceSecondary,
    textAlign: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    maxWidth: "88%",
    fontFamily: "CormorantGaramond",
    fontStyle: "italic",
    fontSize: 18,
    lineHeight: 26,
  },
  cta: {
    backgroundColor: colors.brand,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxxl,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  ctaText: {
    fontFamily: "DMSansBold",
    color: colors.onBrandPrimary,
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  signInLink: { marginTop: spacing.lg, alignItems: "center" },
  signInText: {
    color: colors.onSurfaceSecondary,
    fontFamily: "DMSans",
    fontSize: 14,
    textDecorationLine: "underline",
  },
});
