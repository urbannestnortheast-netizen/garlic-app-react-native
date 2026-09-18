import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import Feather from "@react-native-vector-icons/feather";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing, type } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    setErr(null);
    if (!identifier || !password) return setErr("Enter your email/mobile and password.");
    setBusy(true);
    try {
      await login(identifier, password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(e.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <Pressable testID="back-button" onPress={() => router.back()} style={styles.back}>
            <Feather name="arrow-left" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.sub}>Sign in to continue your nesting.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email or Mobile</Text>
            <TextInput
              testID="login-identifier-input"
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="hello@example.com"
              placeholderTextColor={colors.mutedText}
              autoCapitalize="none"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              testID="login-password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.mutedText}
              secureTextEntry
              style={styles.input}
            />
          </View>

          {err && <Text style={styles.err} testID="login-error">{err}</Text>}

          <Pressable
            testID="login-submit-button"
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            onPress={onSubmit}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.ctaText}>Sign In</Text>}
          </Pressable>

          <Pressable
            testID="go-to-signup"
            style={styles.altBtn}
            onPress={() => router.replace("/(auth)/signup")}
          >
            <Text style={styles.altText}>New here? Create an account</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, paddingTop: spacing.md, gap: spacing.lg, flexGrow: 1 },
  back: { width: 40, height: 40, alignItems: "flex-start", justifyContent: "center" },
  title: { ...type.displayLG, marginTop: spacing.md },
  sub: { ...type.body, marginBottom: spacing.md },
  field: { gap: spacing.sm },
  label: { ...type.meta, color: colors.onSurfaceSecondary, textTransform: "uppercase" },
  input: {
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.lg,
    fontFamily: "DMSans", fontSize: 16, color: colors.onSurface,
  },
  cta: {
    marginTop: spacing.md, backgroundColor: colors.onSurface, paddingVertical: spacing.lg,
    borderRadius: radius.pill, alignItems: "center",
  },
  ctaText: {
    color: colors.onSurfaceInverse, fontFamily: "DMSansBold",
    letterSpacing: 1.5, textTransform: "uppercase", fontSize: 14,
  },
  altBtn: { alignItems: "center", padding: spacing.md },
  altText: { fontFamily: "DMSans", color: colors.onSurfaceSecondary, textDecorationLine: "underline" },
  err: { fontFamily: "DMSans", color: colors.error, backgroundColor: "#F9EDEC", padding: spacing.md, borderRadius: radius.lg },
});
