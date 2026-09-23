import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet } from "react-native";
import Feather from "@react-native-vector-icons/feather";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useAdminTheme } from "@/src/admin/theme";
import { AdminCard, AdminBadge, AdminSectionHeader, AdminSkeleton, AdminEmpty } from "@/src/admin/ui";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

type Analytics = {
  totals: { users: number; products: number; orders: number; paid_orders: number; revenue: number };
  orders_by_status: Record<string, { count: number; revenue: number }>;
  top_products: { product_id: string; name: string; image: string; units_sold: number; revenue: number }[];
  low_stock: { id: string; name: string; stock: number; image: string }[];
  recent_orders: any[];
  revenue_trend_30d: { date: string; revenue: number; orders: number }[];
};

const RANGES = [
  { key: "7d", label: "7 Days", days: 7 },
  { key: "30d", label: "30 Days", days: 30 },
  { key: "today", label: "Today", days: 1 },
  { key: "all", label: "All", days: 365 },
];

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral" | "primary"> = {
  paid: "success",
  processing: "info",
  shipped: "primary",
  delivered: "success",
  cancelled: "danger",
  refunded: "warning",
  created: "neutral",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function INR(n: number) {
  return "₹" + Math.round(n || 0).toLocaleString("en-IN");
}

function computeRange(days: number, trend: Analytics["revenue_trend_30d"]) {
  if (!trend?.length) return { total: 0, orders: 0 };
  const cut = trend.slice(-days);
  return {
    total: cut.reduce((s, d) => s + d.revenue, 0),
    orders: cut.reduce((s, d) => s + d.orders, 0),
  };
}

