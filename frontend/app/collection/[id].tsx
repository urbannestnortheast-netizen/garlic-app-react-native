import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, spacing, type } from "@/src/theme";
import { api } from "@/src/api/client";

type Collection = { id: string; name: string; tagline: string; image: string };
type Product = { id: string; name: string; price: number; original_price?: number; images: string[] };

export default function CollectionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const CARD_W = (width - spacing.xl * 2 - spacing.md) / 2;
  const styles = React.useMemo(() => makeStyles(CARD_W), [CARD_W]);
  const [col, setCol] = useState<Collection | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const all = await api<Collection[]>("/collections");
      setCol(all.find((c) => c.id === id) || null);
      const p = await api<Product[]>(`/products?collection=${id}`);
      setProducts(p);
    } catch {}
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="back-btn">
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Collection</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        {col && (
          <View style={styles.hero}>
            <Image source={{ uri: col.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={["transparent", "rgba(44,41,37,0.7)"]} style={StyleSheet.absoluteFill} />
            <View style={styles.heroText}>
              <Text style={styles.heroEyebrow}>CURATED</Text>
              <Text style={styles.heroName}>{col.name}</Text>
              <Text style={styles.heroTag}>{col.tagline}</Text>
            </View>
          </View>
        )}

        {loading ? (
          <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.onSurfaceSecondary} />
        ) : products.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No products yet</Text>
            <Text style={styles.emptyText}>Curated pieces will arrive soon.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {products.map((p) => (
              <Pressable key={p.id} testID={`col-product-${p.id}`} style={styles.card} onPress={() => router.push(`/product/${p.id}`)}>
                <Image source={{ uri: p.images[0] }} style={styles.cardImg} contentFit="cover" />
                <Text style={styles.cardName} numberOfLines={2}>{p.name}</Text>
                <Text style={styles.cardPrice}>₹{p.price.toLocaleString("en-IN")}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (CARD_W: number) => StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.xl, paddingBottom: spacing.md },
  headerTitle: { fontFamily: "CormorantGaramondBold", fontSize: 22, color: colors.onSurface },
  hero: { height: 220, marginHorizontal: spacing.xl, marginBottom: spacing.xl, borderRadius: radius.md, overflow: "hidden", justifyContent: "flex-end" },
  heroText: { padding: spacing.xl },
  heroEyebrow: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: "#F1E7DD" },
  heroName: { fontFamily: "CormorantGaramondBold", fontSize: 36, lineHeight: 40, color: colors.onSurfaceInverse, marginTop: spacing.xs },
  heroTag: { fontFamily: "CormorantGaramond", fontSize: 16, fontStyle: "italic", color: "#F1E7DD", marginTop: spacing.xs },
  grid: { paddingHorizontal: spacing.xl, flexDirection: "row", flexWrap: "wrap", gap: spacing.md, rowGap: spacing.xxl },
  card: { width: CARD_W },
  cardImg: { width: CARD_W, height: CARD_W * 1.2, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  cardName: { fontFamily: "CormorantGaramond", fontSize: 17, color: colors.onSurface, marginTop: spacing.sm, lineHeight: 22 },
  cardPrice: { fontFamily: "DMSansMedium", fontSize: 13, color: colors.onSurface, marginTop: spacing.xs },
  emptyWrap: { alignItems: "center", padding: spacing.xxl, gap: spacing.sm },
  emptyTitle: { ...type.displaySM },
  emptyText: { ...type.body, textAlign: "center" },
});
