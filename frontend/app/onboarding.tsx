import React from "react";
import { View, Text, Pressable, StyleSheet, Dimensions, Image as RNImage } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { colors, radius, spacing, type } from "@/src/theme";

const { width, height: screenHeight } = Dimensions.get("window");
const HERO_H = Math.round(screenHeight * 0.42);
const LOGO_W = Math.round(width * 0.72);
const LOGO_H = Math.round(LOGO_W * (469 / 802));

export default function Onboarding() {
  const router = useRouter();
  return (
    <View style={styles.root} testID="onboarding-screen">
      {/* Hero interior image, top half */}
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

      {/* Bottom logo + CTA area, cream background so logo blends */}
      <View style={styles.bottom}>
        <RNImage
          source={require("@/assets/brand/garlic-logo.jpg")}
          style={styles.logo}
          resizeMode="contain"
          testID="brand-logo"
        />
        <Text style={styles.tag} testID="brand-tagline">BY URBAN NEST</Text>
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
  hero: { height: "35%", width: "100%" },
  bottom: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
  },
  logo: {
    width: 260,
    height: 152,
    marginTop: -spacing.md,
  },
  tag: {
    ...type.meta,
    color: colors.mutedText,
    marginTop: spacing.xs,
    letterSpacing: 3,
  },
  tagline: {
    ...type.bodyLg,
    color: colors.onSurfaceSecondary,
    textAlign: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    maxWidth: "90%",
    fontStyle: "italic",
    fontFamily: "CormorantGaramond",
    fontSize: 18,
    lineHeight: 26,
  },
  cta: {
    backgroundColor: "#4A5F45",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxxl,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  ctaText: {
    fontFamily: "DMSansBold",
    color: "#FCFBF8",
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
