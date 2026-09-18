import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  Share, Platform, useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import Feather from "@react-native-vector-icons/feather";
import { useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { colors, radius, spacing, type } from "@/src/theme";
import { api, BACKEND_URL } from "@/src/api/client";

type ShortlistProduct = { id: string; name: string; price: number; images: string[]; bought: boolean };
type Shortlist = {
  id: string; name: string; occasion: string; message: string;
  cover_image: string; share_slug: string; products: ShortlistProduct[]; count: number;
  owner_name: string;
};

export default function ShortlistDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const CARD_W = (width - spacing.xl * 2 - spacing.md) / 2;
  const styles = React.useMemo(() => makeStyles(CARD_W), [CARD_W]);
  const [sl, setSl] = useState<Shortlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api<Shortlist>(`/shortlists/${id}`, { auth: true });
      setSl(data);
    } catch {}
    finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const shareUrl = sl ? `${BACKEND_URL}/shortlist/share/${sl.share_slug}` : "";

  const onShare = async () => {
    if (!sl) return;
    const msg = `Check out my Nest Table: ${sl.name}\n${shareUrl}`;
    if (Platform.OS === "web") {
      await Clipboard.setStringAsync(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      await Share.share({ message: msg });
    }
  };

  const remove = async (product_id: string) => {
    if (!sl) return;
    try {
      const updated = await api<Shortlist>(`/shortlists/${sl.id}/items/${product_id}`, { method: "DELETE", auth: true });
      setSl(updated);
    } catch {}
  };

  const del = async () => {
    if (!sl) return;
    try {
      await api(`/shortlists/${sl.id}`, { method: "DELETE", auth: true });
      router.replace("/shortlists");
    } catch {}
  };

  if (loading || !sl) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.onSurfaceSecondary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="back-btn">
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{sl.name}</Text>
        <Pressable onPress={del} hitSlop={12} testID="delete-shortlist-btn">
          <Feather name="trash-2" size={20} color={colors.error} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
        <View style={styles.hero}>
          {sl.occasion ? <Text style={styles.heroEyebrow}>{sl.occasion.toUpperCase()}</Text> : null}
          <Text style={styles.heroTitle}>{sl.name}</Text>
          {sl.message ? <Text style={styles.heroMsg}>&ldquo;{sl.message}&rdquo;</Text> : null}

          <View style={styles.shareBox}>
            <Text style={styles.shareUrl} numberOfLines={1}>{shareUrl}</Text>
            <Pressable style={styles.shareBtn} onPress={onShare} testID="share-btn">
              <Feather name={copied ? "check" : "share-2"} size={16} color={colors.onBrandPrimary} />
              <Text style={styles.shareBtnText}>{copied ? "Copied" : "Share"}</Text>
            </Pressable>
          </View>
        </View>

        {sl.products.length === 0 ? (
          <View style={styles.emptyWrap} testID="shortlist-empty">
            <Feather name="bookmark" size={40} color={colors.mutedText} />
            <Text style={styles.emptyTitle}>Add products from anywhere</Text>
            <Text style={styles.emptyText}>Tap {'\u201C'}Add to Nest Table{'\u201D'} on any product to include it here.</Text>
            <Pressable style={styles.cta} onPress={() => router.replace("/(tabs)")} testID="browse-btn">
              <Text style={styles.ctaText}>Explore Shop</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.grid}>
            {sl.products.map((p) => (
              <View key={p.id} style={styles.card}>
                <Pressable onPress={() => router.push(`/product/${p.id}`)} testID={`sl-product-${p.id}`}>
                  <Image source={{ uri: p.images[0] }} style={styles.cardImg} contentFit="cover" />
                  {p.bought && (
                    <View style={styles.boughtBadge}>
                      <Text style={styles.boughtText}>GIFTED</Text>
                    </View>
                  )}
                </Pressable>
                <Text style={styles.cardName} numberOfLines={2}>{p.name}</Text>
                <View style={styles.cardFoot}>
                  <Text style={styles.cardPrice}>₹{p.price.toLocaleString("en-IN")}</Text>
                  <Pressable onPress={() => remove(p.id)} testID={`remove-${p.id}`} hitSlop={8}>
                    <Feather name="x" size={16} color={colors.mutedText} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (CARD_W: number) => StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.xl, paddingBottom: spacing.md, gap: spacing.md },
  headerTitle: { flex: 1, fontFamily: "CormorantGaramondBold", fontSize: 20, color: colors.onSurface, textAlign: "center" },
  hero: { margin: spacing.xl, backgroundColor: colors.accentLight, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm },
  heroEyebrow: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: colors.brandDark },
  heroTitle: { fontFamily: "CormorantGaramondBold", fontSize: 30, lineHeight: 34, color: colors.onSurface, marginTop: spacing.xs },
  heroMsg: { fontFamily: "CormorantGaramond", fontSize: 16, fontStyle: "italic", color: colors.onSurfaceSecondary, marginTop: spacing.sm },
  shareBox: { marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", padding: 4, paddingLeft: spacing.md, gap: spacing.sm },
  shareUrl: { flex: 1, fontFamily: "DMSans", fontSize: 11, color: colors.mutedText },
  shareBtn: { backgroundColor: colors.brand, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", gap: spacing.xs },
  shareBtnText: { fontFamily: "DMSansBold", fontSize: 11, color: colors.onBrandPrimary, letterSpacing: 1, textTransform: "uppercase" },
  grid: { paddingHorizontal: spacing.xl, flexDirection: "row", flexWrap: "wrap", gap: spacing.md, rowGap: spacing.xxl },
  card: { width: CARD_W },
  cardImg: { width: CARD_W, height: CARD_W * 1.2, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  boughtBadge: { position: "absolute", top: spacing.sm, left: spacing.sm, backgroundColor: colors.success, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  boughtText: { fontFamily: "DMSansBold", fontSize: 9, color: "#1A3024", letterSpacing: 1 },
  cardName: { fontFamily: "CormorantGaramond", fontSize: 17, color: colors.onSurface, marginTop: spacing.sm, lineHeight: 22 },
  cardFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
  cardPrice: { fontFamily: "DMSansMedium", fontSize: 13, color: colors.onSurface },
  emptyWrap: { alignItems: "center", padding: spacing.xxl, gap: spacing.md },
  emptyTitle: { ...type.displaySM, marginTop: spacing.md, textAlign: "center" },
  emptyText: { ...type.body, textAlign: "center" },
  cta: { marginTop: spacing.md, backgroundColor: colors.brand, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, borderRadius: radius.pill },
  ctaText: { color: colors.onBrandPrimary, fontFamily: "DMSansBold", letterSpacing: 1.5, textTransform: "uppercase", fontSize: 13 },
});
