import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, FlatList, RefreshControl, StyleSheet, Alert, Platform, ActivityIndicator } from "react-native";
import Feather from "@react-native-vector-icons/feather";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useAdminTheme } from "@/src/admin/theme";
import { AdminEmpty, AdminSkeleton } from "@/src/admin/ui";
import { api } from "@/src/api/client";

const RATING_FILTERS = [
  { key: "all", label: "All" },
  { key: "5", label: "★ 5" },
  { key: "4", label: "★ 4" },
  { key: "3", label: "★ 3" },
  { key: "12", label: "★ 1–2" },
  { key: "photos", label: "With Photos" },
];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function Stars({ n }: { n: number }) {
  const t = useAdminTheme();
  return (
    <View
      accessibilityLabel={`${n} out of 5 stars`}
      style={{ flexDirection: "row", gap: 2 }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Feather
          key={i}
          name="star"
          size={13}
          color={i <= n ? t.colors.warning : t.colors.border}
        />
      ))}
    </View>
  );
}

export default function AdminReviews() {
  const t = useAdminTheme();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const styles = useStyles();

  const load = useCallback(async () => {
    try {
      const list = await api<any[]>("/admin/reviews", { auth: true });
      setItems(list);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((r) => {
      if (filter === "photos" && !(r.photos && r.photos.length)) return false;
      if (["5", "4", "3"].includes(filter) && String(r.rating) !== filter) return false;
      if (filter === "12" && r.rating > 2) return false;
      if (!term) return true;
      return (
        (r.body || "").toLowerCase().includes(term) ||
        (r.user_name || "").toLowerCase().includes(term) ||
        (r.product_name || "").toLowerCase().includes(term)
      );
    });
  }, [items, q, filter]);

  const remove = async (review: any) => {
    const doIt = async () => {
      setDeleting((d) => ({ ...d, [review.id]: true }));
      try {
        await api(`/admin/reviews/${review.id}`, { method: "DELETE", auth: true });
        setItems((list) => list.filter((r) => r.id !== review.id));
      } catch (e: any) {
        const msg = e?.message || "Delete failed";
        if (Platform.OS === "web") { /* @ts-ignore */ window.alert(msg); }
        else Alert.alert("Error", msg);
      } finally {
        setDeleting((d) => ({ ...d, [review.id]: false }));
      }
    };
    const title = "Delete review?";
    const msg = `From ${review.user_name || "customer"}\n"${(review.body || "").slice(0, 80)}${(review.body || "").length > 80 ? "…" : ""}"\n\nThis cannot be undone.`;
    if (Platform.OS === "web") {
      /* @ts-ignore */
      if (window.confirm(title + "\n\n" + msg)) doIt();
    } else {
      Alert.alert(title, msg, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doIt },
      ]);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={t.colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[t.type.h1, { color: t.colors.onSurface }]}>Reviews</Text>
          <Text style={[t.type.bodySm, { color: t.colors.onSurfaceSecondary, marginTop: 2 }]}>{filtered.length} reviews</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color={t.colors.mutedText} />
          <TextInput
            testID="reviews-search"
            value={q}
            onChangeText={setQ}
            placeholder="Search reviews…"
            placeholderTextColor={t.colors.mutedText}
            style={{ flex: 1, color: t.colors.onSurface, fontFamily: "DMSans", fontSize: 15, paddingVertical: 10 }}
            accessibilityLabel="Search reviews"
          />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        {RATING_FILTERS.map((f) => {
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
          {[0, 1, 2].map((i) => <AdminSkeleton key={i} height={140} radius={14} />)}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.colors.primary} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}
          ListEmptyComponent={<AdminEmpty icon="message-square" title={q || filter !== "all" ? "No matches" : "No reviews yet"} />}
          renderItem={({ item: r }) => (
            <View style={styles.card}>
              {/* Header: product info */}
              <Pressable
                onPress={() => r.product_id && router.push(`/admin/product/${r.product_id}` as any)}
                accessibilityRole="button"
                accessibilityLabel={`View product ${r.product_name || ""}`}
                style={styles.prodRow}
              >
                <View style={styles.imgWrap}>
                  {r.product_image ? (
                    <Image source={{ uri: r.product_image }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : (
                    <Feather name="package" size={16} color={t.colors.mutedText} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[t.type.bodySm, { color: t.colors.mutedText, fontFamily: "DMSansMedium" }]} numberOfLines={1}>
                    {r.product_name || "Product"}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <Stars n={r.rating || 0} />
                    <Text style={[t.type.bodySm, { color: t.colors.mutedText }]}>· {fmtDate(r.created_at)}</Text>
                  </View>
                </View>
              </Pressable>

              {/* Review body */}
              {r.title ? (
                <Text style={[t.type.bodyLg, { color: t.colors.onSurface, fontFamily: "DMSansMedium", marginTop: 10 }]} numberOfLines={2}>
                  {r.title}
                </Text>
              ) : null}
              <Text style={[t.type.body, { color: t.colors.onSurfaceSecondary, marginTop: r.title ? 4 : 10 }]} numberOfLines={4}>
                {r.body || <Text style={{ fontStyle: "italic", color: t.colors.mutedText }}>No comment</Text>}
              </Text>

              {/* Photos */}
              {!!(r.photos && r.photos.length) && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 10 }}>
                  {r.photos.slice(0, 3).map((p: string, i: number) => (
                    <View key={i} style={styles.photoThumb}>
                      <Image source={{ uri: p }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Footer: customer + actions */}
              <View style={styles.footer}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                  <Feather name="user" size={13} color={t.colors.mutedText} />
                  <Text style={[t.type.bodySm, { color: t.colors.onSurfaceSecondary, fontFamily: "DMSansMedium" }]} numberOfLines={1}>
                    {r.user_name || "Customer"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => remove(r)}
                  disabled={!!deleting[r.id]}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete review by ${r.user_name || "customer"}`}
                  testID={`review-delete-${r.id}`}
                  style={styles.deleteBtn}
                >
                  {deleting[r.id]
                    ? <ActivityIndicator size="small" color={t.colors.danger} />
                    : <>
                        <Feather name="trash-2" size={14} color={t.colors.danger} />
                        <Text style={{ ...t.type.button, fontSize: 11, color: t.colors.danger }}>Delete</Text>
                      </>}
                </Pressable>
              </View>
            </View>
          )}
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
      padding: 14, backgroundColor: t.colors.surface, borderRadius: t.radius.lg,
      borderWidth: 1, borderColor: t.colors.border,
    },
    prodRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    imgWrap: {
      width: 40, height: 40, borderRadius: t.radius.sm, overflow: "hidden",
      backgroundColor: t.colors.surfaceAlt, alignItems: "center", justifyContent: "center",
    },
    photoThumb: { width: 72, height: 72, borderRadius: t.radius.md, overflow: "hidden", backgroundColor: t.colors.surfaceAlt },
    footer: {
      flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12,
      paddingTop: 10, borderTopWidth: 1, borderTopColor: t.colors.divider,
    },
    deleteBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 12, height: 36, minHeight: 36, borderRadius: 999,
      backgroundColor: t.colors.dangerSoft,
    },
  });
}
