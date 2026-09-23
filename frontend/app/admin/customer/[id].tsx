import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Linking, Platform } from "react-native";
import Feather from "@react-native-vector-icons/feather";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAdminTheme } from "@/src/admin/theme";
import { AdminCard, AdminBadge, AdminEmpty, AdminSkeleton, AdminButton } from "@/src/admin/ui";
import { api } from "@/src/api/client";

const STATUS_TONE: Record<string, any> = {
  paid: "success", processing: "info", shipped: "primary",
  delivered: "success", cancelled: "danger", refunded: "warning", created: "neutral",
};

function INR(n: number) { return "₹" + Math.round(n || 0).toLocaleString("en-IN"); }
function initials(name: string) {
  const p = (name || "?").trim().split(/\s+/);
  return (p[0]?.[0] || "?").toUpperCase() + (p[1]?.[0] || "").toUpperCase();
}

type Detail = {
  user: any;
  orders: any[];
  orders_count: number;
  total_spent: number;
  points_balance: number;
};

export default function AdminCustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useAdminTheme();
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const styles = useStyles();

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const d = await api<Detail>(`/admin/customers/${id}`, { auth: true });
      setData(d);
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const callPhone = async () => {
    const num = data?.user?.mobile;
    if (!num) return;
    const url = `tel:${num}`;
    if (Platform.OS === "web") { /* @ts-ignore */ window.alert(`Call ${num}`); return; }
    const ok = await Linking.canOpenURL(url);
    if (ok) Linking.openURL(url);
  };
  const emailUser = async () => {
    const em = data?.user?.email;
    if (!em) return;
    const url = `mailto:${em}`;
    if (Platform.OS === "web") { /* @ts-ignore */ window.location.href = url; return; }
    const ok = await Linking.canOpenURL(url);
    if (ok) Linking.openURL(url);
  };

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
        <View style={{ padding: 16, gap: 12 }}>
          <AdminSkeleton width={100} height={16} />
          <AdminSkeleton height={130} radius={14} />
          <AdminSkeleton height={80} radius={14} />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
        <TopBar title="Customer" onBack={() => router.back()} />
        <AdminEmpty icon="user-x" title="Customer not found" />
      </SafeAreaView>
    );
  }

  const u = data.user;
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <TopBar title="Customer" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}>
        {/* Profile */}
        <AdminCard>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={styles.avatar}>
              <Text style={[t.type.displayMD, { color: t.colors.primary }]}>{initials(u.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[t.type.h1, { color: t.colors.onSurface }]}>{u.name}</Text>
              <Text style={[t.type.bodySm, { color: t.colors.mutedText, marginTop: 2 }]}>
                Joined {new Date(u.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <View style={{ flex: 1 }}>
              <AdminButton label="Call" variant="secondary" icon="phone" fullWidth onPress={callPhone} />
            </View>
            <View style={{ flex: 1 }}>
              <AdminButton label="Email" variant="secondary" icon="mail" fullWidth onPress={emailUser} />
            </View>
          </View>
        </AdminCard>

        {/* Contact */}
        <AdminCard>
          <Text style={[t.type.h3, { color: t.colors.mutedText, marginBottom: 10 }]}>CONTACT</Text>
          <ContactRow icon="mail" label="Email" value={u.email} />
          <View style={styles.divider} />
          <ContactRow icon="phone" label="Mobile" value={u.mobile || "—"} />
        </AdminCard>

        {/* Stats */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard label="Orders" value={String(data.orders_count)} icon="shopping-bag" />
          <StatCard label="Total Spent" value={INR(data.total_spent)} icon="trending-up" />
          <StatCard label="Nest Points" value={String(data.points_balance)} icon="star" />
        </View>

        {/* Orders */}
        <AdminCard padded={false}>
          <View style={{ padding: 16, paddingBottom: 8 }}>
            <Text style={[t.type.h3, { color: t.colors.mutedText }]}>ORDERS ({data.orders.length})</Text>
          </View>
          {data.orders.length === 0 ? (
            <AdminEmpty icon="shopping-bag" title="No orders yet" />
          ) : (
            data.orders.map((o, idx) => (
              <Pressable
                key={o.id}
                onPress={() => router.push(`/admin/order/${o.id}` as any)}
                accessibilityRole="button"
                accessibilityLabel={`Order ${o.id.slice(0, 8)}, ${INR(o.amount)}`}
                style={({ pressed }) => [styles.orderRow, { opacity: pressed ? 0.85 : 1, borderTopWidth: idx === 0 ? 1 : 0, borderTopColor: t.colors.divider }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[t.type.body, { color: t.colors.mutedText, fontFamily: "DMSansMedium" }]}>#{o.id.slice(0, 8).toUpperCase()}</Text>
                  <Text style={[t.type.bodySm, { color: t.colors.mutedText, marginTop: 2 }]}>
                    {(o.items || []).length} items • {new Date(o.created_at).toLocaleDateString("en-IN")}
                  </Text>
                  <View style={{ marginTop: 6 }}>
                    <AdminBadge label={o.status === "paid" ? "Paid" : o.status} tone={STATUS_TONE[o.status] || "neutral"} />
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[t.type.h3, { color: t.colors.onSurface }]}>{INR(o.amount)}</Text>
                  <Feather name="chevron-right" size={16} color={t.colors.mutedText} style={{ marginTop: 8 }} />
                </View>
              </Pressable>
            ))
          )}
        </AdminCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  const t = useAdminTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", padding: 8, minHeight: 56 }}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={{ padding: 8, minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}>
        <Feather name="chevron-left" size={22} color={t.colors.onSurface} />
      </Pressable>
      <Text style={[t.type.h2, { color: t.colors.onSurface, marginLeft: 4 }]}>{title}</Text>
    </View>
  );
}

function ContactRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  const t = useAdminTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }}>
      <Feather name={icon as any} size={16} color={t.colors.mutedText} />
      <View style={{ flex: 1 }}>
        <Text style={[t.type.bodySm, { color: t.colors.mutedText }]}>{label}</Text>
        <Text style={[t.type.body, { color: t.colors.onSurface, fontFamily: "DMSansMedium" }]}>{value}</Text>
      </View>
    </View>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  const t = useAdminTheme();
  return (
    <View style={{ flex: 1, padding: 12, backgroundColor: t.colors.surface, borderRadius: t.radius.lg, borderWidth: 1, borderColor: t.colors.border, gap: 6 }}>
      <Feather name={icon as any} size={14} color={t.colors.primary} />
      <Text style={[t.type.h3, { color: t.colors.onSurface }]}>{value}</Text>
      <Text style={[t.type.bodySm, { color: t.colors.mutedText }]}>{label}</Text>
    </View>
  );
}

function useStyles() {
  const t = useAdminTheme();
  return StyleSheet.create({
    avatar: {
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: t.colors.primarySoft, alignItems: "center", justifyContent: "center",
    },
    divider: { height: 1, backgroundColor: t.colors.divider, marginVertical: 6 },
    orderRow: {
      flexDirection: "row", padding: 14, alignItems: "center", gap: 12,
      borderBottomWidth: 1, borderBottomColor: t.colors.divider,
    },
  });
}
