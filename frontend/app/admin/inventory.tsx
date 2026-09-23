import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, FlatList, RefreshControl, StyleSheet, ActivityIndicator, Alert, Platform } from "react-native";
import Feather from "@react-native-vector-icons/feather";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useAdminTheme } from "@/src/admin/theme";
import { AdminBadge, AdminEmpty, AdminSkeleton } from "@/src/admin/ui";
import { api } from "@/src/api/client";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "low", label: "Low Stock" },
  { key: "out", label: "Out of Stock" },
  { key: "in", label: "In Stock" },
];

const LOW_THRESHOLD = 5;

function stockTone(stock: number): { tone: any; label: string } {
  if (stock <= 0) return { tone: "danger", label: "Out of stock" };
  if (stock < LOW_THRESHOLD) return { tone: "warning", label: `${stock} left · low` };
  return { tone: "success", label: `${stock} in stock` };
}

export default function AdminInventory() {
  const t = useAdminTheme();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const styles = useStyles();

  const load = useCallback(async () => {
    try {
      const list = await api<any[]>("/products");
      setItems(list);
      setDrafts({}); // clear pending edits
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((p) => {
      const s = p.stock ?? 0;
      if (filter === "low" && !(s > 0 && s < LOW_THRESHOLD)) return false;
      if (filter === "out" && s !== 0) return false;
      if (filter === "in" && s < LOW_THRESHOLD) return false;
      if (!term) return true;
      return (p.name || "").toLowerCase().includes(term);
    });
  }, [items, q, filter]);

  const setDraft = (id: string, val: number) => {
    setDrafts((d) => ({ ...d, [id]: Math.max(0, val) }));
  };
  const currentStock = (p: any) => (drafts[p.id] !== undefined ? drafts[p.id] : (p.stock ?? 0));
  const isDirty = (p: any) => drafts[p.id] !== undefined && drafts[p.id] !== (p.stock ?? 0);

  const save = async (p: any) => {
    const val = drafts[p.id];
    if (val === undefined) return;
    setSaving((s) => ({ ...s, [p.id]: true }));
    try {
      const updated = await api<any>(`/admin/products/${p.id}/stock`, {
        method: "PATCH",
        auth: true,
        body: { stock: val },
      });
      setItems((list) => list.map((it) => (it.id === p.id ? updated : it)));
      setDrafts((d) => {
        const next = { ...d };
        delete next[p.id];
        return next;
      });
    } catch (e: any) {
      const msg = e?.message || "Could not save";
      if (Platform.OS === "web") { /* @ts-ignore */ window.alert(msg); }
      else Alert.alert("Save failed", msg);
    } finally {
      setSaving((s) => ({ ...s, [p.id]: false }));
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={t.colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[t.type.h1, { color: t.colors.onSurface }]}>Inventory</Text>
          <Text style={[t.type.bodySm, { color: t.colors.onSurfaceSecondary, marginTop: 2 }]}>{filtered.length} items</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color={t.colors.mutedText} />
          <TextInput
            testID="inventory-search"
            value={q}
            onChangeText={setQ}
            placeholder="Search products…"
            placeholderTextColor={t.colors.mutedText}
            style={{ flex: 1, color: t.colors.onSurface, fontFamily: "DMSans", fontSize: 15, paddingVertical: 10 }}
            accessibilityLabel="Search inventory"
          />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={f.label}
              style={[styles.chip, { backgroundColor: active ? t.colors.onSurface : t.colors.surface, borderColor: active ? t.colors.onSurface : t.colors.border }]}
            >
              <Text style={{ ...t.type.button, fontSize: 11, color: active ? t.colors.surface : t.colors.onSurfaceSecondary }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0, 1, 2, 3].map((i) => <AdminSkeleton key={i} height={110} radius={14} />)}
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
              title={q || filter !== "all" ? "No products match" : "No inventory yet"}
              subtitle={q || filter !== "all" ? "Try a different filter or search." : "Add products first."}
            />
          }
          renderItem={({ item: p }) => {
            const val = currentStock(p);
            const st = stockTone(val);
            const dirty = isDirty(p);
            return (
              <View style={styles.card}>
                <View style={styles.imgWrap}>
                  {p.images?.[0] ? (
                    <Image source={{ uri: p.images[0] }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : (
                    <Feather name="image" size={20} color={t.colors.mutedText} />
                  )}
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[t.type.bodyLg, { color: t.colors.onSurface, fontFamily: "DMSansMedium" }]} numberOfLines={2}>
                    {p.name}
                  </Text>
                  <Text style={[t.type.bodySm, { color: t.colors.mutedText }]}>SKU · {p.id.slice(0, 8).toUpperCase()}</Text>
                  <AdminBadge label={st.label} tone={st.tone} icon={val < LOW_THRESHOLD ? "alert-triangle" : undefined} />

                  <View style={styles.stepperRow}>
                    <Pressable
                      onPress={() => setDraft(p.id, val - 1)}
                      disabled={val === 0}
                      accessibilityRole="button"
                      accessibilityLabel="Decrease stock"
                      style={[styles.stepBtn, val === 0 && { opacity: 0.5 }]}
                      testID={`stock-dec-${p.id}`}
                    >
                      <Feather name="minus" size={14} color={t.colors.onSurface} />
                    </Pressable>
                    <TextInput
                      value={String(val)}
                      onChangeText={(txt) => setDraft(p.id, parseInt(txt.replace(/[^0-9]/g, "") || "0", 10))}
                      keyboardType="numeric"
                      accessibilityLabel={`Stock for ${p.name}`}
                      testID={`stock-input-${p.id}`}
                      style={[t.type.h3, { color: t.colors.onSurface, textAlign: "center", minWidth: 44, paddingVertical: 6 }]}
                    />
                    <Pressable
                      onPress={() => setDraft(p.id, val + 1)}
                      accessibilityRole="button"
                      accessibilityLabel="Increase stock"
                      style={styles.stepBtn}
                      testID={`stock-inc-${p.id}`}
                    >
                      <Feather name="plus" size={14} color={t.colors.onSurface} />
                    </Pressable>
                    {dirty && (
                      <Pressable
                        onPress={() => save(p)}
                        disabled={saving[p.id]}
                        accessibilityRole="button"
                        accessibilityLabel={`Save stock ${val} for ${p.name}`}
                        style={styles.saveBtn}
                        testID={`stock-save-${p.id}`}
                      >
                        {saving[p.id]
                          ? <ActivityIndicator size="small" color={t.colors.onPrimary} />
                          : <Text style={{ ...t.type.button, color: t.colors.onPrimary, fontSize: 10 }}>SAVE</Text>}
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function useStyles() {
  const t = useAdminTheme();
  return StyleSheet.create({
    topBar: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingTop: 4, minHeight: 56 },
    iconBtn: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", padding: 8 },
    searchBox: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: t.colors.surface, borderRadius: t.radius.md,
      borderWidth: 1, borderColor: t.colors.border, paddingHorizontal: 12, minHeight: 44,
    },
    chipsRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
    chip: { paddingHorizontal: 14, height: 32, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    card: {
      flexDirection: "row", gap: 12, padding: 12,
      backgroundColor: t.colors.surface, borderRadius: t.radius.lg,
      borderWidth: 1, borderColor: t.colors.border,
    },
    imgWrap: {
      width: 72, height: 72, borderRadius: t.radius.md, overflow: "hidden",
      backgroundColor: t.colors.surfaceAlt, alignItems: "center", justifyContent: "center",
    },
    stepperRow: {
      flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4,
    },
    stepBtn: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: t.colors.surfaceAlt, alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: t.colors.border,
    },
    saveBtn: {
      marginLeft: 8, paddingHorizontal: 14, height: 32, minHeight: 32, borderRadius: 999,
      backgroundColor: t.colors.primary, alignItems: "center", justifyContent: "center",
    },
  });
}
