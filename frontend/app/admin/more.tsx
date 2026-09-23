import React from "react";
import { View, Text, ScrollView, StyleSheet, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAdminTheme } from "@/src/admin/theme";
import { AdminCard, AdminRow, AdminBadge } from "@/src/admin/ui";
import { useAuth } from "@/src/context/AuthContext";

type Item = {
  icon: string;
  title: string;
  subtitle?: string;
  href?: string;
  disabled?: boolean;
  badge?: string;
  destructive?: boolean;
  action?: () => void;
};

export default function AdminMore() {
  const t = useAdminTheme();
  const router = useRouter();
  const { user, logout } = useAuth();
  const styles = useStyles();

  const openSoon = (feature: string) => {
    const msg = `${feature} is coming in the next update.`;
    if (Platform.OS === "web") { /* @ts-ignore */ window.alert(msg); }
    else Alert.alert("Coming soon", msg);
  };

  const doLogout = async () => {
    const run = async () => {
      await logout();
      router.replace("/(auth)/login");
    };
    if (Platform.OS === "web") {
      /* @ts-ignore */
      if (window.confirm("Sign out of admin?")) run();
    } else {
      Alert.alert("Sign out?", "You'll need to sign back in to manage the store.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: run },
      ]);
    }
  };

  const catalogGroup: Item[] = [
    { icon: "box", title: "Inventory", subtitle: "Stock levels and adjustments", action: () => router.push("/admin/inventory" as any) },
    { icon: "grid", title: "Categories", subtitle: "Organise your catalog", action: () => openSoon("Categories") },
    { icon: "folder", title: "Collections", subtitle: "Curated product groupings", action: () => openSoon("Collections") },
  ];
  const customerGroup: Item[] = [
    { icon: "users", title: "Customers", subtitle: "Registered shoppers", action: () => router.push("/admin/customers" as any) },
    { icon: "message-square", title: "Reviews", subtitle: "Moderate product reviews", action: () => router.push("/admin/reviews" as any) },
    { icon: "tag", title: "Promotions", subtitle: "Coupons and discounts", action: () => router.push("/admin/promotions" as any) },
  ];
  const contentGroup: Item[] = [
    { icon: "layout", title: "Content", subtitle: "Homepage, banners, inspiration", action: () => openSoon("Content management") },
    { icon: "image", title: "Media Library", subtitle: "Photos and product imagery", action: () => openSoon("Media library") },
  ];
  const insightsGroup: Item[] = [
    { icon: "bar-chart-2", title: "Analytics", subtitle: "Revenue, orders, conversion", action: () => openSoon("Analytics") },
    { icon: "clock", title: "Audit Log", subtitle: "Recent admin actions", action: () => openSoon("Audit log") },
  ];
  const accountGroup: Item[] = [
    { icon: "settings", title: "Settings", subtitle: "Store, taxes, shipping, payments", action: () => openSoon("Settings") },
    { icon: "help-circle", title: "Help & Support", subtitle: "Docs, contact support", action: () => openSoon("Help") },
  ];

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={[t.type.displayMD, { color: t.colors.primary }]}>
              {(user?.name || "A").slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[t.type.h1, { color: t.colors.onSurface }]}>{user?.name || "Admin"}</Text>
            <Text style={[t.type.bodySm, { color: t.colors.onSurfaceSecondary, marginTop: 2 }]}>{user?.email || ""}</Text>
            <View style={{ marginTop: 6, flexDirection: "row", gap: 6 }}>
              <AdminBadge label={user?.role === "admin" ? "Super Admin" : (user?.role || "")} tone="primary" icon="shield" />
            </View>
          </View>
        </View>

        <Group label="Catalog" items={catalogGroup} />
        <Group label="Customers & Marketing" items={customerGroup} />
        <Group label="Content" items={contentGroup} />
        <Group label="Insights" items={insightsGroup} />
        <Group label="Account" items={accountGroup} />

        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <AdminCard padded={false}>
            <AdminRow
              icon="log-out"
              title="Sign out"
              onPress={doLogout}
              destructive
              testID="admin-logout-btn"
              accessibilityHint="Signs you out of the admin panel"
            />
          </AdminCard>
        </View>

        <Text style={[t.type.bodySm, { color: t.colors.mutedText, textAlign: "center", marginTop: 20 }]}>
          Garlic by Urban Nest · Admin v1.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Group({ label, items }: { label: string; items: Item[] }) {
  const t = useAdminTheme();
  return (
    <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
      <Text style={[t.type.label, { color: t.colors.mutedText, marginBottom: 8, paddingHorizontal: 4 }]}>{label}</Text>
      <AdminCard padded={false}>
        {items.map((it, idx) => (
          <View key={it.title}>
            <AdminRow
              icon={it.icon}
              title={it.title}
              subtitle={it.subtitle}
              onPress={it.action}
              right={it.badge ? <AdminBadge label={it.badge} tone="neutral" /> : undefined}
            />
            {idx < items.length - 1 && <View style={{ height: 1, backgroundColor: t.colors.divider, marginLeft: 68 }} />}
          </View>
        ))}
      </AdminCard>
    </View>
  );
}

function useStyles() {
  const t = useAdminTheme();
  return StyleSheet.create({
    header: {
      flexDirection: "row", alignItems: "center", gap: 14,
      padding: 20, paddingBottom: 8,
    },
    avatar: {
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: t.colors.primarySoft, alignItems: "center", justifyContent: "center",
    },
  });
}
