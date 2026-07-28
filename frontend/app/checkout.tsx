import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Modal,
  Platform, KeyboardAvoidingView,
} from "react-native";
import { WebView } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { colors, radius, spacing, type } from "@/src/theme";
import { useCart } from "@/src/context/CartContext";
import { useAuth } from "@/src/context/AuthContext";
import { api, BACKEND_URL } from "@/src/api/client";

export default function Checkout() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, subtotal, clear } = useCart();
  const shipping = subtotal > 2000 ? 0 : 99;
  const total = subtotal + shipping;

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.mobile || "");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [mock, setMock] = useState(false);
  const [success, setSuccess] = useState(false);

  const startPayment = async () => {
    setErr(null);
    if (!name || !phone || !address) return setErr("Please fill in shipping details.");
    if (items.length === 0) return setErr("Your cart is empty.");
    setBusy(true);
    try {
      const r = await api<any>("/orders/create", {
        method: "POST",
        auth: true,
        body: {
          items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
          shipping_address: address,
          shipping_name: name,
          shipping_phone: phone,
        },
      });
      setActiveOrder(r.order);
      setMock(r.mock);
      if (!r.mock) {
        setCheckoutUrl(r.checkout_url);
      }
    } catch (e: any) {
      setErr(e.message || "Failed to create order");
    } finally {
      setBusy(false);
    }
  };

  const confirmMockPay = async () => {
    if (!activeOrder) return;
    setBusy(true);
    try {
      await api(`/orders/${activeOrder.id}/mock-pay`, { method: "POST", auth: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clear();
      setSuccess(true);
    } catch (e: any) {
      setErr(e.message || "Payment failed");
    } finally {
      setBusy(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={styles.successWrap} testID="checkout-success">
          <View style={styles.tick}>
            <Feather name="check" size={38} color={colors.onSurfaceInverse} />
          </View>
          <Text style={styles.successTitle}>Order Placed</Text>
          <Text style={styles.successText}>Thank you for choosing Garlic. Your order is on its way to your nest.</Text>
          <Pressable testID="view-orders-btn" style={styles.primary} onPress={() => { router.replace("/orders"); }}>
            <Text style={styles.primaryText}>View My Orders</Text>
          </Pressable>
          <Pressable testID="continue-shopping-btn" style={styles.secondary} onPress={() => router.replace("/(tabs)")}>
            <Text style={styles.secondaryText}>Continue Shopping</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 200, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Text style={styles.section}>Shipping Details</Text>
          <Field label="Full Name" testID="ship-name" value={name} onChangeText={setName} />
          <Field label="Phone" testID="ship-phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field label="Address" testID="ship-address" value={address} onChangeText={setAddress} multiline numberOfLines={3} style={{ minHeight: 90 }} />

          <Text style={[styles.section, { marginTop: spacing.md }]}>Order Summary</Text>
          <View style={{ gap: spacing.sm }}>
            {items.map((i) => (
              <View key={i.product_id} style={styles.orderRow}>
                <Text style={styles.orderName} numberOfLines={1}>{i.name} × {i.quantity}</Text>
                <Text style={styles.orderVal}>₹{(i.price * i.quantity).toLocaleString("en-IN")}</Text>
              </View>
            ))}
          </View>
          <View style={styles.totalBox}>
            <Row label="Subtotal" value={`₹${subtotal.toLocaleString("en-IN")}`} />
            <Row label="Shipping" value={shipping === 0 ? "Free" : `₹${shipping}`} />
            <View style={styles.dividerLine} />
            <Row label="Total" value={`₹${total.toLocaleString("en-IN")}`} big />
          </View>

          {err && <Text style={styles.err} testID="checkout-error">{err}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          {activeOrder && mock ? (
            <>
              <Text style={styles.mockNote}>Razorpay keys not configured. Proceed with mock payment for testing.</Text>
              <Pressable testID="mock-pay-btn" style={styles.payBtn} onPress={confirmMockPay} disabled={busy}>
                {busy ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <Text style={styles.payText}>Pay ₹{total.toLocaleString("en-IN")} (Mock)</Text>}
              </Pressable>
            </>
          ) : (
            <Pressable testID="pay-now-btn" style={styles.payBtn} onPress={startPayment} disabled={busy}>
              {busy ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <Text style={styles.payText}>Pay ₹{total.toLocaleString("en-IN")}</Text>}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal visible={!!checkoutUrl} animationType="slide" onRequestClose={() => setCheckoutUrl(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={styles.header}>
            <Pressable onPress={() => setCheckoutUrl(null)} testID="close-webview">
              <Feather name="x" size={22} color={colors.onSurface} />
            </Pressable>
            <Text style={styles.headerTitle}>Razorpay Checkout</Text>
            <View style={{ width: 22 }} />
          </View>
          {checkoutUrl && (
            <WebView
              source={{ uri: checkoutUrl }}
              onNavigationStateChange={(nav) => {
                if (nav.url.includes("/api/payments/verify")) {
                  setTimeout(() => {
                    setCheckoutUrl(null);
                    clear();
                    setSuccess(true);
                  }, 800);
                }
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Field({ label, testID, ...rest }: any) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <TextInput
        testID={testID}
        style={styles.input}
        placeholderTextColor={colors.mutedText}
        {...rest}
      />
    </View>
  );
}

function Row({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
      <Text style={{ fontFamily: big ? "CormorantGaramondBold" : "DMSans", fontSize: big ? 18 : 14, color: big ? colors.onSurface : colors.onSurfaceSecondary }}>{label}</Text>
      <Text style={{ fontFamily: big ? "CormorantGaramondBold" : "DMSansMedium", fontSize: big ? 20 : 14, color: colors.onSurface }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  headerTitle: { fontFamily: "CormorantGaramondBold", fontSize: 22, color: colors.onSurface },
  section: { fontFamily: "CormorantGaramondBold", fontSize: 22, color: colors.onSurface, marginTop: spacing.sm },
  label: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: colors.mutedText },
  input: {
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.lg,
    fontFamily: "DMSans", fontSize: 15, color: colors.onSurface,
    textAlignVertical: "top",
  },
  orderRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  orderName: { fontFamily: "DMSans", fontSize: 14, color: colors.onSurfaceSecondary, flex: 1 },
  orderVal: { fontFamily: "DMSansMedium", fontSize: 14, color: colors.onSurface },
  totalBox: { marginTop: spacing.sm, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg },
  dividerLine: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.sm },
  err: { fontFamily: "DMSans", color: colors.error, backgroundColor: "#F9EDEC", padding: spacing.md, borderRadius: radius.lg },
  footer: {
    padding: spacing.xl,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  payBtn: {
    backgroundColor: colors.onSurface, paddingVertical: spacing.lg,
    borderRadius: radius.pill, alignItems: "center",
  },
  payText: { color: colors.onSurfaceInverse, fontFamily: "DMSansBold", letterSpacing: 1.5, textTransform: "uppercase", fontSize: 14 },
  mockNote: { fontFamily: "DMSans", fontSize: 12, color: colors.mutedText, textAlign: "center" },
  successWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  tick: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.onSurface, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  successTitle: { ...type.displayLG },
  successText: { ...type.bodyLg, textAlign: "center", marginBottom: spacing.lg },
  primary: { backgroundColor: colors.onSurface, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, borderRadius: radius.pill },
  primaryText: { color: colors.onSurfaceInverse, fontFamily: "DMSansBold", letterSpacing: 1.5, textTransform: "uppercase", fontSize: 13 },
  secondary: { paddingVertical: spacing.md, paddingHorizontal: spacing.xxl },
  secondaryText: { color: colors.onSurfaceSecondary, fontFamily: "DMSansMedium", textDecorationLine: "underline" },
});