export default function AdminDashboard() {
  const t = useAdminTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [range, setRange] = useState("30d");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErr(null);
      const a = await api<Analytics>("/admin/analytics", { auth: true });
      setData(a);
    } catch (e: any) {
      setErr(e?.message || "Could not load analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const days = RANGES.find((r) => r.key === range)?.days || 30;
  const kpi = useMemo(() => {
    if (!data) return null;
    const window = computeRange(days, data.revenue_trend_30d);
    const prevWindow = computeRange(days, data.revenue_trend_30d.slice(0, -days));
    const pct = (curr: number, prev: number) => {
      if (!prev) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };
    const aov = window.orders ? window.total / window.orders : 0;
    const prevAov = prevWindow.orders ? prevWindow.total / prevWindow.orders : 0;
    return {
      revenue: { value: window.total, change: pct(window.total, prevWindow.total) },
      orders: { value: window.orders, change: pct(window.orders, prevWindow.orders) },
      customers: { value: data.totals.users, change: 0 },
      aov: { value: aov, change: pct(aov, prevAov) },
    };
  }, [data, days]);

  const styles = useStyles();

  if (loading) return <DashboardSkeleton />;

  if (err) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
        <AdminEmpty
          icon="alert-triangle"
          title="Couldn't load dashboard"
          subtitle={err}
          actionLabel="Try again"
          onAction={() => {
            setLoading(true);
            load();
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={t.colors.primary}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[t.type.label, { color: t.colors.mutedText }]}>{greeting()}</Text>
            <Text style={[t.type.displayLG, { color: t.colors.onSurface }]}>{user?.name?.split(" ")[0] || "Admin"}</Text>
            <Text style={[t.type.body, { color: t.colors.onSurfaceSecondary, marginTop: 2 }]}>
              Here&apos;s what&apos;s happening today.
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              onPress={() => {}}
              style={styles.iconBtn}
            >
              <Feather name="bell" size={18} color={t.colors.onSurface} />
              <View style={styles.notifDot} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Profile"
              onPress={() => router.push("/admin/more")}
              style={styles.avatar}
            >
              <Text style={{ ...t.type.h3, color: t.colors.primary }}>
                {(user?.name || "A").slice(0, 1).toUpperCase()}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Date range chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 16 }}
        >
          {RANGES.map((r) => {
            const active = range === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => setRange(r.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={r.label}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? t.colors.onSurface : t.colors.surface,
                    borderColor: active ? t.colors.onSurface : t.colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    ...t.type.button,
                    fontSize: 11,
                    color: active ? t.colors.surface : t.colors.onSurfaceSecondary,
                  }}
                >
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* KPI horizontal scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 20 }}
        >
          <KpiCard label="Total Sales" value={INR(kpi?.revenue.value || 0)} change={kpi?.revenue.change || 0} icon="trending-up" />
          <KpiCard label="Orders" value={String(kpi?.orders.value ?? 0)} change={kpi?.orders.change || 0} icon="shopping-bag" />
          <KpiCard label="Customers" value={String(kpi?.customers.value ?? 0)} change={kpi?.customers.change || 0} icon="users" />
          <KpiCard label="Avg. Order" value={INR(kpi?.aov.value || 0)} change={kpi?.aov.change || 0} icon="bar-chart-2" />
        </ScrollView>

        {/* Revenue chart */}
        <View style={{ paddingHorizontal: 16 }}>
          <AdminCard>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View>
                <Text style={[t.type.label, { color: t.colors.mutedText }]}>Sales Overview</Text>
                <Text style={[t.type.h1, { color: t.colors.onSurface, marginTop: 2 }]}>
                  {INR(kpi?.revenue.value || 0)}
                </Text>
              </View>
              <AdminBadge
                label={`${(kpi?.revenue.change || 0) >= 0 ? "+" : ""}${kpi?.revenue.change || 0}%`}
                tone={(kpi?.revenue.change || 0) >= 0 ? "success" : "danger"}
                icon={(kpi?.revenue.change || 0) >= 0 ? "arrow-up-right" : "arrow-down-right"}
              />
            </View>
            <SalesChart data={data?.revenue_trend_30d?.slice(-days) || []} />
          </AdminCard>
        </View>

        {/* Recent orders */}
        <View style={{ marginTop: 28 }}>
          <AdminSectionHeader
            title="Recent Orders"
            action="View all"
            onActionPress={() => router.push("/admin/orders")}
            actionAccessibilityLabel="View all orders"
          />
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            {(data?.recent_orders || []).slice(0, 5).map((o) => (
              <Pressable
                key={o.id}
                onPress={() => router.push(`/admin/order/${o.id}` as any)}
                accessibilityRole="button"
                accessibilityLabel={`Order ${o.id.slice(0, 8)}, ${o.status}, ${INR(o.amount)}`}
                style={({ pressed }) => [styles.orderRow, { opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[t.type.body, { color: t.colors.onSurfaceSecondary }]}>
                    #{o.id.slice(0, 8).toUpperCase()}
                  </Text>
                  <Text style={[t.type.bodyLg, { color: t.colors.onSurface, fontFamily: "DMSansMedium", marginTop: 2 }]}>
                    {o.shipping_name || "Customer"}
                  </Text>
                  <Text style={[t.type.bodySm, { color: t.colors.mutedText, marginTop: 2 }]}>
                    {(o.items || []).length} items • {new Date(o.created_at).toLocaleDateString("en-IN")}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <Text style={[t.type.h3, { color: t.colors.onSurface }]}>{INR(o.amount)}</Text>
                  <AdminBadge label={o.status} tone={STATUS_TONE[o.status] || "neutral"} />
                </View>
              </Pressable>
            ))}
            {!data?.recent_orders?.length && (
              <AdminEmpty icon="shopping-bag" title="No orders yet" subtitle="New orders will appear here." />
            )}
          </View>
        </View>

        {/* Top products */}
        {!!data?.top_products?.length && (
          <View style={{ marginTop: 28 }}>
            <AdminSectionHeader title="Top Products" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
              {data.top_products.map((p) => (
                <View key={p.product_id} style={styles.topProdCard}>
                  <View style={styles.topProdImgWrap}>
                    {p.image ? (
                      <Image source={{ uri: p.image }} style={styles.topProdImg} contentFit="cover" />
                    ) : (
                      <View style={[styles.topProdImg, { alignItems: "center", justifyContent: "center", backgroundColor: t.colors.surfaceAlt }]}>
                        <Feather name="package" size={20} color={t.colors.mutedText} />
                      </View>
                    )}
                  </View>
                  <Text numberOfLines={2} style={[t.type.body, { color: t.colors.onSurface, fontFamily: "DMSansMedium" }]}>
                    {p.name}
                  </Text>
                  <View style={{ marginTop: 6 }}>
                    <Text style={[t.type.bodySm, { color: t.colors.mutedText }]}>{p.units_sold} sold</Text>
                    <Text style={[t.type.h3, { color: t.colors.primary, marginTop: 2 }]}>{INR(p.revenue)}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Low stock */}
        {!!data?.low_stock?.length && (
          <View style={{ marginTop: 28 }}>
            <AdminSectionHeader title="Low Stock" />
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              {data.low_stock.slice(0, 5).map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/admin/product/${p.id}` as any)}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.name}, low stock, ${p.stock} units remaining`}
                  style={({ pressed }) => [styles.lowStockRow, { opacity: pressed ? 0.85 : 1 }]}
                >
                  <View style={styles.lowStockImg}>
                    {p.image ? (
                      <Image source={{ uri: p.image }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    ) : (
                      <Feather name="package" size={16} color={t.colors.mutedText} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[t.type.bodyLg, { color: t.colors.onSurface, fontFamily: "DMSansMedium" }]}>
                      {p.name}
                    </Text>
                    <Text style={[t.type.bodySm, { color: t.colors.mutedText, marginTop: 2 }]}>SKU · {p.id.slice(0, 8).toUpperCase()}</Text>
                  </View>
                  <AdminBadge label={`${p.stock} left`} tone={p.stock === 0 ? "danger" : "warning"} icon="alert-triangle" />
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiCard({ label, value, change, icon }: { label: string; value: string; change: number; icon: string }) {
  const t = useAdminTheme();
  const positive = change >= 0;
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${label}: ${value}, ${positive ? "up" : "down"} ${Math.abs(change)} percent`}
      style={{
        width: 180,
        padding: t.spacing.lg,
        backgroundColor: t.colors.surface,
        borderRadius: t.radius.lg,
        borderWidth: 1,
        borderColor: t.colors.border,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
          <Feather name={icon as any} size={14} color={t.colors.primary} />
        </View>
        <AdminBadge
          tone={positive ? "success" : "danger"}
          label={`${positive ? "+" : ""}${change}%`}
          icon={positive ? "arrow-up-right" : "arrow-down-right"}
        />
      </View>
      <View>
        <Text style={[t.type.label, { color: t.colors.mutedText }]}>{label}</Text>
        <Text style={[t.type.metric, { color: t.colors.onSurface, marginTop: 2 }]}>{value}</Text>
      </View>
    </View>
  );
}

function SalesChart({ data }: { data: { date: string; revenue: number; orders: number }[] }) {
  const t = useAdminTheme();
  const max = Math.max(1, ...data.map((d) => d.revenue));
  if (!data.length) {
    return (
      <View style={{ height: 140, alignItems: "center", justifyContent: "center" }}>
        <Text style={[t.type.body, { color: t.colors.mutedText }]}>No data for this period</Text>
      </View>
    );
  }
  return (
    <View style={{ height: 140, flexDirection: "row", alignItems: "flex-end", gap: 4, marginTop: 20, paddingHorizontal: 4 }}>
      {data.map((d) => {
        const h = Math.max(4, (d.revenue / max) * 120);
        return (
          <View key={d.date} style={{ flex: 1, alignItems: "center", gap: 4 }}>
            <View
              accessibilityLabel={`${d.date}: ₹${d.revenue.toFixed(0)}, ${d.orders} orders`}
              style={{
                width: "100%",
                height: h,
                backgroundColor: t.colors.primary,
                borderRadius: 4,
                opacity: 0.85,
              }}
            />
          </View>
        );
      })}
    </View>
  );
}

function DashboardSkeleton() {
  const t = useAdminTheme();
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <View style={{ padding: 16, gap: 20 }}>
        <View>
          <AdminSkeleton width={100} height={12} />
          <AdminSkeleton width={200} height={26} style={{ marginTop: 8 }} />
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <AdminSkeleton width={180} height={130} radius={14} />
          <AdminSkeleton width={180} height={130} radius={14} />
        </View>
        <AdminSkeleton height={200} radius={14} />
        <View style={{ gap: 10 }}>
          <AdminSkeleton height={72} radius={14} />
          <AdminSkeleton height={72} radius={14} />
          <AdminSkeleton height={72} radius={14} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function useStyles() {
  const t = useAdminTheme();
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      gap: 12,
    },
    headerText: { flex: 1, gap: 2 },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    notifDot: {
      position: "absolute",
      top: 10,
      right: 12,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.colors.danger,
      borderWidth: 2,
      borderColor: t.colors.surface,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    chip: {
      paddingHorizontal: 14,
      height: 32,
      minHeight: 32,
      borderRadius: 999,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    orderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    topProdCard: {
      width: 160,
      padding: 12,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    topProdImgWrap: { width: "100%", aspectRatio: 1, borderRadius: t.radius.md, overflow: "hidden", marginBottom: 10, backgroundColor: t.colors.surfaceAlt },
    topProdImg: { width: "100%", height: "100%" },
    lowStockRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.lg,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    lowStockImg: {
      width: 44,
      height: 44,
      borderRadius: t.radius.md,
      overflow: "hidden",
      backgroundColor: t.colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
