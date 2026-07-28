import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Dimensions } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing, tilePalette, type } from "@/src/theme";
import { api } from "@/src/api/client";

const { width } = Dimensions.get("window");
const CARD_W = (width - spacing.xl * 2 - spacing.md) / 2;

type Tag = { id: string; name: string };
type Product = { id: string; name: string; price: number; images: string[] };

export default function Gifts() {
  const router = useRouter();
  const [persons, setPersons] = useState<Tag[]>([]);
  const [occasions, setOccasions] = useState<Tag[]>([]);
  const [mode, setMode] = useState<"person" | "occasion">("person");
  const [activeTag, setActiveTag] = useState<string>("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [p, o] = await Promise.all([
          api<Tag[]>("/gift-persons"),
          api<Tag[]>("/gift-occasions"),
        ]);
        setPersons(p);
        setOccasions(o);
        if (p.length) setActiveTag(p[0].id);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const loadProducts = useCallback(async () => {
    if (!activeTag) return;
    setLoading(true);
    try {
      const key = mode === "person" ? "gift_person" : "gift_occasion";
      const p = await api<Product[]>(`/products?${key}=${activeTag}`);
      setProducts(p);
    } catch {}
    finally { setLoading(false); }
  }, [activeTag, mode]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const tags = mode === "person" ? persons : occasions;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="back-btn">
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Gifts</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
      >
        <View style={styles.stickyWrap}>
          <View style={styles.hero}>
            <Text style={styles.heroEyebrow}>THOUGHTFUL GIFTING</Text>
            <Text style={styles.heroTitle}>Give with{"\n"}intention.</Text>
          </View>

          <View style={styles.modeSwitch}>
            <Pressable
              testID="mode-person"
              style={[styles.modeBtn, mode === "person" && styles.modeBtnActive]}
              onPress={() => { setMode("person"); if (persons[0]) setActiveTag(persons[0].id); }}
            >
              <Text style={[styles.modeText, mode === "person" && styles.modeTextActive]}>By Person</Text>
            </Pressable>
            <Pressable
              testID="mode-occasion"
              style={[styles.modeBtn, mode === "occasion" && styles.modeBtnActive]}
              onPress={() => { setMode("occasion"); if (occasions[0]) setActiveTag(occasions[0].id); }}
            >
              <Text style={[styles.modeText, mode === "occasion" && styles.modeTextActive]}>By Occasion</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {tags.map((t, i) => {
              const on = t.id === activeTag;
              const bg = tilePalette[i % tilePalette.length];
              return (
                <Pressable
                  key={t.id}
                  testID={`gift-tag-${t.id}`}
                  onPress={() => setActiveTag(t.id)}
                  style={[styles.chip, on ? styles.chipActive : { backgroundColor: bg }]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextActive]}>{t.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.onSurfaceSecondary} />
        ) : products.length === 0 ? (
          <View style={styles.emptyWrap} testID="gifts-empty">
            <Feather name="gift" size={40} color={colors.mutedText} />
            <Text style={styles.emptyTitle}>No gifts for this yet</Text>
            <Text style={styles.emptyText}>Try another category or occasion.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {products.map((p) => (
              <Pressable
                key={p.id}
                testID={`gift-product-${p.id}`}
                style={styles.card}
                onPress={() => router.push(`/product/${p.id}`)}
              >
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

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.xl, paddingBottom: spacing.md },
  headerTitle: { fontFamily: "CormorantGaramondBold", fontSize: 22, color: colors.onSurface },
  stickyWrap: { backgroundColor: colors.surface, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  hero: {
    marginHorizontal: spacing.xl, backgroundColor: colors.accentLight,
    padding: spacing.xl, borderRadius: radius.lg, marginBottom: spacing.lg,
  },
  heroEyebrow: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: colors.brandDark },
  heroTitle: { fontFamily: "CormorantGaramondBold", fontSize: 32, lineHeight: 36, color: colors.onSurface, marginTop: spacing.sm },
  modeSwitch: { flexDirection: "row", marginHorizontal: spacing.xl, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, padding: 4, marginBottom: spacing.md },
  modeBtn: { flex: 1, paddingVertical: spacing.md, alignItems: "center", borderRadius: radius.pill },
  modeBtnActive: { backgroundColor: colors.surface },
  modeText: { fontFamily: "DMSans", fontSize: 13, color: colors.onSurfaceSecondary },
  modeTextActive: { fontFamily: "DMSansMedium", color: colors.onSurface },
  chipRow: { paddingHorizontal: spacing.xl, gap: spacing.sm, alignItems: "center", paddingVertical: spacing.sm },
  chip: { paddingHorizontal: spacing.lg, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: colors.brand },
  chipText: { fontFamily: "DMSans", fontSize: 13, color: colors.onSurface },
  chipTextActive: { color: colors.onBrandPrimary, fontFamily: "DMSansMedium" },
  grid: { padding: spacing.xl, paddingTop: spacing.xl, flexDirection: "row", flexWrap: "wrap", gap: spacing.md, rowGap: spacing.xxl },
  card: { width: CARD_W },
  cardImg: { width: CARD_W, height: CARD_W * 1.2, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  cardName: { fontFamily: "CormorantGaramond", fontSize: 17, color: colors.onSurface, marginTop: spacing.sm, lineHeight: 22 },
  cardPrice: { fontFamily: "DMSansMedium", fontSize: 13, color: colors.onSurface, marginTop: spacing.xs },
  emptyWrap: { alignItems: "center", padding: spacing.xxl, gap: spacing.md, marginTop: spacing.xl },
  emptyTitle: { ...type.displaySM, marginTop: spacing.md },
  emptyText: { ...type.body, textAlign: "center" },
});
