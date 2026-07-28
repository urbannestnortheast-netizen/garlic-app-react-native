import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing, type } from "@/src/theme";
import { api } from "@/src/api/client";

const { width } = Dimensions.get("window");
const CARD_W = (width - spacing.xl * 2 - spacing.md) / 2;

type Sub = { id: string; name: string; image: string };
type Category = { id: string; name: string; image: string; subcategories: Sub[] };
type Product = { id: string; name: string; price: number; original_price?: number; images: string[] };

export default function CategoryDetail() {
  const { id, sub } = useLocalSearchParams<{ id: string; sub?: string }>();
  const router = useRouter();
  const [cat, setCat] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeSub, setActiveSub] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sub) setActiveSub(sub);
  }, [sub]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const c = await api<Category>(`/categories/${id}`);
      setCat(c);
      const query = activeSub === "all" ? `?category=${id}` : `?subcategory=${activeSub}`;
      const p = await api<Product[]>(`/products${query}`);
      setProducts(p);
    } catch {}
    finally { setLoading(false); }
  }, [id, activeSub]);

  useEffect(() => { load(); }, [load]);

  if (!cat && loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.onSurfaceSecondary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="back-btn">
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>{cat?.name}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
      >
        {/* Sticky subcategory chips */}
        <View style={styles.chipContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {[{ id: "all", name: "All" }, ...(cat?.subcategories || [])].map((s) => {
              const active = s.id === activeSub;
              return (
                <Pressable
                  key={s.id}
                  testID={`sub-chip-${s.id}`}
                  onPress={() => setActiveSub(s.id)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.onSurfaceSecondary} />
        ) : products.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptyText}>Check back soon for new arrivals.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {products.map((p) => (
              <Pressable
                key={p.id}
                testID={`product-card-${p.id}`}
                style={styles.card}
                onPress={() => router.push(`/product/${p.id}`)}
              >
                <View>
                  <Image source={{ uri: p.images[0] }} style={styles.cardImg} contentFit="cover" />
                  {p.original_price && p.original_price > p.price && (
                    <View style={styles.saleTag}><Text style={styles.saleText}>SALE</Text></View>
                  )}
                </View>
                <Text style={styles.cardName} numberOfLines={2}>{p.name}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.cardPrice}>₹{p.price.toLocaleString("en-IN")}</Text>
                  {p.original_price && p.original_price > p.price && (
                    <Text style={styles.origPrice}>₹{p.original_price.toLocaleString("en-IN")}</Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: spacing.xl, paddingBottom: spacing.md,
  },
  headerTitle: { fontFamily: "CormorantGaramondBold", fontSize: 24, color: colors.onSurface },
  chipContainer: { backgroundColor: colors.surface, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  chipRow: { paddingHorizontal: spacing.xl, gap: spacing.sm, alignItems: "center" },
  chip: { height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: colors.brand },
  chipText: { fontFamily: "DMSans", color: colors.onSurface, fontSize: 13 },
  chipTextActive: { color: colors.onBrandPrimary, fontFamily: "DMSansMedium" },
  grid: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, flexDirection: "row", flexWrap: "wrap", gap: spacing.md, rowGap: spacing.xxl },
  card: { width: CARD_W },
  cardImg: { width: CARD_W, height: CARD_W * 1.2, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  saleTag: { position: "absolute", top: spacing.sm, left: spacing.sm, backgroundColor: colors.sale, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  saleText: { fontFamily: "DMSansBold", fontSize: 9, color: colors.onSurfaceInverse, letterSpacing: 1 },
  cardName: { fontFamily: "CormorantGaramond", fontSize: 17, color: colors.onSurface, marginTop: spacing.sm, lineHeight: 22 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  cardPrice: { fontFamily: "DMSansMedium", fontSize: 13, color: colors.onSurface },
  origPrice: { fontFamily: "DMSans", fontSize: 12, color: colors.mutedText, textDecorationLine: "line-through" },
  emptyWrap: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm, marginTop: spacing.xl },
  emptyTitle: { ...type.displaySM },
  emptyText: { ...type.body, textAlign: "center" },
});
