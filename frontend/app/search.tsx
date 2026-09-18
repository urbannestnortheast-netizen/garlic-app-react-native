import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import Feather from "@react-native-vector-icons/feather";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing, type } from "@/src/theme";
import { api } from "@/src/api/client";

type Product = { id: string; name: string; price: number; images: string[]; category?: string };

export default function Search() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const CARD_W = (width - spacing.xl * 2 - spacing.md) / 2;
  const styles = React.useMemo(() => makeStyles(CARD_W), [CARD_W]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<any>(null);

  const doSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const items = await api<Product[]>(`/products?q=${encodeURIComponent(query.trim())}`);
      setResults(items);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q), 250);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [q, doSearch]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="back-btn">
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={styles.searchBox}>
          <Feather name="search" size={18} color={colors.mutedText} />
          <TextInput
            testID="search-input"
            style={styles.searchInput}
            placeholder="Search plates, cushions, candles..."
            placeholderTextColor={colors.mutedText}
            value={q}
            onChangeText={setQ}
            autoFocus
            returnKeyType="search"
          />
          {q.length > 0 && (
            <Pressable onPress={() => setQ("")} testID="clear-search" hitSlop={8}>
              <Feather name="x" size={18} color={colors.mutedText} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxxl }}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.onSurfaceSecondary} />
        ) : q.trim() === "" ? (
          <View style={styles.emptyWrap}>
            <Feather name="search" size={40} color={colors.mutedText} />
            <Text style={styles.emptyTitle}>What are you looking for?</Text>
            <Text style={styles.emptyText}>Try &ldquo;linen napkins&rdquo;, &ldquo;sage bowl&rdquo;, or &ldquo;bouclé cushion&rdquo;.</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No matches for &ldquo;{q}&rdquo;</Text>
            <Text style={styles.emptyText}>Try a broader term or check spelling.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.count}>{results.length} results</Text>
            <View style={styles.grid}>
              {results.map((p) => (
                <Pressable
                  key={p.id}
                  testID={`search-result-${p.id}`}
                  style={styles.card}
                  onPress={() => router.push(`/product/${p.id}`)}
                >
                  <Image source={{ uri: p.images[0] }} style={styles.cardImg} contentFit="cover" />
                  <Text style={styles.cardName} numberOfLines={2}>{p.name}</Text>
                  <Text style={styles.cardPrice}>₹{p.price.toLocaleString("en-IN")}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (CARD_W: number) => StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.xl, paddingBottom: spacing.md },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8 },
  searchInput: { flex: 1, fontFamily: "DMSans", fontSize: 14, color: colors.onSurface, paddingVertical: 4 },
  count: { fontFamily: "DMSansMedium", fontSize: 12, letterSpacing: 1.5, color: colors.mutedText, textTransform: "uppercase", marginBottom: spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, rowGap: spacing.xxl },
  card: { width: CARD_W },
  cardImg: { width: CARD_W, height: CARD_W * 1.2, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  cardName: { fontFamily: "CormorantGaramond", fontSize: 17, color: colors.onSurface, marginTop: spacing.sm, lineHeight: 22 },
  cardPrice: { fontFamily: "DMSansMedium", fontSize: 13, color: colors.onSurface, marginTop: spacing.xs },
  emptyWrap: { alignItems: "center", padding: spacing.xxl, gap: spacing.md, marginTop: spacing.xl },
  emptyTitle: { ...type.displaySM, textAlign: "center" },
  emptyText: { ...type.body, textAlign: "center" },
});
