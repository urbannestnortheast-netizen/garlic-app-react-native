import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, Platform, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, radius, spacing, type } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { api } from "@/src/api/client";

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [points, setPoints] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadPoints = useCallback(async () => {
    if (!user) return;
    try {
      const p = await api<{ balance: number }>("/points", { auth: true });
      setPoints(p.balance);
    } catch {}
  }, [user]);

  useFocusEffect(useCallback(() => { loadPoints(); }, [loadPoints]));

  const performDelete = async () => {
    try {
      setDeleting(true);
      await api("/auth/me", { method: "DELETE", auth: true });
      await logout();
      if (Platform.OS === "web") {
        // @ts-ignore
        window.alert("Your account has been permanently deleted.");
      } else {
        Alert.alert("Account deleted", "Your account has been permanently deleted.");
      }
      router.replace("/onboarding");
    } catch (e: any) {
      const msg = e?.message || "Unable to delete account. Please try again.";
      if (Platform.OS === "web") {
        // @ts-ignore
        window.alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    const msg =
      "This permanently deletes your account, wishlist, shortlists, reviews, and rewards points. Your past orders remain for accounting but are anonymised. This cannot be undone.";
    if (Platform.OS === "web") {
      // @ts-ignore
      if (window.confirm("Delete Account\n\n" + msg)) performDelete();
    } else {
      Alert.alert("Delete Account", msg, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete },
      ]);
    }
  };

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

        <Pressable style={styles.pointsCard} onPress={() => router.push("/points")} testID="points-card">
          <View style={{ flex: 1 }}>
            <Text style={styles.pointsEyebrow}>NEST REWARDS</Text>
            <Text style={styles.pointsBalance}>
              {points !== null ? `${points.toLocaleString("en-IN")} pts` : "—"}
            </Text>
            <Text style={styles.pointsMeta}>Tap to view rewards & activity</Text>
          </View>
          <Feather name="chevron-right" size={22} color={colors.onBrandPrimary} />
        </Pressable>

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

        {user.role !== "admin" && (
          <Pressable
            testID="profile-delete-account-btn"
            style={styles.deleteBtn}
            onPress={confirmDelete}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={colors.mutedText} />
            ) : (
              <>
                <Feather name="trash-2" size={16} color={colors.mutedText} />
                <Text style={styles.deleteText}>Delete Account</Text>
              </>
            )}
          </Pressable>
        )}
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
  pointsCard: { marginHorizontal: spacing.xl, marginBottom: spacing.lg, backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.md },
  pointsEyebrow: { fontFamily: "DMSansMedium", fontSize: 10, letterSpacing: 2, color: "rgba(252,251,248,0.75)" },
  pointsBalance: { fontFamily: "CormorantGaramondBold", fontSize: 26, color: colors.onBrandPrimary, marginTop: 2 },
  pointsMeta: { fontFamily: "DMSans", fontSize: 11, color: "rgba(252,251,248,0.75)", marginTop: 2 },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingVertical: spacing.lg, paddingHorizontal: spacing.xl,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontFamily: "DMSans", fontSize: 15, color: colors.onSurface },
  logout: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.xl },
  logoutText: { fontFamily: "DMSansMedium", color: colors.error, fontSize: 15 },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, marginHorizontal: spacing.xl, marginTop: spacing.md, paddingVertical: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  deleteText: { fontFamily: "DMSans", color: colors.mutedText, fontSize: 13, letterSpacing: 0.5 },
  emptyWrap: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyTitle: { ...type.displaySM, marginTop: spacing.md, textAlign: "center" },
  emptyText: { ...type.body, textAlign: "center", marginBottom: spacing.md },
  cta: { marginTop: spacing.md, backgroundColor: colors.onSurface, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, borderRadius: radius.pill },
  ctaText: { color: colors.onSurfaceInverse, fontFamily: "DMSansBold", letterSpacing: 1.5, textTransform: "uppercase", fontSize: 13 },
  altBtn: { padding: spacing.md },
  altText: { fontFamily: "DMSans", color: colors.onSurfaceSecondary, textDecorationLine: "underline" },
});
