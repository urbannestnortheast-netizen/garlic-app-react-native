import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Dimensions } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, spacing, type } from "@/src/theme";
import { api } from "@/src/api/client";

const { width } = Dimensions.get("window");

type Collection = { id: string; name: string; tagline: string; image: string };

export default function CollectionsList() {
  const router = useRouter();
  const [cols, setCols] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setCols(await api<Collection[]>("/collections")); } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="back-btn">
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Collections</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl }}>
        <Text style={styles.eyebrow}>DESIGNED WITH INTENTION</Text>
        <Text style={styles.title}>Every piece tells a story</Text>

        {loading ? (
          <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.onSurfaceSecondary} />
        ) : (
          cols.map((c) => (
            <Pressable
              key={c.id}
              testID={`collections-list-${c.id}`}
              style={styles.card}
              onPress={() => router.push(`/collection/${c.id}`)}
            >
              <Image source={{ uri: c.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <LinearGradient colors={["transparent", "rgba(44,41,37,0.7)"]} style={StyleSheet.absoluteFill} />
              <View style={styles.cardText}>
                <Text style={styles.cardName}>{c.name}</Text>
                <Text style={styles.cardTag}>{c.tagline}</Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.xl, paddingBottom: spacing.md },
  headerTitle: { fontFamily: "CormorantGaramondBold", fontSize: 22, color: colors.onSurface },
  eyebrow: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: colors.mutedText },
  title: { ...type.displayLG, marginTop: spacing.xs, marginBottom: spacing.md },
  card: { height: 200, borderRadius: radius.md, overflow: "hidden", justifyContent: "flex-end", backgroundColor: colors.surfaceSecondary },
  cardText: { padding: spacing.xl },
  cardName: { fontFamily: "CormorantGaramondBold", fontSize: 28, color: colors.onSurfaceInverse, lineHeight: 32 },
  cardTag: { fontFamily: "CormorantGaramond", fontSize: 15, fontStyle: "italic", color: "#F1E7DD", marginTop: spacing.xs },
});
