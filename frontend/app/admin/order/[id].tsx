import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Modal, Alert, Platform, ActivityIndicator } from "react-native";
import Feather from "@react-native-vector-icons/feather";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAdminTheme } from "@/src/admin/theme";
import { AdminButton, AdminBadge, AdminCard, AdminSkeleton, AdminEmpty } from "@/src/admin/ui";
import { api } from "@/src/api/client";

const TIMELINE = [
  { key: "created", label: "Order placed", icon: "shopping-cart" },
  { key: "paid", label: "Payment received", icon: "credit-card" },
  { key: "processing", label: "Processing", icon: "package" },
  { key: "shipped", label: "Shipped", icon: "truck" },
  { key: "delivered", label: "Delivered", icon: "check-circle" },
];
const CANCELLED = { key: "cancelled", label: "Cancelled", icon: "x-circle" };

const STATUS_TONE: Record<string, any> = {
  paid: "success", processing: "info", shipped: "primary",
  delivered: "success", cancelled: "danger", refunded: "warning", created: "neutral",
};

// Backend allowed transitions
const ALLOWED_NEXT: Record<string, string[]> = {
  created: ["paid", "cancelled"],
  paid: ["processing", "cancelled", "refunded"],
  processing: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

function INR(n: number) { return "₹" + Math.round(n || 0).toLocaleString("en-IN"); }

export default function AdminOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useAdminTheme();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const styles = useStyles();

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const list = await api<any[]>("/admin/orders", { auth: true });
      const found = list.find((o) => o.id === id);
      setOrder(found || null);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const updateStatus = async (next: string) => {
    if (!order) return;
    const doIt = async () => {
      setUpdating(next);
      try {
        await api(`/admin/orders/${order.id}/status`, {
          method: "PUT",
          auth: true,
          body: { status: next },
        });
        await load();
        setActionsOpen(false);
      } catch (e: any) {
        if (Platform.OS === "web") {
          // @ts-ignore
          window.alert(e?.message || "Could not update status");
        } else {
          Alert.alert("Update failed", e?.message || "Could not update status");
        }
      } finally {
        setUpdating(null);
      }
    };
    // Destructive: confirm
    if (next === "cancelled" || next === "refunded") {
      const title = next === "cancelled" ? "Cancel order?" : "Issue refund?";
      const msg =
        next === "cancelled"
          ? "This cannot be undone. Any redeemed points will be returned to the customer."
          : "This cannot be undone. The customer will be notified.";
      if (Platform.OS === "web") {
        // @ts-ignore
        if (window.confirm(title + "\n\n" + msg)) doIt();
      } else {
        Alert.alert(title, msg, [
          { text: "Keep as is", style: "cancel" },
          { text: next === "cancelled" ? "Cancel Order" : "Refund", style: "destructive", onPress: doIt },
        ]);
      }
    } else {
      doIt();
    }
  };

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
        <View style={{ padding: 16, gap: 12 }}>
          <AdminSkeleton width={140} height={16} />
          <AdminSkeleton height={120} radius={14} />
          <AdminSkeleton height={200} radius={14} />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
        <TopBar title="Order" onBack={() => router.back()} />
        <AdminEmpty icon="alert-circle" title="Order not found" actionLabel="Back to orders" onAction={() => router.replace("/admin/orders")} />
      </SafeAreaView>
    );
  }

  const currentIdx = TIMELINE.findIndex((s) => s.key === order.status);
  const isTerminal = order.status === "cancelled" || order.status === "refunded";
  const nextOptions = ALLOWED_NEXT[order.status] || [];

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <TopBar
        title={`#${order.id.slice(0, 8).toUpperCase()}`}
        onBack={() => router.back()}
        rightIcon="more-vertical"
        rightAccessibility="More actions"
        onRight={() => setActionsOpen(true)}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 16 }}>
        {/* Summary */}
        <AdminCard>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View>
              <Text style={[t.type.label, { color: t.colors.mutedText }]}>Order total</Text>
              <Text style={[t.type.displayLG, { color: t.colors.onSurface }]}>{INR(order.amount)}</Text>
              <Text style={[t.type.bodySm, { color: t.colors.mutedText, marginTop: 4 }]}>
                {new Date(order.created_at).toLocaleString("en-IN")}
              </Text>
            </View>
            <AdminBadge label={order.status === "paid" ? "Paid" : order.status} tone={STATUS_TONE[order.status] || "neutral"} />
          </View>
        </AdminCard>

        {/* Timeline */}
        <AdminCard>
          <Text style={[t.type.h3, { color: t.colors.mutedText, marginBottom: 14 }]}>ORDER STATUS</Text>
          {isTerminal ? (
            <View style={styles.tlItem}>
              <View style={[styles.tlDot, { backgroundColor: t.colors.danger }]}>
                <Feather name={CANCELLED.icon as any} size={12} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[t.type.bodyLg, { color: t.colors.onSurface, fontFamily: "DMSansMedium" }]}>
                  {order.status === "cancelled" ? "Cancelled" : "Refunded"}
                </Text>
                <Text style={[t.type.bodySm, { color: t.colors.mutedText, marginTop: 2 }]}>
                  Final status
                </Text>
              </View>
            </View>
          ) : (
            TIMELINE.map((s, idx) => {
              const done = idx <= currentIdx;
              const active = idx === currentIdx;
              const historyEvt = (order.history || []).find((h: any) => h.status === s.key);
              return (
                <View key={s.key} style={styles.tlItem}>
                  <View style={{ alignItems: "center" }}>
                    <View style={[styles.tlDot, { backgroundColor: done ? t.colors.primary : t.colors.surfaceMuted, borderWidth: active ? 3 : 0, borderColor: t.colors.primarySoft }]}>
                      {done ? <Feather name={s.icon as any} size={12} color={done ? "#fff" : t.colors.mutedText} /> : null}
                    </View>
                    {idx < TIMELINE.length - 1 && <View style={[styles.tlLine, { backgroundColor: idx < currentIdx ? t.colors.primary : t.colors.border }]} />}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 16 }}>
                    <Text style={[t.type.bodyLg, { color: done ? t.colors.onSurface : t.colors.mutedText, fontFamily: done ? "DMSansMedium" : "DMSans" }]}>
                      {s.label}
                    </Text>
                    {historyEvt?.at && (
                      <Text style={[t.type.bodySm, { color: t.colors.mutedText, marginTop: 2 }]}>
                        {new Date(historyEvt.at).toLocaleString("en-IN")}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </AdminCard>

        {/* Customer */}
        <AdminCard>
          <Text style={[t.type.h3, { color: t.colors.mutedText, marginBottom: 10 }]}>CUSTOMER</Text>
          <Text style={[t.type.bodyLg, { color: t.colors.onSurface, fontFamily: "DMSansMedium" }]}>{order.shipping_name || "—"}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
            <Feather name="phone" size={14} color={t.colors.mutedText} />
            <Text style={[t.type.body, { color: t.colors.onSurfaceSecondary }]}>{order.shipping_phone || "—"}</Text>
          </View>
        </AdminCard>

        {/* Delivery */}
        <AdminCard>
          <Text style={[t.type.h3, { color: t.colors.mutedText, marginBottom: 10 }]}>DELIVERY</Text>
          <Text style={[t.type.body, { color: t.colors.onSurface, lineHeight: 22 }]}>{order.shipping_address || "—"}</Text>
        </AdminCard>

        {/* Items */}
        <AdminCard>
          <Text style={[t.type.h3, { color: t.colors.mutedText, marginBottom: 12 }]}>ITEMS ({(order.items || []).length})</Text>
          <View style={{ gap: 12 }}>
            {(order.items || []).map((it: any, idx: number) => (
              <View key={idx} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <View style={styles.itemImgWrap}>
                  {it.image ? (
                    <Image source={{ uri: it.image }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : (
                    <Feather name="package" size={20} color={t.colors.mutedText} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[t.type.bodyLg, { color: t.colors.onSurface, fontFamily: "DMSansMedium" }]} numberOfLines={2}>
                    {it.name}
                  </Text>
                  <Text style={[t.type.bodySm, { color: t.colors.mutedText, marginTop: 2 }]}>
                    Qty {it.quantity} × {INR(it.price)}
                  </Text>
                </View>
                <Text style={[t.type.h3, { color: t.colors.onSurface }]}>
                  {INR(it.line_total || it.price * it.quantity)}
                </Text>
              </View>
            ))}
          </View>
        </AdminCard>

        {/* Payment */}
        <AdminCard>
          <Text style={[t.type.h3, { color: t.colors.mutedText, marginBottom: 12 }]}>PAYMENT</Text>
          <SumRow label="Subtotal" value={INR(order.subtotal || 0)} />
          {order.coupon_discount ? <SumRow label={`Coupon (${order.coupon?.code || ""})`} value={`- ${INR(order.coupon_discount)}`} /> : null}
          {order.points_discount ? <SumRow label={`Nest Points (${order.points_redeemed})`} value={`- ${INR(order.points_discount)}`} /> : null}
          {order.gift_wrap ? <SumRow label="Gift wrap" value={INR(order.gift_wrap_fee || 49)} /> : null}
          <View style={{ height: 1, backgroundColor: t.colors.divider, marginVertical: 8 }} />
          <SumRow label="Total" value={INR(order.amount)} bold />
          {order.mock_payment ? (
            <View style={{ marginTop: 10 }}><AdminBadge label="Mock payment" tone="warning" icon="alert-triangle" /></View>
          ) : null}
        </AdminCard>
      </ScrollView>

      {/* Sticky action bar */}
      {!isTerminal && nextOptions.length > 0 ? (
        <View style={styles.stickyBar}>
          <AdminButton
            label={
              nextOptions[0] === "paid" ? "Mark Paid" :
              nextOptions[0] === "processing" ? "Start Processing" :
              nextOptions[0] === "shipped" ? "Mark Shipped" :
              nextOptions[0] === "delivered" ? "Mark Delivered" :
              "Update"
            }
            icon="check"
            fullWidth
            onPress={() => updateStatus(nextOptions[0])}
            loading={updating === nextOptions[0]}
            accessibilityLabel={`Update order to ${nextOptions[0]}`}
          />
        </View>
      ) : null}

      {/* Actions bottom sheet */}
      <Modal transparent visible={actionsOpen} animationType="slide" onRequestClose={() => setActionsOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setActionsOpen(false)} accessibilityLabel="Close actions" />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={[t.type.h1, { color: t.colors.onSurface, marginBottom: 16 }]}>Order actions</Text>
          {nextOptions.map((next) => {
            const isDest = next === "cancelled" || next === "refunded";
            return (
              <Pressable
                key={next}
                onPress={() => updateStatus(next)}
                disabled={!!updating}
                accessibilityRole="button"
                accessibilityLabel={`Change status to ${next}`}
                style={[styles.actionRow, isDest && { backgroundColor: t.colors.dangerSoft }]}
              >
                <Feather name={next === "cancelled" ? "x-circle" : next === "refunded" ? "rotate-ccw" : "arrow-right"} size={18} color={isDest ? t.colors.danger : t.colors.onSurface} />
                <Text style={[t.type.bodyLg, { color: isDest ? t.colors.danger : t.colors.onSurface, fontFamily: "DMSansMedium", flex: 1, textTransform: "capitalize" }]}>
                  {next === "cancelled" ? "Cancel order" : next === "refunded" ? "Issue refund" : `Mark as ${next}`}
                </Text>
                {updating === next && <ActivityIndicator size="small" color={t.colors.primary} />}
              </Pressable>
            );
          })}
          <View style={{ marginTop: 12 }}>
            <AdminButton label="Close" variant="secondary" fullWidth onPress={() => setActionsOpen(false)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SumRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  const t = useAdminTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 }}>
      <Text style={[t.type.body, { color: bold ? t.colors.onSurface : t.colors.onSurfaceSecondary, fontFamily: bold ? "DMSansBold" : "DMSans" }]}>{label}</Text>
      <Text style={[t.type.body, { color: t.colors.onSurface, fontFamily: bold ? "DMSansBold" : "DMSansMedium", fontSize: bold ? 16 : 14 }]}>{value}</Text>
    </View>
  );
}

function TopBar({ title, onBack, rightIcon, rightAccessibility, onRight }: { title: string; onBack: () => void; rightIcon?: string; rightAccessibility?: string; onRight?: () => void }) {
  const t = useAdminTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, paddingHorizontal: 8, minHeight: 56 }}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={{ padding: 8, minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}>
        <Feather name="chevron-left" size={22} color={t.colors.onSurface} />
      </Pressable>
      <Text style={[t.type.h2, { color: t.colors.onSurface }]}>{title}</Text>
      {rightIcon ? (
        <Pressable onPress={onRight} accessibilityRole="button" accessibilityLabel={rightAccessibility || "More"} hitSlop={12} style={{ padding: 8, minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}>
          <Feather name={rightIcon as any} size={20} color={t.colors.onSurface} />
        </Pressable>
      ) : <View style={{ width: 44 }} />}
    </View>
  );
}

function useStyles() {
  const t = useAdminTheme();
  return StyleSheet.create({
    tlItem: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
    tlDot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    tlLine: { width: 2, flex: 1, minHeight: 20, marginVertical: 4 },
    itemImgWrap: { width: 56, height: 56, borderRadius: t.radius.md, overflow: "hidden", backgroundColor: t.colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
    stickyBar: {
      position: "absolute", left: 0, right: 0, bottom: 0,
      padding: 16, backgroundColor: t.colors.surface,
      borderTopWidth: 1, borderTopColor: t.colors.border,
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
    actionRow: {
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingVertical: 14, paddingHorizontal: 14, borderRadius: t.radius.md, minHeight: 56,
    },
  });
}
