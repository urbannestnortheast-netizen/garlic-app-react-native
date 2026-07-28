import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing, tilePalette, type } from "@/src/theme";
import { api } from "@/src/api/client";
import BrandLogo from "@/src/components/BrandLogo";

const TILE_SIZE = 80;

type Sub = { id: string; name: string; image: string };
type Category = { id: string; name: string; image: string; subcategories: Sub[] };
type Product = { id: string; name: string; price: number; original_price?: number; category: string; images: string[]; featured?: boolean };
type Collection = { id: string; name: string; tagline: string; image: string };
type EditorialTile = { label: string; image: string; filter: { category?: string; subcategory?: string; collection?: string } };
type Editorial = { id: string; title: string; subtitle: string; tiles: EditorialTile[] };

export default function ShopScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const CARD_W = (width - spacing.xl * 2 - spacing.md) / 2;
  const styles = React.useMemo(() => makeStyles(width, CARD_W), [width, CARD_W]);
  const [cats, setCats] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [editorials, setEditorials] = useState<Editorial[]>([]);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, col, ed, feat] = await Promise.all([
        api<Category[]>("/categories"),
        api<Collection[]>("/collections"),
        api<Editorial[]>("/editorials"),
        api<Product[]>("/products?featured=true"),
      ]);
      setCats(c);
      setCollections(col);
      setEditorials(ed);
      setFeatured(feat);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Build round tiles: NEW IN + top subcategories from Dining/Decor
  const roundTiles = React.useMemo(() => {
    const dining = cats.find((c) => c.id === "dining");
    const decor = cats.find((c) => c.id === "decor");
    const kitchen = cats.find((c) => c.id === "kitchen");
    const soft = cats.find((c) => c.id === "soft-furnishing");
    const picks: { key: string; label: string; onPress: () => void; image?: string }[] = [
      { key: "new", label: "NEW", onPress: () => router.push("/(tabs)"), image: undefined },
      { key: "gifts", label: "GIFTS", onPress: () => router.push("/gifts") },
    ];
    if (dining) picks.push({ key: "dinner-sets", label: "DINNERS", onPress: () => router.push("/category/dining?sub=dinner-sets"), image: dining.subcategories.find(s => s.id === "dinner-sets")?.image });
    if (dining) picks.push({ key: "bowls", label: "BOWLS", onPress: () => router.push("/category/dining?sub=bowls"), image: dining.subcategories.find(s => s.id === "bowls")?.image });
    if (dining) picks.push({ key: "platters", label: "PLATTERS", onPress: () => router.push("/category/dining?sub=platters"), image: dining.subcategories.find(s => s.id === "platters")?.image });
    if (decor) picks.push({ key: "decor", label: "DECOR", onPress: () => router.push("/category/decor") });
    if (kitchen) picks.push({ key: "kitchen", label: "KITCHEN", onPress: () => router.push("/category/kitchen") });
    if (dining) picks.push({ key: "glassware", label: "GLASSWARE", onPress: () => router.push("/category/dining?sub=glassware"), image: dining.subcategories.find(s => s.id === "glassware")?.image });
    if (soft) picks.push({ key: "soft", label: "COMFORT", onPress: () => router.push("/category/soft-furnishing") });
    picks.push({ key: "collections", label: "COLLECTIONS", onPress: () => router.push("/collections") });
    return picks;
  }, [cats, router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header} testID="shop-header">
        <BrandLogo size="md" testID="header-logo" />
        <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
          <Pressable testID="search-shortcut" onPress={() => router.push("/search")} hitSlop={12} style={styles.headerHeart}>
            <Feather name="search" size={22} color={colors.onSurface} />
          </Pressable>
          <Pressable testID="wishlist-shortcut" onPress={() => router.push("/(tabs)/wishlist")} hitSlop={12} style={styles.headerHeart}>
            <Feather name="heart" size={22} color={colors.onSurface} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ width, maxWidth: width }}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.onSurfaceSecondary} />
        }
      >
        {/* Promo banner */}
        <View style={styles.promoBanner} testID="promo-banner">
          <View style={{ flex: 1 }}>
            <Text style={styles.promoEyebrow}>SUMMER EDIT</Text>
            <Text style={styles.promoTitle}>Softer{"\n"}Summer Home</Text>
            <Text style={styles.promoSub}>Fresh arrivals for a lighter season</Text>
          </View>
          <Image source={{ uri: "https://images.unsplash.com/photo-1609081144289-eacc3108cd03" }} style={styles.promoImg} contentFit="cover" />
        </View>

        {/* Round category tiles */}
        <View style={styles.tilesSection}>
          <ScrollView
            horizontal
            style={{ width, maxWidth: width }}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tilesRow}
          >
            {roundTiles.map((t, i) => {
              const bg = tilePalette[i % tilePalette.length];
              return (
                <Pressable
                  key={t.key}
                  testID={`round-tile-${t.key}`}
                  style={styles.tile}
                  onPress={t.onPress}
                >
                  <View style={[styles.tileCircle, { backgroundColor: bg }]}>
                    {t.image ? (
                      <Image source={{ uri: t.image }} style={styles.tileImage} contentFit="cover" />
                    ) : t.key === "gifts" ? (
                      <Feather name="gift" size={30} color={colors.onSurface} />
                    ) : t.key === "new" ? (
                      <Text style={styles.tileEmoji}>✨</Text>
                    ) : t.key === "collections" ? (
                      <Feather name="grid" size={26} color={colors.onSurface} />
                    ) : (
                      <Feather name="circle" size={26} color={colors.onSurface} />
                    )}
                  </View>
                  <Text style={styles.tileLabel} numberOfLines={1}>{t.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {loading && <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.onSurfaceSecondary} />}

        {/* Categories row (parent categories) */}
        <View style={styles.section}>
          <Text style={styles.eyebrow}>SHOP BY</Text>
          <Text style={styles.sectionTitle}>Category</Text>
          <View style={styles.catGrid}>
            {cats.map((c) => (
              <Pressable
                key={c.id}
                testID={`cat-${c.id}`}
                style={styles.catCard}
                onPress={() => router.push(`/category/${c.id}`)}
              >
                <Image source={{ uri: c.image }} style={styles.catImg} contentFit="cover" />
                <Text style={styles.catName}>{c.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Editorial sections with 4-image grids */}
        {editorials.map((ed) => (
          <View key={ed.id} style={styles.editorialSection} testID={`editorial-${ed.id}`}>
            <View style={styles.editorialHeader}>
              <View>
                <Text style={styles.eyebrow}>{ed.subtitle.toUpperCase()}</Text>
                <Text style={styles.sectionTitle}>{ed.title}</Text>
              </View>
            </View>
            <View style={styles.editorialGrid}>
              {ed.tiles.map((t, i) => (
                <Pressable
                  key={i}
                  testID={`editorial-tile-${ed.id}-${i}`}
                  style={styles.editorialTile}
                  onPress={() => {
                    if (t.filter.subcategory) {
                      const parent = cats.find(c => c.subcategories.some(s => s.id === t.filter.subcategory));
                      if (parent) router.push(`/category/${parent.id}?sub=${t.filter.subcategory}`);
                    } else if (t.filter.category) {
                      router.push(`/category/${t.filter.category}`);
                    } else if (t.filter.collection) {
                      router.push(`/collection/${t.filter.collection}`);
                    }
                  }}
                >
                  <Image source={{ uri: t.image }} style={styles.editorialImg} contentFit="cover" />
                  <Text style={styles.editorialLabel} numberOfLines={1}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* Curated Collections */}
        {collections.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.eyebrow}>CURATED</Text>
            <Text style={styles.sectionTitle}>Collections</Text>
            <ScrollView
              horizontal
              style={{ width, maxWidth: width }}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
              {collections.map((col) => (
                <Pressable
                  key={col.id}
                  testID={`collection-${col.id}`}
                  style={styles.collectionCard}
                  onPress={() => router.push(`/collection/${col.id}`)}
                >
                  <Image source={{ uri: col.image }} style={styles.collectionImg} contentFit="cover" />
                  <View style={styles.collectionOverlay} />
                  <View style={styles.collectionText}>
                    <Text style={styles.collectionName}>{col.name}</Text>
                    <Text style={styles.collectionTag}>{col.tagline}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Featured Products */}
        {featured.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.eyebrow}>BEST SELLERS</Text>
            <Text style={styles.sectionTitle}>Loved by You</Text>
            <View style={styles.grid}>
              {featured.map((p) => (
                <Pressable
                  key={p.id}
                  testID={`product-card-${p.id}`}
                  style={styles.card}
                  onPress={() => router.push(`/product/${p.id}`)}
                >
                  <View>
                    <Image source={{ uri: p.images[0] }} style={styles.cardImg} contentFit="cover" />
                    {p.original_price && p.original_price > p.price && (
                      <View style={styles.saleTag} testID={`sale-tag-${p.id}`}>
                        <Text style={styles.saleText}>SALE</Text>
                      </View>
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
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (width: number, CARD_W: number) => StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl, paddingBottom: spacing.md, paddingTop: spacing.sm,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.surface,
  },
  headerHeart: { padding: spacing.sm },

  promoBanner: {
    marginHorizontal: spacing.xl, marginTop: spacing.sm,
    backgroundColor: colors.accentLight, borderRadius: radius.lg,
    flexDirection: "row", padding: spacing.lg, gap: spacing.md,
    alignItems: "center", overflow: "hidden",
    minHeight: 130,
  },
  promoEyebrow: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: colors.brandDark },
  promoTitle: { fontFamily: "CormorantGaramondBold", fontSize: 26, lineHeight: 30, color: colors.onSurface, marginTop: spacing.xs },
  promoSub: { fontFamily: "DMSans", fontSize: 12, color: colors.onSurfaceSecondary, marginTop: spacing.xs },
  promoImg: { width: 100, height: 110, borderRadius: radius.md, backgroundColor: colors.brandTertiary },

  tilesSection: { paddingVertical: spacing.lg },
  tilesRow: { paddingHorizontal: spacing.xl, gap: spacing.lg, alignItems: "center" },
  tile: { alignItems: "center", width: TILE_SIZE, gap: spacing.sm },
  tileCircle: {
    width: TILE_SIZE, height: TILE_SIZE, borderRadius: TILE_SIZE / 2,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  tileImage: { width: "100%", height: "100%" },
  tileEmoji: { fontSize: 30 },
  tileLabel: { fontFamily: "DMSansMedium", fontSize: 10, letterSpacing: 1.2, color: colors.onSurface, textAlign: "center" },

  section: { marginTop: spacing.xxl },
  eyebrow: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: colors.mutedText, paddingHorizontal: spacing.xl },
  sectionTitle: { fontFamily: "CormorantGaramondBold", fontSize: 26, color: colors.onSurface, paddingHorizontal: spacing.xl, marginTop: spacing.xs },

  catGrid: { paddingHorizontal: spacing.xl, marginTop: spacing.lg, flexDirection: "row", flexWrap: "wrap", gap: spacing.md, rowGap: spacing.lg },
  catCard: { width: CARD_W },
  catImg: { width: CARD_W, height: CARD_W * 0.75, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  catName: { fontFamily: "CormorantGaramond", fontSize: 18, color: colors.onSurface, marginTop: spacing.sm, textAlign: "center" },

  editorialSection: { marginTop: spacing.xxl },
  editorialHeader: { paddingHorizontal: spacing.xl },
  editorialGrid: {
    paddingHorizontal: spacing.xl, marginTop: spacing.lg,
    flexDirection: "row", flexWrap: "wrap", gap: spacing.md, rowGap: spacing.lg,
  },
  editorialTile: { width: CARD_W },
  editorialImg: { width: CARD_W, height: CARD_W, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  editorialLabel: { fontFamily: "DMSansMedium", fontSize: 13, color: colors.onSurface, marginTop: spacing.sm, textAlign: "center", letterSpacing: 0.5 },

  collectionCard: { width: width * 0.7, height: 200, borderRadius: radius.md, overflow: "hidden" },
  collectionImg: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.surfaceSecondary },
  collectionOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(44,41,37,0.35)" },
  collectionText: { position: "absolute", bottom: spacing.lg, left: spacing.lg, right: spacing.lg },
  collectionName: { fontFamily: "CormorantGaramondBold", fontSize: 24, color: colors.onSurfaceInverse, lineHeight: 28 },
  collectionTag: { fontFamily: "DMSans", fontSize: 12, color: colors.onSurfaceInverse, marginTop: spacing.xs, fontStyle: "italic" },

  grid: {
    marginTop: spacing.lg, paddingHorizontal: spacing.xl, flexDirection: "row", flexWrap: "wrap",
    gap: spacing.md, rowGap: spacing.xxl,
  },
  card: { width: CARD_W },
  cardImg: { width: CARD_W, height: CARD_W * 1.2, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  saleTag: { position: "absolute", top: spacing.sm, left: spacing.sm, backgroundColor: colors.sale, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  saleText: { fontFamily: "DMSansBold", fontSize: 9, color: colors.onSurfaceInverse, letterSpacing: 1 },
  cardName: { fontFamily: "CormorantGaramond", fontSize: 17, color: colors.onSurface, marginTop: spacing.sm, lineHeight: 22 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  cardPrice: { fontFamily: "DMSansMedium", fontSize: 13, color: colors.onSurface },
  origPrice: { fontFamily: "DMSans", fontSize: 12, color: colors.mutedText, textDecorationLine: "line-through" },
});
