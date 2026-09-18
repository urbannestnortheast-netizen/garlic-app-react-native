import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import Feather from "@react-native-vector-icons/feather";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing, type } from "@/src/theme";
import { api } from "@/src/api/client";

type ShortlistProduct = { id: string; name: string; price: number; images: string[]; bought: boolean };
type Shortlist = {
  name: string; occasion: string; message: string; owner_name: string;
  share_slug: string; products: ShortlistProduct[]; count: number;
};

export default function PublicShortlist() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const CARD_W = (width - spacing.xl * 2 - spacing.md) / 2;
  const styles = React.useMemo(() => makeStyles(CARD_W), [CARD_W]);
  const [sl, setSl] = useState<Shortlist | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const data = await api<Shortlist>(`/shortlists/share/${slug}`);
      setSl(data);
    } catch {}
    finally { setLoading(false); }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  const markBought = async (product_id: string) => {
    if (!slug) return;
    try {
      const updated = await api<Shortlist>(`/shortlists/share/${slug}/mark-bought`, {
        method: "POST",
        body: { product_id },
      });
      setSl(updated);
    } catch {}
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.onSurfaceSecondary} />
      </View>
    );
  }

  if (!sl) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={styles.notFound}>
          <Feather name="alert-circle" size={40} color={colors.mutedText} />
          <Text style={styles.emptyTitle}>Nest Table not found</Text>
          <Pressable style={styles.cta} onPress={() => router.replace("/")}>
            <Text style={styles.ctaText}>Go to Garlic</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace("/")} hitSlop={12}>
          <Feather name="x" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>A Nest Table</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        <View style={styles.hero}>
          <Text style={styles.owner}>{sl.owner_name} INVITES YOU</Text>
          {sl.occasion ? <Text style={styles.occasion}>{sl.occasion}</Text> : null}
          <Text style={styles.name}>{sl.name}</Text>
          {sl.message ? <Text style={styles.msg}>&ldquo;{sl.message}&rdquo;</Text> : null}
          <Text style={styles.tip}>Tap {'\u201C'}Mark as Gifted{'\u201D'} so others don{'\u2019'}t buy twice.</Text>
        </View>

        {sl.products.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>This list is empty</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {sl.products.map((p) => (
              <View key={p.id} style={styles.card} testID={`public-item-${p.id}`}>
                <Pressable onPress={() => router.push(`/product/${p.id}`)}>
                  <Image source={{ uri: p.images[0] }} style={[styles.cardImg, p.bought && { opacity: 0.4 }]} contentFit="cover" />
                  {p.bought && (
                    <View style={styles.gifted}>
                      <Feather name="check" size={22} color={colors.onSurfaceInverse} />
                      <Text style={styles.giftedText}>GIFTED</Text>
                    </View>
                  )}
                </Pressable>
                <Text style={styles.cardName} numberOfLines={2}>{p.name}</Text>
                <Text style={styles.cardPrice}>₹{p.price.toLocaleString("en-IN")}</Text>
                {!p.bought && (
                  <Pressable
                    style={styles.markBtn}
                    onPress={() => markBought(p.id)}
                    testID={`mark-bought-${p.id}`}
                  >
                    <Text style={styles.markText}>Mark as Gifted</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (CARD_W: number) => StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.xl, paddingBottom: spacing.md },
  headerTitle: { fontFamily: "CormorantGaramondBold", fontSize: 20, color: colors.onSurface },
  hero: { margin: spacing.xl, backgroundColor: colors.accentLight, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, alignItems: "center" },
  owner: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: colors.brandDark },
  occasion: { fontFamily: "CormorantGaramond", fontSize: 16, fontStyle: "italic", color: colors.onSurfaceSecondary },
  name: { fontFamily: "CormorantGaramondBold", fontSize: 32, lineHeight: 36, color: colors.onSurface, textAlign: "center", marginTop: spacing.sm },
  msg: { fontFamily: "CormorantGaramond", fontSize: 16, fontStyle: "italic", color: colors.onSurfaceSecondary, textAlign: "center", marginTop: spacing.sm },
  tip: { fontFamily: "DMSans", fontSize: 12, color: colors.mutedText, textAlign: "center", marginTop: spacing.md },
  grid: { paddingHorizontal: spacing.xl, flexDirection: "row", flexWrap: "wrap", gap: spacing.md, rowGap: spacing.xxl },
  card: { width: CARD_W },
  cardImg: { width: CARD_W, height: CARD_W * 1.2, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  gifted: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(74,95,69,0.7)", borderRadius: radius.md, gap: spacing.xs },
  giftedText: { fontFamily: "DMSansBold", fontSize: 12, letterSpacing: 2, color: colors.onSurfaceInverse },
  cardName: { fontFamily: "CormorantGaramond", fontSize: 17, color: colors.onSurface, marginTop: spacing.sm, lineHeight: 22 },
  cardPrice: { fontFamily: "DMSansMedium", fontSize: 13, color: colors.onSurface, marginTop: spacing.xs },
  markBtn: { marginTop: spacing.sm, backgroundColor: colors.brandLight, paddingVertical: spacing.sm, borderRadius: radius.pill, alignItems: "center" },
  markText: { fontFamily: "DMSansMedium", fontSize: 11, color: colors.brandDark, letterSpacing: 1, textTransform: "uppercase" },
  emptyWrap: { alignItems: "center", padding: spacing.xxl },
  emptyTitle: { ...type.displaySM },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xxl },
  cta: { backgroundColor: colors.brand, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, borderRadius: radius.pill },
  ctaText: { color: colors.onBrandPrimary, fontFamily: "DMSansBold", letterSpacing: 1.5, textTransform: "uppercase", fontSize: 13 },
});
