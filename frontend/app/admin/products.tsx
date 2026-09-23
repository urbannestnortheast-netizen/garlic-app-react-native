import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, FlatList, RefreshControl, StyleSheet, Modal, Alert, Platform } from "react-native";
import Feather from "@react-native-vector-icons/feather";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useAdminTheme } from "@/src/admin/theme";
import { AdminBadge, AdminEmpty, AdminSkeleton, AdminButton } from "@/src/admin/ui";
import { api } from "@/src/api/client";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "dining", label: "Dining" },
  { key: "kitchen", label: "Kitchen" },
  { key: "decor", label: "Decor" },
  { key: "bath", label: "Bath" },
  { key: "soft-furnishing", label: "Soft Furnishing" },
  { key: "accessories", label: "Accessories" },
];

function stockLabel(stock: number) {
  if (stock <= 0) return { label: "Out of stock", tone: "danger" as const };
  if (stock < 5) return { label: `${stock} left`, tone: "warning" as const };
  return { label: `${stock} in stock`, tone: "success" as const };
}
function INR(n: number) { return "₹" + Math.round(n || 0).toLocaleString("en-IN"); }

export default function AdminProducts() {
  const t = useAdminTheme();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [menuOpen, setMenuOpen] = useState<string | null>(null); // productId of open menu
  const styles = useStyles();

  const load = useCallback(async () => {
    try {
      const list = await api<any[]>("/products");
      setItems(list);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((p) => {
      if (cat !== "all" && p.category !== cat) return false;
      if (!term) return true;
      return (p.name || "").toLowerCase().includes(term) || (p.id || "").toLowerCase().includes(term);
    });
  }, [items, q, cat]);

  const remove = async (product: any) => {
    const doIt = async () => {
      try {
        await api(`/products/${product.id}`, { method: "DELETE", auth: true });
        setMenuOpen(null);
        load();
      } catch (e: any) {
        const msg = e?.message || "Delete failed";
        if (Platform.OS === "web") { /* @ts-ignore */ window.alert(msg); }
        else { Alert.alert("Error", msg); }
      }
    };
    if (Platform.OS === "web") {
      // @ts-ignore
      if (window.confirm(`Delete "${product.name}"?\nThis cannot be undone.`)) doIt();
    } else {
      Alert.alert("Delete product?", `"${product.name}" will be permanently removed.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doIt },
      ]);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[t.type.displayLG, { color: t.colors.onSurface }]}>Products</Text>
          <Text style={[t.type.body, { color: t.colors.onSurfaceSecondary, marginTop: 2 }]}>{filtered.length} items</Text>
        </View>
        <Pressable
          testID="add-product-btn"
          accessibilityRole="button"
          accessibilityLabel="Add new product"
          onPress={() => router.push("/admin/product/new" as any)}
          style={styles.addBtn}
        >
          <Feather name="plus" size={18} color={t.colors.onPrimary} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color={t.colors.mutedText} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search products…"
            placeholderTextColor={t.colors.mutedText}
            style={{ flex: 1, color: t.colors.onSurface, fontFamily: "DMSans", fontSize: 15, paddingVertical: 10 }}
            accessibilityLabel="Search products"
          />
          {q.length ? (
            <Pressable onPress={() => setQ("")} accessibilityLabel="Clear search" hitSlop={12} style={{ padding: 4 }}>
              <Feather name="x" size={16} color={t.colors.mutedText} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {CATEGORIES.map((c) => {
          const active = cat === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => setCat(c.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${c.label} filter`}
              style={[styles.chip, { backgroundColor: active ? t.colors.onSurface : t.colors.surface, borderColor: active ? t.colors.onSurface : t.colors.border }]}
            >
              <Text style={{ ...t.type.button, fontSize: 11, color: active ? t.colors.surface : t.colors.onSurfaceSecondary }}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0, 1, 2, 3].map((i) => <AdminSkeleton key={i} height={96} radius={14} />)}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.colors.primary} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}
          ListEmptyComponent={
            <AdminEmpty
              icon="package"
              title={q ? "No matches" : "No products yet"}
              subtitle={q ? "Try a different search term." : "Add your first product to start building your catalog."}
              actionLabel={q ? undefined : "Add Product"}
              onAction={q ? undefined : () => router.push("/admin/product/new" as any)}
            />
          }
          renderItem={({ item: p }) => {
            const st = stockLabel(p.stock ?? 0);
            const price = p.original_price && p.original_price > p.price ? p.original_price : p.price;
            const salePrice = p.original_price && p.original_price > p.price ? p.price : null;
            return (
              <View style={styles.card}>
                <Pressable
                  onPress={() => router.push(`/admin/product/${p.id}` as any)}
                  onLongPress={() => setMenuOpen(p.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${p.name}, ${INR(p.price)}, ${st.label}`}
                  accessibilityHint="Long press for more actions"
                  style={({ pressed }) => [styles.cardTap, { opacity: pressed ? 0.85 : 1 }]}
                >
                  <View style={styles.imgWrap}>
                    {p.images?.[0] ? (
                      <Image source={{ uri: p.images[0] }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    ) : (
                      <Feather name="image" size={20} color={t.colors.mutedText} />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[t.type.bodyLg, { color: t.colors.onSurface, fontFamily: "DMSansMedium" }]} numberOfLines={2}>
                      {p.name}
                    </Text>
                    <Text style={[t.type.bodySm, { color: t.colors.mutedText, textTransform: "capitalize" }]}>
                      {p.category}{p.subcategory ? ` · ${p.subcategory}` : ""}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <Text style={[t.type.h3, { color: t.colors.onSurface }]}>{INR(p.price)}</Text>
                      {salePrice && (
                        <Text style={[t.type.bodySm, { color: t.colors.mutedText, textDecorationLine: "line-through" }]}>
                          {INR(price)}
                        </Text>
                      )}
                    </View>
                    <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                      <AdminBadge label={st.label} tone={st.tone} />
                      {p.featured && <AdminBadge label="Featured" tone="primary" icon="star" />}
                    </View>
                  </View>
                </Pressable>
                <Pressable
                  testID={`product-more-${p.id}`}
                  onPress={() => setMenuOpen(p.id)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={`More actions for ${p.name}`}
                  style={styles.moreBtn}
                >
                  <Feather name="more-vertical" size={18} color={t.colors.mutedText} />
                </Pressable>
              </View>
            );
          }}
        />
      )}

      {/* Bottom-sheet actions */}
      <Modal transparent visible={!!menuOpen} animationType="slide" onRequestClose={() => setMenuOpen(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setMenuOpen(null)} accessibilityLabel="Close menu" />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          {(() => {
            const product = items.find((x) => x.id === menuOpen);
            if (!product) return null;
            return (
              <>
                <Text style={[t.type.h1, { color: t.colors.onSurface, marginBottom: 4 }]} numberOfLines={1}>{product.name}</Text>
                <Text style={[t.type.body, { color: t.colors.onSurfaceSecondary, marginBottom: 12 }]}>
                  Choose an action
                </Text>
                <Pressable
                  onPress={() => { setMenuOpen(null); router.push(`/admin/product/${product.id}` as any); }}
                  accessibilityRole="button" accessibilityLabel="Edit product"
                  style={styles.actionRow}
                >
                  <Feather name="edit-2" size={18} color={t.colors.onSurface} />
                  <Text style={[t.type.bodyLg, { color: t.colors.onSurface, flex: 1 }]}>Edit</Text>
                </Pressable>
                <Pressable
                  onPress={() => remove(product)}
                  accessibilityRole="button" accessibilityLabel="Delete product"
                  style={[styles.actionRow, { backgroundColor: t.colors.dangerSoft }]}
                >
                  <Feather name="trash-2" size={18} color={t.colors.danger} />
                  <Text style={[t.type.bodyLg, { color: t.colors.danger, flex: 1, fontFamily: "DMSansMedium" }]}>Delete</Text>
                </Pressable>
                <View style={{ marginTop: 12 }}>
                  <AdminButton label="Cancel" variant="secondary" fullWidth onPress={() => setMenuOpen(null)} />
                </View>
              </>
            );
          })()}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function useStyles() {
  const t = useAdminTheme();
  return StyleSheet.create({
    header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
    addBtn: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: t.colors.primary, alignItems: "center", justifyContent: "center",
    },
    searchBox: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: t.colors.surface, borderRadius: t.radius.md,
      borderWidth: 1, borderColor: t.colors.border, paddingHorizontal: 12, minHeight: 44,
    },
    chipsRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
    chip: { paddingHorizontal: 14, height: 32, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    card: {
      flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 4,
      backgroundColor: t.colors.surface, borderRadius: t.radius.lg,
      borderWidth: 1, borderColor: t.colors.border,
    },
    cardTap: {
      flex: 1, flexDirection: "row", gap: 12, padding: 12,
    },
    imgWrap: {
      width: 72, height: 72, borderRadius: t.radius.md, overflow: "hidden",
      backgroundColor: t.colors.surfaceAlt, alignItems: "center", justifyContent: "center",
    },
    moreBtn: { minHeight: 44, minWidth: 32, alignItems: "center", justifyContent: "center" },
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
