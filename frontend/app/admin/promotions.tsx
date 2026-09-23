import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, FlatList, RefreshControl, StyleSheet, Modal, Switch, Alert, Platform, ActivityIndicator, KeyboardAvoidingView } from "react-native";
import Feather from "@react-native-vector-icons/feather";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAdminTheme } from "@/src/admin/theme";
import { AdminBadge, AdminEmpty, AdminSkeleton, AdminButton } from "@/src/admin/ui";
import { AdminField } from "@/src/admin/field";
import { api } from "@/src/api/client";

type Coupon = {
  code: string;
  kind: "percent" | "flat";
  value: number;
  min_order?: number;
  max_discount?: number;
  active: boolean;
  expires_at?: string;
  created_at?: string;
};

function fmtDate(iso?: string) {
  if (!iso) return "No expiry";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminPromotions() {
  const t = useAdminTheme();
  const router = useRouter();
  const [items, setItems] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const styles = useStyles();

  const load = useCallback(async () => {
    try {
      const list = await api<Coupon[]>("/admin/coupons", { auth: true });
      setItems(list);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (code: string) => {
    const doIt = async () => {
      setDeleting(code);
      try {
        await api(`/admin/coupons/${code}`, { method: "DELETE", auth: true });
        setItems((list) => list.filter((c) => c.code !== code));
      } catch (e: any) {
        const msg = e?.message || "Delete failed";
        if (Platform.OS === "web") { /* @ts-ignore */ window.alert(msg); }
        else Alert.alert("Error", msg);
      } finally {
        setDeleting(null);
      }
    };
    const title = `Delete "${code}"?`;
    if (Platform.OS === "web") { /* @ts-ignore */ if (window.confirm(title + "\n\nThis cannot be undone.")) doIt(); }
    else Alert.alert(title, "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: doIt },
    ]);
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={t.colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[t.type.h1, { color: t.colors.onSurface }]}>Promotions</Text>
          <Text style={[t.type.bodySm, { color: t.colors.onSurfaceSecondary, marginTop: 2 }]}>{items.length} coupon codes</Text>
        </View>
        <Pressable
          testID="add-coupon-btn"
          onPress={() => setFormOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Add new promotion"
          style={styles.addBtn}
        >
          <Feather name="plus" size={18} color={t.colors.onPrimary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0, 1, 2].map((i) => <AdminSkeleton key={i} height={110} radius={14} />)}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.code}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.colors.primary} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}
          ListEmptyComponent={
            <AdminEmpty
              icon="tag"
              title="No coupons yet"
              subtitle="Create your first promotion to reward customers."
              actionLabel="Create Coupon"
              onAction={() => setFormOpen(true)}
            />
          }
          renderItem={({ item: c }) => (
            <View style={styles.card}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <View style={styles.codeBox}>
                  <Feather name="tag" size={16} color={t.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[t.type.h2, { color: t.colors.onSurface, letterSpacing: 0.5 }]}>{c.code}</Text>
                  <Text style={[t.type.bodySm, { color: t.colors.mutedText, marginTop: 2 }]}>
                    {c.kind === "percent" ? `${c.value}% off` : `₹${c.value} off`}
                    {c.min_order ? ` · min ₹${c.min_order}` : ""}
                    {c.kind === "percent" && c.max_discount ? ` · cap ₹${c.max_discount}` : ""}
                  </Text>
                </View>
                <AdminBadge label={c.active ? "Active" : "Paused"} tone={c.active ? "success" : "neutral"} />
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Feather name="calendar" size={12} color={t.colors.mutedText} />
                  <Text style={[t.type.bodySm, { color: t.colors.mutedText }]}>Expires: {fmtDate(c.expires_at)}</Text>
                </View>
                <Pressable
                  onPress={() => remove(c.code)}
                  disabled={deleting === c.code}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete coupon ${c.code}`}
                  testID={`coupon-delete-${c.code}`}
                  style={styles.deleteBtn}
                >
                  {deleting === c.code
                    ? <ActivityIndicator size="small" color={t.colors.danger} />
                    : <>
                        <Feather name="trash-2" size={13} color={t.colors.danger} />
                        <Text style={{ ...t.type.button, fontSize: 11, color: t.colors.danger }}>DELETE</Text>
                      </>}
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <CouponForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(saved) => {
          setItems((list) => {
            const rest = list.filter((c) => c.code !== saved.code);
            return [saved, ...rest];
          });
          setFormOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

function CouponForm({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (c: Coupon) => void }) {
  const t = useAdminTheme();
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "flat">("percent");
  const [value, setValue] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [active, setActive] = useState(true);
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const styles = useStyles();

  useEffect(() => {
    if (open) {
      setCode(""); setKind("percent"); setValue(""); setMinOrder(""); setMaxDiscount("");
      setActive(true); setExpiresAt(""); setErrors({});
    }
  }, [open]);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!code.trim()) e.code = "Code is required";
    const v = parseFloat(value);
    if (isNaN(v) || v <= 0) e.value = "Enter a valid discount value";
    if (kind === "percent" && v > 100) e.value = "Percent cannot exceed 100";
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      const body = {
        code: code.trim().toUpperCase(),
        kind,
        value: v,
        min_order: minOrder ? parseFloat(minOrder) : 0,
        max_discount: maxDiscount ? parseFloat(maxDiscount) : 0,
        active,
        expires_at: expiresAt || "",
      };
      const saved = await api<Coupon>("/admin/coupons", { method: "POST", auth: true, body });
      onSaved(saved);
    } catch (err: any) {
      const msg = err?.message || "Save failed";
      if (Platform.OS === "web") { /* @ts-ignore */ window.alert(msg); }
      else Alert.alert("Error", msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal transparent visible={open} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 560 }} contentContainerStyle={{ gap: 14 }}>
            <Text style={[t.type.h1, { color: t.colors.onSurface }]}>New Promotion</Text>

            <AdminField
              label="Coupon code" required value={code} onChangeText={(v) => setCode(v.toUpperCase())}
              placeholder="WELCOME10" autoCapitalize="characters" error={errors.code} testID="coupon-code-input"
            />

            <View>
              <Text style={{ ...t.type.label, color: t.colors.onSurfaceSecondary, marginBottom: 6 }}>Discount type</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["percent", "flat"] as const).map((k) => {
                  const active = kind === k;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => setKind(k)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={k === "percent" ? "Percent off" : "Flat rupees off"}
                      style={[styles.segBtn, active && { backgroundColor: t.colors.primarySoft, borderColor: t.colors.primary }]}
                    >
                      <Text style={{ ...t.type.button, fontSize: 11, color: active ? t.colors.primary : t.colors.onSurfaceSecondary }}>
                        {k === "percent" ? "% Percent" : "₹ Flat"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <AdminField
              label={kind === "percent" ? "Discount percent" : "Discount amount"}
              required
              prefix={kind === "flat" ? "₹" : undefined}
              suffix={kind === "percent" ? "%" : undefined}
              value={value} onChangeText={setValue} placeholder="0" keyboardType="numeric"
              error={errors.value} testID="coupon-value-input"
            />

            <AdminField
              label="Minimum order" prefix="₹" value={minOrder} onChangeText={setMinOrder}
              placeholder="0" keyboardType="numeric" hint="Optional"
            />
            {kind === "percent" && (
              <AdminField
                label="Maximum discount cap" prefix="₹" value={maxDiscount} onChangeText={setMaxDiscount}
                placeholder="0" keyboardType="numeric" hint="Optional cap for percent coupons"
              />
            )}
            <AdminField
              label="Expires on" value={expiresAt} onChangeText={setExpiresAt}
              placeholder="YYYY-MM-DD" hint="Leave blank for no expiry"
            />

            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={[t.type.bodyLg, { color: t.colors.onSurface, fontFamily: "DMSansMedium" }]}>Activate immediately</Text>
                <Text style={[t.type.bodySm, { color: t.colors.mutedText, marginTop: 2 }]}>Customers can use it right away</Text>
              </View>
              <Switch
                testID="coupon-active-switch"
                value={active}
                onValueChange={setActive}
                accessibilityLabel="Activate coupon"
                trackColor={{ true: t.colors.primary, false: t.colors.border }}
              />
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <AdminButton label="Cancel" variant="secondary" fullWidth onPress={onClose} testID="coupon-cancel-btn" />
              </View>
              <View style={{ flex: 2 }}>
                <AdminButton label={active ? "Activate" : "Save Draft"} icon="check" fullWidth onPress={submit} loading={saving} testID="coupon-save-btn" />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function useStyles() {
  const t = useAdminTheme();
  return StyleSheet.create({
    topBar: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingTop: 4, minHeight: 56 },
    iconBtn: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", padding: 8 },
    addBtn: {
      width: 44, height: 44, borderRadius: 22, backgroundColor: t.colors.primary,
      alignItems: "center", justifyContent: "center", marginRight: 8,
    },
    card: {
      padding: 14, backgroundColor: t.colors.surface, borderRadius: t.radius.lg,
      borderWidth: 1, borderColor: t.colors.border,
    },
    codeBox: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: t.colors.primarySoft, alignItems: "center", justifyContent: "center",
    },
    deleteBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 10, height: 32, minHeight: 32, borderRadius: 999,
      backgroundColor: t.colors.dangerSoft,
    },
    segBtn: {
      flex: 1, height: 44, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.border,
      alignItems: "center", justifyContent: "center", backgroundColor: t.colors.surface,
    },
    sheetBackdrop: { flex: 1, backgroundColor: t.colors.overlay },
    sheet: { backgroundColor: t.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, gap: 8 },
    sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: t.colors.border, marginBottom: 12 },
  });
}
