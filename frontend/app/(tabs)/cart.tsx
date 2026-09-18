import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import Feather from "@react-native-vector-icons/feather";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, radius, spacing, type } from "@/src/theme";
import { useCart } from "@/src/context/CartContext";
import { useAuth } from "@/src/context/AuthContext";

export default function Cart() {
  const router = useRouter();
  const { items, update, remove, subtotal, count } = useCart();
  const { user } = useAuth();
  const shipping = subtotal > 0 ? (subtotal > 2000 ? 0 : 99) : 0;
  const total = subtotal + shipping;

  const checkout = () => {
    if (!user) return router.push("/(auth)/login");
    router.push("/checkout");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>YOUR</Text>
        <Text style={styles.title}>Cart</Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyWrap} testID="cart-empty">
          <Feather name="shopping-bag" size={40} color={colors.mutedText} />
          <Text style={styles.emptyTitle}>Your cart is beautifully empty</Text>
          <Text style={styles.emptyText}>Discover our collections and start nesting.</Text>
          <Pressable testID="cart-shop-btn" style={styles.cta} onPress={() => router.replace("/(tabs)")}>
            <Text style={styles.ctaText}>Explore Shop</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 200, gap: spacing.lg }}>
            {items.map((it) => (
              <View key={it.product_id} style={styles.row} testID={`cart-row-${it.product_id}`}>
                <Image source={{ uri: it.image }} style={styles.rowImg} contentFit="cover" />
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text style={styles.rowName} numberOfLines={2}>{it.name}</Text>
                  <Text style={styles.rowPrice}>₹{it.price.toLocaleString("en-IN")}</Text>
                  <View style={styles.qtyRow}>
                    <Pressable
                      testID={`cart-dec-${it.product_id}`}
                      onPress={() => update(it.product_id, it.quantity - 1)}
                      style={styles.qtyBtn}
                    >
                      <Feather name="minus" size={14} color={colors.onSurface} />
                    </Pressable>
                    <Text style={styles.qtyText} testID={`cart-qty-${it.product_id}`}>{it.quantity}</Text>
                    <Pressable
                      testID={`cart-inc-${it.product_id}`}
                      onPress={() => update(it.product_id, it.quantity + 1)}
                      style={styles.qtyBtn}
                    >
                      <Feather name="plus" size={14} color={colors.onSurface} />
                    </Pressable>
                    <Pressable
                      testID={`cart-remove-${it.product_id}`}
                      onPress={() => remove(it.product_id)}
                      style={styles.removeBtn}
                    >
                      <Feather name="trash-2" size={14} color={colors.mutedText} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal ({count})</Text>
              <Text style={styles.summaryValue}>₹{subtotal.toLocaleString("en-IN")}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Shipping</Text>
              <Text style={styles.summaryValue}>{shipping === 0 ? "Free" : `₹${shipping}`}</Text>
            </View>
            <View style={[styles.summaryRow, { marginTop: spacing.sm }]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue} testID="cart-total">₹{total.toLocaleString("en-IN")}</Text>
            </View>
            <Pressable testID="proceed-checkout-btn" style={styles.checkoutBtn} onPress={checkout}>
              <Text style={styles.checkoutText}>Proceed to Checkout</Text>
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.xl, paddingBottom: spacing.md },
  eyebrow: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: colors.mutedText },
  title: { ...type.displayLG, marginTop: spacing.xs },
  row: { flexDirection: "row", gap: spacing.lg, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowImg: { width: 96, height: 120, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  rowName: { fontFamily: "CormorantGaramond", fontSize: 18, color: colors.onSurface, lineHeight: 22 },
  rowPrice: { fontFamily: "DMSansMedium", color: colors.onSurfaceSecondary, fontSize: 14 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  qtyText: { fontFamily: "DMSansMedium", minWidth: 24, textAlign: "center", color: colors.onSurface, fontSize: 14 },
  removeBtn: { marginLeft: "auto", padding: spacing.sm },
  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  summaryLabel: { fontFamily: "DMSans", color: colors.onSurfaceSecondary, fontSize: 14 },
  summaryValue: { fontFamily: "DMSansMedium", color: colors.onSurface, fontSize: 14 },
  totalLabel: { fontFamily: "CormorantGaramondBold", fontSize: 20, color: colors.onSurface },
  totalValue: { fontFamily: "CormorantGaramondBold", fontSize: 22, color: colors.onSurface },
  checkoutBtn: {
    marginTop: spacing.md, backgroundColor: colors.onSurface, paddingVertical: spacing.lg,
    borderRadius: radius.pill, alignItems: "center",
  },
  checkoutText: { color: colors.onSurfaceInverse, fontFamily: "DMSansBold", letterSpacing: 1.5, textTransform: "uppercase", fontSize: 14 },
  emptyWrap: { alignItems: "center", padding: spacing.xxl, gap: spacing.md, marginTop: spacing.xl },
  emptyTitle: { ...type.displaySM, marginTop: spacing.md, textAlign: "center" },
  emptyText: { ...type.body, textAlign: "center" },
  cta: { marginTop: spacing.md, backgroundColor: colors.onSurface, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, borderRadius: radius.pill },
  ctaText: { color: colors.onSurfaceInverse, fontFamily: "DMSansBold", letterSpacing: 1.5, textTransform: "uppercase", fontSize: 13 },
});
