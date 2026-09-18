import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import Feather from "@react-native-vector-icons/feather";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, radius, spacing, type } from "@/src/theme";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

type OrderItem = { product_id: string; name: string; image: string; price: number; quantity: number };
type Order = {
  id: string; user_id: string; status: string; amount: number; items: OrderItem[];
  shipping_name: string; shipping_phone: string; shipping_address: string; created_at: string;
};

const STATUS_FLOW = ["created", "paid", "shipped", "delivered", "cancelled"] as const;
const STATUS_LABEL: Record<string, string> = {
  created: "Pending",
  paid: "Paid",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function AdminOrders() {
  const router = useRouter();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<Order[]>("/admin/orders", { auth: true });
      setOrders(data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (orderId: string, status: string) => {
    setUpdating(orderId);
    try {
      const updated = await api<Order>(`/admin/orders/${orderId}/status`, {
        method: "PUT",
        auth: true,
        body: { status },
      });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    } catch {}
    finally { setUpdating(null); }
  };

  if (!user || user.role !== "admin") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={styles.gate}>
          <Feather name="lock" size={40} color={colors.mutedText} />
          <Text style={styles.gateTitle}>Admin access required</Text>
          <Pressable style={styles.cta} onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.ctaText}>Sign In</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="back-btn">
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Orders</Text>
        <View style={{ width: 22 }} />
      </View>
      <Text style={styles.eyebrow}>{orders.length} TOTAL</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.onSurfaceSecondary} />
      ) : orders.length === 0 ? (
        <View style={styles.emptyWrap} testID="admin-orders-empty">
          <Feather name="package" size={40} color={colors.mutedText} />
          <Text style={styles.emptyTitle}>No orders yet</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl }}>
          {orders.map((o) => (
            <View key={o.id} style={styles.card} testID={`admin-order-${o.id}`}>
              <View style={styles.top}>
                <View>
                  <Text style={styles.orderId}>#{o.id.slice(0, 8).toUpperCase()}</Text>
                  <Text style={styles.date}>{new Date(o.created_at).toLocaleString()}</Text>
                </View>
                <Text style={styles.amount}>₹{o.amount.toLocaleString("en-IN")}</Text>
              </View>

              <View style={styles.ship}>
                <Text style={styles.shipName}>{o.shipping_name}</Text>
                <Text style={styles.shipMeta}>{o.shipping_phone}</Text>
                <Text style={styles.shipMeta} numberOfLines={2}>{o.shipping_address}</Text>
              </View>

              <View style={styles.itemsBox}>
                {o.items.map((it) => (
                  <View key={it.product_id} style={styles.itemRow}>
                    <Image source={{ uri: it.image }} style={styles.itemImg} contentFit="cover" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                      <Text style={styles.itemMeta}>Qty {it.quantity} · ₹{it.price.toLocaleString("en-IN")}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <Text style={styles.statusLabel}>STATUS</Text>
              <View style={styles.statusRow}>
                {STATUS_FLOW.map((s) => {
                  const on = o.status === s;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setStatus(o.id, s)}
                      disabled={updating === o.id}
                      style={[styles.statusChip, on && styles.statusChipOn]}
                      testID={`admin-status-${o.id}-${s}`}
                    >
                      <Text style={[styles.statusText, on && styles.statusTextOn]}>{STATUS_LABEL[s]}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {updating === o.id && <ActivityIndicator style={{ marginTop: spacing.sm }} color={colors.mutedText} size="small" />}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.xl, paddingBottom: spacing.md },
  title: { fontFamily: "CormorantGaramondBold", fontSize: 24, color: colors.onSurface },
  eyebrow: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: colors.mutedText, paddingHorizontal: spacing.xl },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  orderId: { fontFamily: "DMSansBold", fontSize: 13, letterSpacing: 1, color: colors.onSurface },
  date: { fontFamily: "DMSans", fontSize: 11, color: colors.mutedText, marginTop: 2 },
  amount: { fontFamily: "CormorantGaramondBold", fontSize: 22, color: colors.onSurface },
  ship: { padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, gap: 2 },
  shipName: { fontFamily: "DMSansMedium", fontSize: 13, color: colors.onSurface },
  shipMeta: { fontFamily: "DMSans", fontSize: 12, color: colors.onSurfaceSecondary },
  itemsBox: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md },
  itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  itemImg: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  itemName: { fontFamily: "DMSansMedium", fontSize: 13, color: colors.onSurface },
  itemMeta: { fontFamily: "DMSans", fontSize: 11, color: colors.mutedText },
  statusLabel: { fontFamily: "DMSansMedium", fontSize: 10, letterSpacing: 2, color: colors.mutedText, marginTop: spacing.sm },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statusChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.brandTertiary },
  statusChipOn: { backgroundColor: colors.onSurface },
  statusText: { fontFamily: "DMSans", fontSize: 12, color: colors.onSurface },
  statusTextOn: { color: colors.onSurfaceInverse },
  emptyWrap: { alignItems: "center", padding: spacing.xxl, gap: spacing.md, marginTop: spacing.xl },
  emptyTitle: { ...type.displaySM },
  gate: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl, gap: spacing.md },
  gateTitle: { ...type.displaySM, marginTop: spacing.md },
  cta: { backgroundColor: colors.onSurface, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, borderRadius: radius.pill },
  ctaText: { color: colors.onSurfaceInverse, fontFamily: "DMSansBold", letterSpacing: 1.5, textTransform: "uppercase", fontSize: 13 },
});
