import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, radius, spacing, type } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>YOUR</Text>
          <Text style={styles.title}>Profile</Text>
        </View>
        <View style={styles.emptyWrap} testID="profile-signin-required">
          <Feather name="user" size={40} color={colors.mutedText} />
          <Text style={styles.emptyTitle}>Welcome, dear guest</Text>
          <Text style={styles.emptyText}>Sign in to manage your orders and account.</Text>
          <Pressable testID="profile-signin-btn" style={styles.cta} onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.ctaText}>Sign In</Text>
          </Pressable>
          <Pressable testID="profile-signup-btn" style={styles.altBtn} onPress={() => router.push("/(auth)/signup")}>
            <Text style={styles.altText}>Create Account</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const Row = ({ icon, label, onPress, testID }: any) => (
    <Pressable testID={testID} style={styles.row} onPress={onPress}>
      <View style={styles.rowIcon}>
        <Feather name={icon} size={18} color={colors.onSurface} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Feather name="chevron-right" size={18} color={colors.mutedText} />
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>WELCOME</Text>
          <Text style={styles.title}>{user.name || "Friend"}</Text>
          <Text style={styles.subtle}>{user.email}</Text>
          <Text style={styles.subtle}>+91 {user.mobile}</Text>
        </View>

        <View style={styles.section}>
          <Row icon="shopping-bag" label="My Orders" testID="profile-orders" onPress={() => router.push("/orders")} />
          <Row icon="bookmark" label="My Nest Tables" testID="profile-shortlists" onPress={() => router.push("/shortlists")} />
          <Row icon="heart" label="Wishlist" testID="profile-wishlist" onPress={() => router.push("/(tabs)/wishlist")} />
          <Row icon="gift" label="Gifting" testID="profile-gifts" onPress={() => router.push("/gifts")} />
          <Row icon="grid" label="Collections" testID="profile-collections" onPress={() => router.push("/collections")} />
          {user.role === "admin" && (
            <Row icon="settings" label="Admin Panel" testID="profile-admin" onPress={() => router.push("/admin")} />
          )}
        </View>

        <Pressable testID="profile-logout-btn" style={styles.logout} onPress={logout}>
          <Feather name="log-out" size={18} color={colors.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.xl, paddingBottom: spacing.xl },
  eyebrow: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: colors.mutedText },
  title: { ...type.displayLG, marginTop: spacing.xs, marginBottom: spacing.sm },
  subtle: { fontFamily: "DMSans", color: colors.onSurfaceSecondary, fontSize: 14, marginTop: 2 },
  section: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.divider },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingVertical: spacing.lg, paddingHorizontal: spacing.xl,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontFamily: "DMSans", fontSize: 15, color: colors.onSurface },
  logout: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.xl },
  logoutText: { fontFamily: "DMSansMedium", color: colors.error, fontSize: 15 },
  emptyWrap: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyTitle: { ...type.displaySM, marginTop: spacing.md, textAlign: "center" },
  emptyText: { ...type.body, textAlign: "center", marginBottom: spacing.md },
  cta: { marginTop: spacing.md, backgroundColor: colors.onSurface, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, borderRadius: radius.pill },
  ctaText: { color: colors.onSurfaceInverse, fontFamily: "DMSansBold", letterSpacing: 1.5, textTransform: "uppercase", fontSize: 13 },
  altBtn: { padding: spacing.md },
  altText: { fontFamily: "DMSans", color: colors.onSurfaceSecondary, textDecorationLine: "underline" },
});
