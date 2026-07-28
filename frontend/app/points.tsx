import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing, type } from "@/src/theme";
import { api } from "@/src/api/client";

type Tx = { id: string; type: "earn" | "spend"; amount: number; reason: string; meta: any; created_at: string };
type PointsData = {
  balance: number;
  value_rupees: number;
  rate_per_rupee: number;
  redeem_value: number;
  transactions: Tx[];
};

const REASON_LABEL: Record<string, string> = {
  order_earn: "Order Cashback",
  order_redemption: "Redeemed at Checkout",
  referral_gift: "Nest Table Gift Bonus",
};

export default function Points() {
  const router = useRouter();
  const [data, setData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setData(await api<PointsData>("/points", { auth: true })); }
    catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !data) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.onSurfaceSecondary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="back-btn">
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Nest Rewards</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl }}>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>YOUR POINTS BALANCE</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balance} testID="points-balance">{data.balance.toLocaleString("en-IN")}</Text>
            <Text style={styles.pts}>pts</Text>
          </View>
          <Text style={styles.equiv}>Worth ₹{data.value_rupees.toLocaleString("en-IN")}</Text>
        </View>

        <View style={styles.rules}>
          <RuleRow icon="shopping-bag" title="Earn 2% back on every order" desc={`${data.rate_per_rupee * 100} pts for every ₹100 spent, redeem at ₹${data.redeem_value.toFixed(2)}/pt.`} />
          <RuleRow icon="gift" title="Nest Table gift bonus" desc="Get 500 bonus pts (₹50) every time a friend marks a gift on your shared Nest Table." />
          <RuleRow icon="percent" title="Redeem up to 30% of any order" desc="Apply your Nest Points at checkout." />
        </View>

        <View>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {data.transactions.length === 0 ? (
            <View style={styles.emptyWrap} testID="points-empty">
              <Feather name="clock" size={30} color={colors.mutedText} />
              <Text style={styles.emptyText}>No activity yet. Place your first order to start earning.</Text>
            </View>
          ) : (
            <View style={{ gap: spacing.md, marginTop: spacing.md }}>
              {data.transactions.map((tx) => (
                <View key={tx.id} style={styles.txRow} testID={`tx-${tx.id}`}>
                  <View style={[styles.txIcon, tx.type === "earn" ? styles.txEarn : styles.txSpend]}>
                    <Feather name={tx.type === "earn" ? "arrow-down-left" : "arrow-up-right"} size={16} color={tx.type === "earn" ? "#1A3024" : "#3D1A19"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txTitle}>{REASON_LABEL[tx.reason] || tx.reason}</Text>
                    <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString()}</Text>
                  </View>
                  <Text style={[styles.txAmount, tx.type === "earn" ? { color: colors.success } : { color: colors.error }]}>
                    {tx.type === "earn" ? "+" : "−"}{tx.amount}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RuleRow({ icon, title, desc }: { icon: keyof typeof Feather.glyphMap; title: string; desc: string }) {
  return (
    <View style={styles.ruleRow}>
      <View style={styles.ruleIcon}><Feather name={icon} size={16} color={colors.brand} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.ruleTitle}>{title}</Text>
        <Text style={styles.ruleDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.xl, paddingBottom: spacing.md },
  headerTitle: { fontFamily: "CormorantGaramondBold", fontSize: 22, color: colors.onSurface },
  hero: { backgroundColor: colors.brand, padding: spacing.xxl, borderRadius: radius.lg, alignItems: "center" },
  heroEyebrow: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: "rgba(252,251,248,0.75)" },
  balanceRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, marginTop: spacing.sm },
  balance: { fontFamily: "CormorantGaramondBold", fontSize: 52, color: colors.onBrandPrimary },
  pts: { fontFamily: "DMSansMedium", fontSize: 14, color: "rgba(252,251,248,0.85)", letterSpacing: 2, textTransform: "uppercase" },
  equiv: { fontFamily: "DMSans", fontSize: 14, color: "rgba(252,251,248,0.85)", marginTop: spacing.xs },
  rules: { gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  ruleRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  ruleIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center" },
  ruleTitle: { fontFamily: "DMSansMedium", fontSize: 14, color: colors.onSurface },
  ruleDesc: { fontFamily: "DMSans", fontSize: 12, color: colors.onSurfaceSecondary, marginTop: 2, lineHeight: 18 },
  sectionTitle: { fontFamily: "CormorantGaramondBold", fontSize: 20, color: colors.onSurface },
  emptyWrap: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyText: { ...type.body, textAlign: "center" },
  txRow: { flexDirection: "row", gap: spacing.md, alignItems: "center", padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  txIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  txEarn: { backgroundColor: colors.success },
  txSpend: { backgroundColor: colors.error },
  txTitle: { fontFamily: "DMSansMedium", fontSize: 14, color: colors.onSurface },
  txDate: { fontFamily: "DMSans", fontSize: 11, color: colors.mutedText, marginTop: 2 },
  txAmount: { fontFamily: "DMSansBold", fontSize: 16 },
});
