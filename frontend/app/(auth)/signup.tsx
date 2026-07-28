import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing, type } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

export default function Signup() {
  const router = useRouter();
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    setErr(null);
    if (!name || !email || !mobile || !password) return setErr("Please fill in all fields.");
    if (password.length < 6) return setErr("Password should be at least 6 characters.");
    setBusy(true);
    try {
      await signup(name, email, mobile, password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(e.message || "Sign up failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <Pressable testID="back-button" onPress={() => router.back()} style={styles.back}>
            <Feather name="arrow-left" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Join Garlic</Text>
          <Text style={styles.sub}>Create your account for a curated shopping experience.</Text>

          <Field label="Full Name" testID="signup-name-input" value={name} onChangeText={setName} />
          <Field label="Email" testID="signup-email-input" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <Field label="Mobile Number" testID="signup-mobile-input" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" />
          <Field label="Password" testID="signup-password-input" value={password} onChangeText={setPassword} secureTextEntry />

          {err && <Text style={styles.err} testID="signup-error">{err}</Text>}

          <Pressable testID="signup-submit-button" style={styles.cta} onPress={onSubmit} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <Text style={styles.ctaText}>Create Account</Text>}
          </Pressable>
          <Pressable testID="go-to-login" style={styles.altBtn} onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.altText}>Already have an account? Sign in</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, testID, ...rest }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <TextInput
        testID={testID}
        placeholderTextColor={colors.mutedText}
        autoCapitalize="none"
        style={styles.input}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, paddingTop: spacing.md, gap: spacing.lg, flexGrow: 1 },
  back: { width: 40, height: 40, alignItems: "flex-start", justifyContent: "center" },
  title: { ...type.displayLG, marginTop: spacing.md },
  sub: { ...type.body, marginBottom: spacing.md },
  field: { gap: spacing.sm },
  label: { ...type.meta, color: colors.onSurfaceSecondary },
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
