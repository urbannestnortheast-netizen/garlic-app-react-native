import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Dimensions, Modal,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { colors, radius, spacing, type } from "@/src/theme";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { useCart } from "@/src/context/CartContext";

const { width } = Dimensions.get("window");

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  images: string[];
  material?: string;
  dimensions?: string;
  stock: number;
};

type Shortlist = { id: string; name: string; occasion: string };

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { add } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [imgIndex, setImgIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [wished, setWished] = useState(false);
  const [added, setAdded] = useState(false);
  const [slModalOpen, setSlModalOpen] = useState(false);
  const [shortlists, setShortlists] = useState<Shortlist[]>([]);
  const [addedToSl, setAddedToSl] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const p = await api<Product>(`/products/${id}`);
      setProduct(p);
      if (user) {
        try {
          const list = await api<Product[]>("/wishlist", { auth: true });
          setWished(list.some((x) => x.id === p.id));
        } catch {}
      }
    } catch {}
    finally { setLoading(false); }
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  const onAdd = () => {
    if (!product) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    add({
      product_id: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0],
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  const onWish = async () => {
    if (!product) return;
    if (!user) return router.push("/(auth)/login");
    Haptics.selectionAsync();
    try {
      const r = await api<{ in_wishlist: boolean }>("/wishlist/toggle", {
        method: "POST", auth: true, body: { product_id: product.id },
      });
      setWished(r.in_wishlist);
    } catch {}
  };

  const openShortlistModal = async () => {
    if (!user) return router.push("/(auth)/login");
    try {
      const lists = await api<Shortlist[]>("/shortlists", { auth: true });
      setShortlists(lists);
      setSlModalOpen(true);
    } catch {}
  };

  const addToShortlist = async (slId: string) => {
    if (!product) return;
    try {
      await api(`/shortlists/${slId}/items`, {
        method: "POST", auth: true, body: { product_id: product.id },
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAddedToSl(slId);
      setTimeout(() => { setSlModalOpen(false); setAddedToSl(null); }, 900);
    } catch {}
  };

  if (loading || !product) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.onSurfaceSecondary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="product-detail-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => setImgIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
            scrollEventThrottle={16}
          >
            {product.images.map((uri, i) => (
              <Image key={i} source={{ uri }} style={{ width, height: width * 1.1 }} contentFit="cover" transition={200} />
            ))}
          </ScrollView>
          <SafeAreaView style={styles.topBar} edges={["top"]}>
            <Pressable testID="back-btn" onPress={() => router.back()} style={styles.iconBtn}>
              <Feather name="arrow-left" size={20} color={colors.onSurface} />
            </Pressable>
            <Pressable testID="wishlist-toggle-btn" onPress={onWish} style={styles.iconBtn}>
              <Feather name={wished ? "heart" : "heart"} size={20} color={wished ? colors.brandPrimary : colors.onSurface} />
            </Pressable>
          </SafeAreaView>
          {product.images.length > 1 && (
            <View style={styles.dots}>
              {product.images.map((_, i) => (
                <View key={i} style={[styles.dot, i === imgIndex && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.category}>{product.category.toUpperCase().replace("-", " ")}</Text>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.price}>₹{product.price.toLocaleString("en-IN")}</Text>
          <View style={styles.divider} />
          <Text style={styles.desc}>{product.description}</Text>
          {(product.material || product.dimensions) && (
            <View style={styles.metaBox}>
              {product.material ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>Material</Text>
                  <Text style={styles.metaVal}>{product.material}</Text>
                </View>
              ) : null}
              {product.dimensions ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaKey}>Dimensions</Text>
                  <Text style={styles.metaVal}>{product.dimensions}</Text>
                </View>
              ) : null}
            </View>
          )}

          <Pressable style={styles.nestBtn} onPress={openShortlistModal} testID="add-to-nest-btn">
            <Feather name="bookmark" size={16} color={colors.brandDark} />
            <Text style={styles.nestBtnText}>Add to Nest Table</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={slModalOpen} transparent animationType="slide" onRequestClose={() => setSlModalOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Add to Nest Table</Text>
              <Pressable onPress={() => setSlModalOpen(false)} testID="close-sl-modal"><Feather name="x" size={22} color={colors.onSurface} /></Pressable>
            </View>
            {shortlists.length === 0 ? (
              <View style={{ padding: spacing.lg, alignItems: "center", gap: spacing.md }}>
                <Text style={{ ...type.body, textAlign: "center" }}>No Nest Tables yet.</Text>
                <Pressable
                  style={styles.newSlBtn}
                  onPress={() => { setSlModalOpen(false); router.push("/shortlists"); }}
                  testID="go-create-sl-btn"
                >
                  <Text style={styles.newSlText}>Create One</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                {shortlists.map((sl) => (
                  <Pressable
                    key={sl.id}
                    style={styles.slRow}
                    onPress={() => addToShortlist(sl.id)}
                    testID={`add-to-sl-${sl.id}`}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.slName}>{sl.name}</Text>
                      {sl.occasion ? <Text style={styles.slOccasion}>{sl.occasion}</Text> : null}
                    </View>
                    {addedToSl === sl.id ? (
                      <Feather name="check-circle" size={20} color={colors.success} />
                    ) : (
                      <Feather name="plus" size={20} color={colors.onSurface} />
                    )}
                  </Pressable>
                ))}
                <Pressable
                  style={styles.newSlRow}
                  onPress={() => { setSlModalOpen(false); router.push("/shortlists"); }}
                  testID="new-sl-from-modal"
                >
                  <Feather name="plus-circle" size={20} color={colors.brand} />
                  <Text style={styles.newSlLabel}>New Nest Table</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <SafeAreaView style={styles.stickyBar} edges={["bottom"]}>
        <View style={styles.stickyInner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.stickyLabel}>Total</Text>
            <Text style={styles.stickyPrice}>₹{product.price.toLocaleString("en-IN")}</Text>
          </View>
          <Pressable testID="add-to-cart-btn" style={styles.addBtn} onPress={onAdd}>
            <Text style={styles.addBtnText}>{added ? "Added ✓" : "Add to Cart"}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingHorizontal: spacing.lg,
    flexDirection: "row", justifyContent: "space-between",
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(252,251,248,0.9)", alignItems: "center", justifyContent: "center" },
  dots: { position: "absolute", bottom: spacing.lg, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(252,251,248,0.6)" },
  dotActive: { backgroundColor: colors.surface, width: 18 },
  info: { padding: spacing.xl, paddingTop: spacing.xxl, gap: spacing.sm },
  category: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: colors.mutedText },
  name: { fontFamily: "CormorantGaramondBold", fontSize: 30, lineHeight: 36, color: colors.onSurface },
  price: { fontFamily: "DMSansMedium", fontSize: 20, color: colors.onSurface, marginTop: spacing.xs },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.lg },
  desc: { ...type.bodyLg, color: colors.onSurfaceSecondary },
  metaBox: { marginTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.lg, gap: spacing.md },
  metaRow: { flexDirection: "row", justifyContent: "space-between" },
  metaKey: { fontFamily: "DMSansMedium", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: colors.mutedText },
  metaVal: { fontFamily: "DMSans", fontSize: 14, color: colors.onSurface },
  stickyBar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  stickyInner: { flexDirection: "row", alignItems: "center", padding: spacing.lg, gap: spacing.md },
  stickyLabel: { fontFamily: "DMSans", fontSize: 11, letterSpacing: 1.5, color: colors.mutedText, textTransform: "uppercase" },
  stickyPrice: { fontFamily: "CormorantGaramondBold", fontSize: 22, color: colors.onSurface },
  addBtn: { backgroundColor: colors.brand, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, borderRadius: radius.pill },
  addBtnText: { color: colors.onBrandPrimary, fontFamily: "DMSansBold", letterSpacing: 1.5, textTransform: "uppercase", fontSize: 13 },
  nestBtn: { marginTop: spacing.xl, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.brand, paddingVertical: spacing.md, borderRadius: radius.pill, backgroundColor: colors.brandLight },
  nestBtnText: { fontFamily: "DMSansBold", fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: colors.brandDark },
  modalBg: { flex: 1, backgroundColor: "rgba(44,41,37,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surface, padding: spacing.xl, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingBottom: spacing.xxxl },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  modalTitle: { fontFamily: "CormorantGaramondBold", fontSize: 22, color: colors.onSurface },
  slRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: spacing.md },
  slName: { fontFamily: "CormorantGaramond", fontSize: 18, color: colors.onSurface },
  slOccasion: { fontFamily: "DMSans", fontSize: 12, color: colors.mutedText, marginTop: 2 },
  newSlRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, gap: spacing.md, marginTop: spacing.sm },
  newSlLabel: { fontFamily: "DMSansMedium", fontSize: 14, color: colors.brand },
  newSlBtn: { backgroundColor: colors.brand, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, borderRadius: radius.pill },
  newSlText: { fontFamily: "DMSansBold", fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: colors.onBrandPrimary },
});
