import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, RefreshControl, StyleSheet } from "react-native";
import Feather from "@react-native-vector-icons/feather";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAdminTheme } from "@/src/admin/theme";
import { AdminBadge, AdminEmpty, AdminSkeleton } from "@/src/admin/ui";
import { api } from "@/src/api/client";

type Customer = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: string;
  orders_count: number;
  total_spent: number;
  last_order_at?: string;
  created_at?: string;
};

function INR(n: number) { return "₹" + Math.round(n || 0).toLocaleString("en-IN"); }
function relDate(iso?: string) {
  if (!iso) return "Never";
  const d = new Date(iso);
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / 3.6e6;
  if (diffH < 24) return "Today";
  if (diffH < 48) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function initials(name: string) {
  const parts = (name || "?").trim().split(/\s+/);
  return (parts[0]?.[0] || "?").toUpperCase() + (parts[1]?.[0] || "").toUpperCase();
}

export default function AdminCustomers() {
  const t = useAdminTheme();
  const router = useRouter();
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const styles = useStyles();

  const load = useCallback(async () => {
    try {
      const list = await api<Customer[]>("/admin/customers", { auth: true });
      setItems(list);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((c) => (c.name + " " + c.email + " " + c.mobile).toLowerCase().includes(term));
  }, [items, q]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={t.colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[t.type.h1, { color: t.colors.onSurface }]}>Customers</Text>
          <Text style={[t.type.bodySm, { color: t.colors.onSurfaceSecondary, marginTop: 2 }]}>{filtered.length} people</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color={t.colors.mutedText} />
          <TextInput
            testID="customers-search"
            value={q}
            onChangeText={setQ}
            placeholder="Name, email, or mobile…"
            placeholderTextColor={t.colors.mutedText}
            style={{ flex: 1, color: t.colors.onSurface, fontFamily: "DMSans", fontSize: 15, paddingVertical: 10 }}
            accessibilityLabel="Search customers"
            keyboardType="default"
          />
        </View>
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0, 1, 2, 3].map((i) => <AdminSkeleton key={i} height={80} radius={14} />)}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.colors.primary} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}
          ListEmptyComponent={
            <AdminEmpty icon="users" title={q ? "No matches" : "No customers yet"} subtitle={q ? undefined : "Signups will appear here."} />
          }
          renderItem={({ item: c }) => (
            <Pressable
              onPress={() => router.push(`/admin/customer/${c.id}` as any)}
              accessibilityRole="button"
              accessibilityLabel={`${c.name}, ${c.orders_count} orders, total spent ${INR(c.total_spent)}`}
              style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
            >
              <View style={styles.avatar}>
                <Text style={{ ...t.type.h3, color: t.colors.primary }}>{initials(c.name)}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[t.type.bodyLg, { color: t.colors.onSurface, fontFamily: "DMSansMedium" }]} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={[t.type.bodySm, { color: t.colors.mutedText }]} numberOfLines={1}>{c.email}</Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                  <AdminBadge label={`${c.orders_count} orders`} tone="neutral" icon="shopping-bag" />
                  {c.total_spent > 0 && <AdminBadge label={INR(c.total_spent)} tone="success" />}
                </View>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <Text style={[t.type.bodySm, { color: t.colors.mutedText }]}>Last order</Text>
                <Text style={[t.type.body, { color: t.colors.onSurface, fontFamily: "DMSansMedium" }]}>{relDate(c.last_order_at)}</Text>
                <Feather name="chevron-right" size={16} color={t.colors.mutedText} />
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function useStyles() {
  const t = useAdminTheme();
  return StyleSheet.create({
    topBar: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingTop: 4, minHeight: 56 },
    iconBtn: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", padding: 8 },
    searchBox: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: t.colors.surface, borderRadius: t.radius.md,
      borderWidth: 1, borderColor: t.colors.border, paddingHorizontal: 12, minHeight: 44,
    },
    card: {
      flexDirection: "row", gap: 12, padding: 14, alignItems: "center",
      backgroundColor: t.colors.surface, borderRadius: t.radius.lg,
      borderWidth: 1, borderColor: t.colors.border,
    },
    avatar: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: t.colors.primarySoft, alignItems: "center", justifyContent: "center",
    },
  });
}
