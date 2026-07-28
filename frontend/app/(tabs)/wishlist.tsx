import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, radius, spacing, type } from "@/src/theme";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

type Product = { id: string; name: string; price: number; images: string[] };

export default function Wishlist() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const CARD_W = (width - spacing.xl * 2 - spacing.md) / 2;
  const styles = React.useMemo(() => makeStyles(CARD_W), [CARD_W]);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const data = await api<Product[]>("/wishlist", { auth: true });
      setItems(data);
    } catch {}
    finally { setLoading(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>YOUR</Text>
        <Text style={styles.title}>Wishlist</Text>
      </View>
      {!user ? (
        <View style={styles.emptyWrap} testID="wishlist-signin-required">
          <Feather name="heart" size={40} color={colors.mutedText} />
          <Text style={styles.emptyTitle}>Sign in to save favorites</Text>
          <Text style={styles.emptyText}>Create an account to build your dream nest.</Text>
          <Pressable testID="wishlist-signin-btn" style={styles.cta} onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.ctaText}>Sign In</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.onSurfaceSecondary} />
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap} testID="wishlist-empty">
          <Feather name="heart" size={40} color={colors.mutedText} />
          <Text style={styles.emptyTitle}>Nothing saved yet</Text>
          <Text style={styles.emptyText}>Tap the heart on any product to add it here.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
          <View style={styles.grid}>
            {items.map((p) => (
              <Pressable
                key={p.id}
                testID={`wishlist-item-${p.id}`}
                style={styles.card}
                onPress={() => router.push(`/product/${p.id}`)}
              >
                <Image source={{ uri: p.images[0] }} style={styles.img} contentFit="cover" />
                <Text style={styles.name} numberOfLines={2}>{p.name}</Text>
                <Text style={styles.price}>₹{p.price.toLocaleString("en-IN")}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (CARD_W: number) => StyleSheet.create({
  header: { padding: spacing.xl, paddingBottom: spacing.md },
  eyebrow: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: colors.mutedText },
  title: { ...type.displayLG, marginTop: spacing.xs },
  grid: { paddingHorizontal: spacing.xl, flexDirection: "row", flexWrap: "wrap", gap: spacing.md, rowGap: spacing.xxl },
  card: { width: CARD_W },
  img: { width: CARD_W, height: CARD_W * 1.25, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  name: { fontFamily: "CormorantGaramond", fontSize: 17, color: colors.onSurface, marginTop: spacing.sm },
  price: { fontFamily: "DMSansMedium", fontSize: 13, color: colors.onSurfaceSecondary, marginTop: spacing.xs },
  emptyWrap: { alignItems: "center", padding: spacing.xxl, gap: spacing.md },
  emptyTitle: { ...type.displaySM, marginTop: spacing.md },
  emptyText: { ...type.body, textAlign: "center" },
  cta: { marginTop: spacing.md, backgroundColor: colors.onSurface, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, borderRadius: radius.pill },
  ctaText: { color: colors.onSurfaceInverse, fontFamily: "DMSansBold", letterSpacing: 1.5, textTransform: "uppercase", fontSize: 13 },
});
