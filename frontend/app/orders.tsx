import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, radius, spacing, type } from "@/src/theme";
import { api } from "@/src/api/client";

type OrderItem = { product_id: string; name: string; image: string; price: number; quantity: number };
type Order = { id: string; status: string; amount: number; items: OrderItem[]; created_at: string };

const STATUS_LABEL: Record<string, string> = {
  created: "Pending Payment",
  paid: "Paid",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function Orders() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api<Order[]>("/orders", { auth: true });
      setOrders(data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>My Orders</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.onSurfaceSecondary} />
      ) : orders.length === 0 ? (
        <View style={styles.emptyWrap} testID="orders-empty">
          <Feather name="package" size={40} color={colors.mutedText} />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptyText}>Your future orders will appear here.</Text>
          <Pressable testID="orders-shop-btn" style={styles.cta} onPress={() => router.replace("/(tabs)")}>
            <Text style={styles.ctaText}>Start Shopping</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl }}>
          {orders.map((o) => (
            <Pressable
              key={o.id}
              style={styles.card}
              testID={`order-${o.id}`}
              onPress={() => router.push(`/order/${o.id}`)}
            >
              <View style={styles.orderTop}>
                <View>
                  <Text style={styles.metaSm}>ORDER #{o.id.slice(0, 8).toUpperCase()}</Text>
                  <Text style={styles.date}>{new Date(o.created_at).toLocaleDateString()}</Text>
                </View>
                <View style={[styles.badge, o.status === "paid" && styles.badgePaid, (o.status === "shipped" || o.status === "delivered") && styles.badgeShipped, o.status === "cancelled" && styles.badgeCancelled]}>
                  <Text style={[styles.badgeText, o.status === "paid" && styles.badgeTextPaid, (o.status === "shipped" || o.status === "delivered") && styles.badgeTextShipped, o.status === "cancelled" && styles.badgeTextCancelled]}>
                    {STATUS_LABEL[o.status] || o.status}
                  </Text>
                </View>
              </View>
              <View style={styles.itemsList}>
                {o.items.map((it) => (
                  <View key={it.product_id} style={styles.itemRow}>
                    <Image source={{ uri: it.image }} style={styles.itemImg} contentFit="cover" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName} numberOfLines={2}>{it.name}</Text>
                      <Text style={styles.itemMeta}>Qty {it.quantity} · ₹{it.price.toLocaleString("en-IN")}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalVal}>₹{o.amount.toLocaleString("en-IN")}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: spacing.xl, paddingBottom: spacing.md,
  },
  title: { fontFamily: "CormorantGaramondBold", fontSize: 24, color: colors.onSurface },
  card: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg,
    padding: spacing.lg, gap: spacing.md,
  },
  orderTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  metaSm: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 1.5, color: colors.mutedText },
  date: { fontFamily: "DMSans", fontSize: 13, color: colors.onSurfaceSecondary, marginTop: 2 },
  badge: { backgroundColor: colors.warning, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill },
  badgePaid: { backgroundColor: colors.success },
  badgeShipped: { backgroundColor: colors.info || "#B5C8D4" },
  badgeCancelled: { backgroundColor: colors.error },
  badgeText: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#3B2812" },
  badgeTextPaid: { color: "#1A3024" },
  badgeTextShipped: { color: "#1E2A32" },
  badgeTextCancelled: { color: "#3D1A19" },
  itemsList: { gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md },
  itemRow: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  itemImg: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  itemName: { fontFamily: "CormorantGaramond", fontSize: 16, color: colors.onSurface, lineHeight: 20 },
  itemMeta: { fontFamily: "DMSans", fontSize: 12, color: colors.mutedText, marginTop: 2 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md },
  totalLabel: { fontFamily: "DMSansMedium", fontSize: 13, color: colors.onSurfaceSecondary },
  totalVal: { fontFamily: "CormorantGaramondBold", fontSize: 20, color: colors.onSurface },
  emptyWrap: { alignItems: "center", padding: spacing.xxl, gap: spacing.md, marginTop: spacing.xl },
  emptyTitle: { ...type.displaySM, marginTop: spacing.md },
  emptyText: { ...type.body, textAlign: "center" },
  cta: { marginTop: spacing.md, backgroundColor: colors.onSurface, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, borderRadius: radius.pill },
  ctaText: { color: colors.onSurfaceInverse, fontFamily: "DMSansBold", letterSpacing: 1.5, textTransform: "uppercase", fontSize: 13 },
});
