import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing, type } from "@/src/theme";
import { api } from "@/src/api/client";

type OrderItem = { product_id: string; name: string; image: string; price: number; quantity: number };
type HistoryEntry = { status: string; at: string };
type Order = {
  id: string; status: string; amount: number; subtotal?: number; discount?: number;
  points_redeemed?: number;
  items: OrderItem[]; shipping_name: string; shipping_phone: string; shipping_address: string;
  history: HistoryEntry[]; created_at: string; payment_id?: string; mock_payment?: boolean;
};

const FLOW = ["created", "paid", "shipped", "delivered"] as const;
const LABEL: Record<string, { title: string; desc: string; icon: keyof typeof Feather.glyphMap }> = {
  created: { title: "Order Placed", desc: "We received your order", icon: "shopping-bag" },
  paid: { title: "Payment Confirmed", desc: "Thank you — we're prepping your order", icon: "check-circle" },
  shipped: { title: "On the Way", desc: "Your parcel is with the courier", icon: "truck" },
  delivered: { title: "Delivered", desc: "Enjoy your new pieces ✨", icon: "home" },
  cancelled: { title: "Cancelled", desc: "This order was cancelled", icon: "x-circle" },
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try { setOrder(await api<Order>(`/orders/${id}`, { auth: true })); }
    catch {}
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading || !order) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.onSurfaceSecondary} />
      </View>
    );
  }

  const historyByStatus = new Map(order.history?.map(h => [h.status, h.at]) || []);
  const currentIdx = FLOW.indexOf(order.status as any);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="back-btn">
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl }}>
        <View style={styles.summaryCard}>
          <Text style={styles.orderIdText}>#{order.id.slice(0, 8).toUpperCase()}</Text>
          <Text style={styles.orderDate}>Placed on {new Date(order.created_at).toLocaleDateString()}</Text>
          <Text style={styles.amountText}>₹{order.amount.toLocaleString("en-IN")}</Text>
        </View>

        {/* Timeline */}
        <View style={styles.timeline} testID="tracking-timeline">
          <Text style={styles.sectionTitle}>Tracking</Text>
          {order.status === "cancelled" ? (
            <View style={styles.stepRow}>
              <View style={[styles.dot, { backgroundColor: colors.error }]}>
                <Feather name="x-circle" size={14} color={colors.onSurfaceInverse} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>Order Cancelled</Text>
                <Text style={styles.stepDesc}>{LABEL.cancelled.desc}</Text>
                {historyByStatus.get("cancelled") ? <Text style={styles.stepDate}>{formatDate(historyByStatus.get("cancelled")!)}</Text> : null}
              </View>
            </View>
          ) : (
            FLOW.map((s, i) => {
              const done = i <= currentIdx;
              const active = i === currentIdx;
              const label = LABEL[s];
              const at = historyByStatus.get(s);
              const isLast = i === FLOW.length - 1;
              return (
                <View key={s} style={styles.stepRow} testID={`timeline-step-${s}`}>
                  <View style={styles.dotColumn}>
                    <View style={[
                      styles.dot,
                      done ? { backgroundColor: colors.brand } : { backgroundColor: colors.surfaceTertiary },
                      active && styles.dotActive,
                    ]}>
                      <Feather
                        name={done ? "check" : label.icon}
                        size={14}
                        color={done ? colors.onBrandPrimary : colors.mutedText}
                      />
                    </View>
                    {!isLast && <View style={[styles.connector, done && i < currentIdx && { backgroundColor: colors.brand }]} />}
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={[styles.stepTitle, !done && { color: colors.mutedText }]}>{label.title}</Text>
                    <Text style={styles.stepDesc}>{label.desc}</Text>
                    {at ? <Text style={styles.stepDate}>{formatDate(at)}</Text> : null}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Shipping */}
        <View style={styles.shipCard}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <Text style={styles.shipName}>{order.shipping_name}</Text>
          <Text style={styles.shipMeta}>{order.shipping_phone}</Text>
          <Text style={styles.shipMeta}>{order.shipping_address}</Text>
        </View>

        {/* Items */}
        <View>
          <Text style={styles.sectionTitle}>Items</Text>
          <View style={{ gap: spacing.md, marginTop: spacing.md }}>
            {order.items.map((it) => (
              <Pressable
                key={it.product_id}
                style={styles.itemRow}
                onPress={() => router.push(`/product/${it.product_id}`)}
                testID={`order-item-${it.product_id}`}
              >
                <Image source={{ uri: it.image }} style={styles.itemImg} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={2}>{it.name}</Text>
                  <Text style={styles.itemMeta}>Qty {it.quantity} · ₹{it.price.toLocaleString("en-IN")}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Payment summary */}
        <View style={styles.payBox}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <SummaryRow label="Subtotal" value={`₹${(order.subtotal ?? order.amount).toLocaleString("en-IN")}`} />
          {order.discount ? (
            <SummaryRow label={`Nest Points (${order.points_redeemed} pts)`} value={`-₹${order.discount.toLocaleString("en-IN")}`} />
          ) : null}
          <View style={styles.divider} />
          <SummaryRow label="Total Paid" value={`₹${order.amount.toLocaleString("en-IN")}`} big />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={styles.sumRow}>
      <Text style={{ fontFamily: big ? "CormorantGaramondBold" : "DMSans", fontSize: big ? 18 : 14, color: big ? colors.onSurface : colors.onSurfaceSecondary }}>{label}</Text>
      <Text style={{ fontFamily: big ? "CormorantGaramondBold" : "DMSansMedium", fontSize: big ? 20 : 14, color: colors.onSurface }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.xl, paddingBottom: spacing.md },
  headerTitle: { fontFamily: "CormorantGaramondBold", fontSize: 22, color: colors.onSurface },
  summaryCard: { backgroundColor: colors.accentLight, padding: spacing.xl, borderRadius: radius.lg, gap: spacing.xs },
  orderIdText: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: colors.brandDark },
  orderDate: { fontFamily: "DMSans", fontSize: 12, color: colors.onSurfaceSecondary, marginTop: 2 },
  amountText: { fontFamily: "CormorantGaramondBold", fontSize: 34, color: colors.onSurface, marginTop: spacing.sm },
  sectionTitle: { fontFamily: "CormorantGaramondBold", fontSize: 20, color: colors.onSurface, marginBottom: spacing.md },
  timeline: { paddingVertical: spacing.sm },
  stepRow: { flexDirection: "row", gap: spacing.md },
  dotColumn: { alignItems: "center", width: 32 },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  dotActive: { borderWidth: 3, borderColor: colors.brandLight },
  connector: { width: 2, flex: 1, backgroundColor: colors.surfaceTertiary, minHeight: 32 },
  stepContent: { flex: 1, paddingBottom: spacing.xl },
  stepTitle: { fontFamily: "CormorantGaramondBold", fontSize: 16, color: colors.onSurface },
  stepDesc: { fontFamily: "DMSans", fontSize: 13, color: colors.onSurfaceSecondary, marginTop: 2 },
  stepDate: { fontFamily: "DMSansMedium", fontSize: 11, color: colors.mutedText, marginTop: 4, letterSpacing: 0.5 },
  shipCard: { padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, gap: 2 },
  shipName: { fontFamily: "DMSansMedium", fontSize: 14, color: colors.onSurface },
  shipMeta: { fontFamily: "DMSans", fontSize: 13, color: colors.onSurfaceSecondary },
  itemRow: { flexDirection: "row", gap: spacing.md, alignItems: "center", padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  itemImg: { width: 60, height: 60, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  itemName: { fontFamily: "CormorantGaramond", fontSize: 16, color: colors.onSurface, lineHeight: 20 },
  itemMeta: { fontFamily: "DMSans", fontSize: 12, color: colors.mutedText, marginTop: 2 },
  payBox: { padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm },
});
