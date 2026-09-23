import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, FlatList, RefreshControl, StyleSheet, Modal } from "react-native";
import Feather from "@react-native-vector-icons/feather";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAdminTheme } from "@/src/admin/theme";
import { AdminBadge, AdminEmpty, AdminSkeleton, AdminButton } from "@/src/admin/ui";
import { api } from "@/src/api/client";

const STATUS_TONE: Record<string, any> = {
  paid: "success", processing: "info", shipped: "primary",
  delivered: "success", cancelled: "danger", refunded: "warning", created: "neutral",
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "created", label: "Pending" },
  { key: "paid", label: "Paid" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
  { key: "refunded", label: "Refunded" },
];

function INR(n: number) { return "₹" + Math.round(n || 0).toLocaleString("en-IN"); }
function relDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / 3.6e6;
  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${Math.round(diffH)}h ago`;
  if (diffH < 48) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function AdminOrders() {
  const t = useAdminTheme();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api<any[]>("/admin/orders", { auth: true });
      setOrders(list);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (!term) return true;
      const hay = (o.id + " " + (o.shipping_name || "") + " " + (o.shipping_phone || "")).toLowerCase();
      return hay.includes(term);
    });
  }, [orders, q, filter]);

  const styles = useStyles();

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <View style={styles.header}>
        <Text style={[t.type.displayLG, { color: t.colors.onSurface }]}>Orders</Text>
        <Text style={[t.type.body, { color: t.colors.onSurfaceSecondary, marginTop: 2 }]}>
          {filtered.length} {filter === "all" ? "total" : filter}
        </Text>
      </View>

      {/* Search + filter row */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color={t.colors.mutedText} />
          <TextInput
            testID="orders-search"
            value={q}
            onChangeText={setQ}
            placeholder="Search orders, customers…"
            placeholderTextColor={t.colors.mutedText}
            style={{ flex: 1, color: t.colors.onSurface, fontFamily: "DMSans", fontSize: 15, paddingVertical: 10 }}
            accessibilityLabel="Search orders"
            returnKeyType="search"
          />
          {q.length ? (
            <Pressable onPress={() => setQ("")} accessibilityLabel="Clear search" hitSlop={12} style={{ padding: 4 }}>
              <Feather name="x" size={16} color={t.colors.mutedText} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => setFilterOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Filter orders"
          style={styles.filterBtn}
        >
          <Feather name="sliders" size={16} color={t.colors.onSurface} />
          {filter !== "all" && <View style={styles.filterDot} />}
        </Pressable>
      </View>

      {/* Status chips (horizontal) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {FILTERS.slice(0, 5).map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${f.label} filter`}
              style={[styles.chip, { backgroundColor: active ? t.colors.onSurface : t.colors.surface, borderColor: active ? t.colors.onSurface : t.colors.border }]}
            >
              <Text style={{ ...t.type.button, fontSize: 11, color: active ? t.colors.surface : t.colors.onSurfaceSecondary }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0, 1, 2, 3, 4].map((i) => (<AdminSkeleton key={i} height={96} radius={14} />))}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(o) => o.id}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.colors.primary} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}
          ListEmptyComponent={
            <AdminEmpty
              icon="shopping-bag"
              title={q ? "No matches" : "No orders yet"}
              subtitle={q ? "Try a different search term." : "New orders will appear here."}
            />
          }
          renderItem={({ item: o }) => (
            <Pressable
              onPress={() => router.push(`/admin/order/${o.id}` as any)}
              accessibilityRole="button"
              accessibilityLabel={`Order ${o.id.slice(0, 8)}, ${o.shipping_name || "customer"}, ${INR(o.amount)}, status ${o.status}`}
              style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={[t.type.body, { color: t.colors.mutedText, fontFamily: "DMSansMedium" }]}>
                    #{o.id.slice(0, 8).toUpperCase()}
                  </Text>
                  <Text style={[t.type.bodySm, { color: t.colors.mutedText }]}>• {relDate(o.created_at)}</Text>
                </View>
                <Text style={[t.type.bodyLg, { color: t.colors.onSurface, fontFamily: "DMSansMedium", marginTop: 4 }]}>
                  {o.shipping_name || "Customer"}
                </Text>
                <Text style={[t.type.bodySm, { color: t.colors.onSurfaceSecondary, marginTop: 2 }]}>
                  {(o.items || []).length} items
                </Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                  <AdminBadge label={o.status === "paid" ? "Paid" : o.status} tone={STATUS_TONE[o.status] || "neutral"} />
                  {o.mock_payment && <AdminBadge label="Mock" tone="neutral" />}
                </View>
              </View>
              <View style={{ alignItems: "flex-end", justifyContent: "space-between" }}>
                <Text style={[t.type.h2, { color: t.colors.onSurface }]}>{INR(o.amount)}</Text>
                <Feather name="chevron-right" size={20} color={t.colors.mutedText} />
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Filter bottom sheet */}
      <Modal transparent visible={filterOpen} animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setFilterOpen(false)} accessibilityLabel="Close filter" />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={[t.type.h1, { color: t.colors.onSurface, marginBottom: 4 }]}>Filter by status</Text>
          <Text style={[t.type.body, { color: t.colors.onSurfaceSecondary, marginBottom: 16 }]}>
            Choose one to narrow the list
          </Text>
          <View style={{ gap: 8 }}>
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => { setFilter(f.key); setFilterOpen(false); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={f.label}
                  style={[styles.sheetRow, { backgroundColor: active ? t.colors.primarySoft : "transparent" }]}
                >
                  <Text style={[t.type.bodyLg, { color: t.colors.onSurface, flex: 1, fontFamily: active ? "DMSansBold" : "DMSans" }]}>
                    {f.label}
                  </Text>
                  {active && <Feather name="check" size={18} color={t.colors.primary} />}
                </Pressable>
              );
            })}
          </View>
          <View style={{ marginTop: 16 }}>
            <AdminButton label="Close" variant="secondary" fullWidth onPress={() => setFilterOpen(false)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function useStyles() {
  const t = useAdminTheme();
  return StyleSheet.create({
    header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
    searchRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 8 },
    searchBox: {
      flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: t.colors.surface, borderRadius: t.radius.md,
      borderWidth: 1, borderColor: t.colors.border, paddingHorizontal: 12, minHeight: 44,
    },
    filterBtn: {
      width: 44, height: 44, borderRadius: t.radius.md,
      backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border,
      alignItems: "center", justifyContent: "center",
    },
    filterDot: {
      position: "absolute", top: 8, right: 8,
      width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.primary,
    },
    chipsRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
    chip: { paddingHorizontal: 14, height: 32, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    card: {
      flexDirection: "row", gap: 12, padding: 16,
      backgroundColor: t.colors.surface, borderRadius: t.radius.lg,
      borderWidth: 1, borderColor: t.colors.border,
    },
    sheetBackdrop: { flex: 1, backgroundColor: t.colors.overlay },
    sheet: {
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 20, paddingBottom: 36, gap: 8,
    },
    sheetHandle: {
      alignSelf: "center", width: 40, height: 4, borderRadius: 2,
      backgroundColor: t.colors.border, marginBottom: 12,
    },
    sheetRow: {
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingVertical: 14, paddingHorizontal: 16, borderRadius: t.radius.md,
      minHeight: 56,
    },
  });
}
