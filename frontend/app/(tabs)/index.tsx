import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing, type } from "@/src/theme";
import { api } from "@/src/api/client";

const { width } = Dimensions.get("window");
const CARD_W = (width - spacing.xl * 2 - spacing.md) / 2;

type Product = { id: string; name: string; price: number; category: string; images: string[]; featured?: boolean };
type Category = { id: string; name: string; image: string };

const ALL: Category = { id: "all", name: "All", image: "" };

export default function ShopScreen() {
  const router = useRouter();
  const [cats, setCats] = useState<Category[]>([ALL]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCat, setActiveCat] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([
        api<Category[]>("/categories"),
        api<Product[]>(activeCat === "all" ? "/products" : `/products?category=${activeCat}`),
      ]);
      setCats([ALL, ...c]);
      setProducts(p);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeCat]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const featured = products.filter((p) => p.featured).slice(0, 4);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header} testID="shop-header">
        <Image
          source={require("@/assets/brand/garlic-logo.jpg")}
          style={styles.headerLogo}
          contentFit="contain"
          testID="header-logo"
        />
        <Pressable
          testID="search-button"
          onPress={() => router.push("/(tabs)/wishlist")}
          hitSlop={12}
        >
          <Feather name="heart" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView
        stickyHeaderIndices={[0]}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.onSurfaceSecondary}
          />
        }
      >
        {/* Sticky category chips */}
        <View style={styles.chipContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {cats.map((c) => {
              const active = c.id === activeCat;
              return (
                <Pressable
                  key={c.id}
                  testID={`category-chip-${c.id}`}
                  onPress={() => setActiveCat(c.id)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Featured hero */}
        {activeCat === "all" && featured.length > 0 && (
          <View style={styles.heroWrap}>
            <Text style={styles.sectionEyebrow}>THIS SEASON</Text>
            <Text style={styles.sectionTitle}>Curated Editorials</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}
              style={{ marginTop: spacing.md }}
            >
              {featured.map((p) => (
                <Pressable
                  key={p.id}
                  testID={`featured-${p.id}`}
                  style={styles.featCard}
                  onPress={() => router.push(`/product/${p.id}`)}
                >
                  <Image source={{ uri: p.images[0] }} style={styles.featImg} contentFit="cover" transition={300} />
                  <Text style={styles.featName} numberOfLines={2}>{p.name}</Text>
                  <Text style={styles.featPrice}>₹{p.price.toLocaleString("en-IN")}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Products grid */}
        <View style={styles.gridSection}>
          <Text style={styles.sectionEyebrow}>THE COLLECTION</Text>
          <Text style={styles.sectionTitle}>
            {cats.find((c) => c.id === activeCat)?.name || "All"}
          </Text>
          {loading ? (
            <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.onSurfaceSecondary} />
          ) : products.length === 0 ? (
            <Text style={styles.empty} testID="empty-state">No products yet in this collection.</Text>
          ) : (
            <View style={styles.grid}>
              {products.map((p) => (
                <Pressable
                  key={p.id}
                  testID={`product-card-${p.id}`}
                  style={styles.card}
                  onPress={() => router.push(`/product/${p.id}`)}
                >
                  <Image source={{ uri: p.images[0] }} style={styles.cardImg} contentFit="cover" transition={200} />
                  <Text style={styles.cardName} numberOfLines={2}>{p.name}</Text>
                  <Text style={styles.cardPrice}>₹{p.price.toLocaleString("en-IN")}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl, paddingBottom: spacing.md, paddingTop: spacing.sm,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.surface,
  },
  headerLogo: { width: 130, aspectRatio: 802 / 469 },
  brandSmall: { fontFamily: "DMSansMedium", fontSize: 10, letterSpacing: 2.5, color: colors.mutedText },
  brand: { fontFamily: "CormorantGaramondBold", fontSize: 34, color: colors.onSurface, lineHeight: 40 },
  chipContainer: { backgroundColor: colors.surface, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  chipRow: { paddingHorizontal: spacing.xl, gap: spacing.sm, alignItems: "center" },
  chip: {
    height: 36, paddingHorizontal: spacing.lg, borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: "transparent",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.onSurface, borderColor: colors.onSurface },
  chipText: { fontFamily: "DMSans", color: colors.onSurface, fontSize: 13 },
  chipTextActive: { color: colors.onSurfaceInverse, fontFamily: "DMSansMedium" },
  heroWrap: { paddingTop: spacing.xl },
  sectionEyebrow: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: colors.mutedText, paddingHorizontal: spacing.xl },
  sectionTitle: { ...type.displayMD, paddingHorizontal: spacing.xl, marginTop: spacing.xs },
  featCard: { width: width * 0.62 },
  featImg: { width: "100%", height: 260, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  featName: { fontFamily: "CormorantGaramond", fontSize: 20, color: colors.onSurface, marginTop: spacing.md, lineHeight: 24 },
  featPrice: { fontFamily: "DMSansMedium", fontSize: 14, color: colors.onSurfaceSecondary, marginTop: spacing.xs },
  gridSection: { paddingTop: spacing.xxl },
  empty: { ...type.body, textAlign: "center", marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
  grid: {
    marginTop: spacing.md, paddingHorizontal: spacing.xl, flexDirection: "row", flexWrap: "wrap",
    gap: spacing.md, rowGap: spacing.xxl,
  },
  card: { width: CARD_W },
  cardImg: { width: CARD_W, height: CARD_W * 1.25, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  cardName: { fontFamily: "CormorantGaramond", fontSize: 17, color: colors.onSurface, marginTop: spacing.sm, lineHeight: 22 },
  cardPrice: { fontFamily: "DMSansMedium", fontSize: 13, color: colors.onSurfaceSecondary, marginTop: spacing.xs },
});
