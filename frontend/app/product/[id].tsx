import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Dimensions, Modal, TextInput,
} from "react-native";
import { Image } from "expo-image";
import Feather from "@react-native-vector-icons/feather";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { colors, radius, spacing, type } from "@/src/theme";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { useCart } from "@/src/context/CartContext";
import { logInteraction } from "@/src/api/interactions";

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
  average_rating?: number;
  review_count?: number;
};

type Shortlist = { id: string; name: string; occasion: string };
type Review = { id: string; user_name: string; rating: number; title: string; body: string; photos?: string[]; created_at: string };

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
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [rvForm, setRvForm] = useState<{ rating: number; title: string; body: string; photos: string[] }>({ rating: 5, title: "", body: "", photos: [] });
  const [rvBusy, setRvBusy] = useState(false);
  const [photoAward, setPhotoAward] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const p = await api<Product>(`/products/${id}`);
      setProduct(p);
      const rvs = await api<Review[]>(`/products/${id}/reviews`);
      setReviews(rvs);
      if (user) {
        logInteraction(p.id, "view");
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
    if (user) logInteraction(product.id, "cart_add");
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
      if (r.in_wishlist) logInteraction(product.id, "wishlist");
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
      logInteraction(product.id, "shortlist_add");
      setAddedToSl(slId);
      setTimeout(() => { setSlModalOpen(false); setAddedToSl(null); }, 900);
    } catch {}
  };

  const submitReview = async () => {
    if (!product) return;
    if (!user) return router.push("/(auth)/login");
    setRvBusy(true);
    try {
      const r = await api<{ points_earned?: number }>(`/products/${product.id}/reviews`, {
        method: "POST", auth: true, body: rvForm,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      logInteraction(product.id, "review");
      if (r.points_earned && r.points_earned > 0) {
        setPhotoAward(r.points_earned);
        setTimeout(() => setPhotoAward(null), 3200);
      }
      setReviewModalOpen(false);
      setRvForm({ rating: 5, title: "", body: "", photos: [] });
      const rvs = await api<Review[]>(`/products/${product.id}/reviews`);
      setReviews(rvs);
      const p = await api<Product>(`/products/${product.id}`);
      setProduct(p);
    } catch {}
    finally { setRvBusy(false); }
  };

  const pickPhoto = async () => {
    if (rvForm.photos.length >= 3) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.55,
      base64: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if (!asset.base64) return;
    const dataUrl = `data:image/jpeg;base64,${asset.base64}`;
    setRvForm({ ...rvForm, photos: [...rvForm.photos, dataUrl].slice(0, 3) });
  };

  const removePhoto = (idx: number) => {
    setRvForm({ ...rvForm, photos: rvForm.photos.filter((_, i) => i !== idx) });
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
          {product.review_count && product.review_count > 0 ? (
            <View style={styles.ratingRow} testID="rating-summary">
              <View style={{ flexDirection: "row", gap: 2 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Feather
                    key={i}
                    name="star"
                    size={14}
                    color={i <= Math.round(product.average_rating || 0) ? colors.brand : colors.border}
                  />
                ))}
              </View>
              <Text style={styles.ratingText}>{product.average_rating?.toFixed(1)} · {product.review_count} {product.review_count === 1 ? "review" : "reviews"}</Text>
            </View>
          ) : null}
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

          {/* Reviews */}
          <View style={styles.reviewsSection}>
            {/* Real Homes gallery — photos from reviews */}
            {(() => {
              const allPhotos = reviews.flatMap((r) => (r.photos || []).map((p) => ({ uri: p, author: r.user_name })));
              if (allPhotos.length === 0) return null;
              return (
                <View style={styles.realHomes} testID="real-homes-gallery">
                  <Text style={styles.reviewsEyebrow}>REAL HOMES</Text>
                  <Text style={styles.reviewsTitle}>Seen in the wild</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, marginTop: spacing.md }} style={{ marginHorizontal: -spacing.xl, paddingHorizontal: spacing.xl }}>
                    {allPhotos.map((ph, i) => (
                      <View key={i} style={styles.realHomeTile} testID={`real-home-${i}`}>
                        <Image source={{ uri: ph.uri }} style={styles.realHomeImg} contentFit="cover" />
                        <Text style={styles.realHomeAuthor}>{ph.author}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              );
            })()}

            <View style={styles.reviewsHeader}>
              <View>
                <Text style={styles.reviewsEyebrow}>WHAT OTHERS SAY</Text>
                <Text style={styles.reviewsTitle}>Reviews</Text>
              </View>
              <Pressable
                style={styles.writeBtn}
                onPress={() => user ? setReviewModalOpen(true) : router.push("/(auth)/login")}
                testID="write-review-btn"
              >
                <Feather name="edit-2" size={14} color={colors.brandDark} />
                <Text style={styles.writeText}>Write</Text>
              </Pressable>
            </View>
            {reviews.length === 0 ? (
              <Text style={styles.noReviews}>Be the first to review this piece.</Text>
            ) : (
              <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
                {reviews.map((r) => (
                  <View key={r.id} style={styles.reviewCard} testID={`review-${r.id}`}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <View style={styles.reviewAvatar}><Text style={styles.reviewInitials}>{r.user_name.slice(0, 1).toUpperCase()}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reviewName}>{r.user_name}</Text>
                        <View style={{ flexDirection: "row", gap: 2, marginTop: 2 }}>
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Feather key={i} name="star" size={11} color={i <= r.rating ? colors.brand : colors.border} />
                          ))}
                        </View>
                      </View>
                    </View>
                    {r.title ? <Text style={styles.reviewTitle}>{r.title}</Text> : null}
                    {r.body ? <Text style={styles.reviewBody}>{r.body}</Text> : null}
                    {r.photos && r.photos.length > 0 && (
                      <View style={styles.reviewPhotosRow}>
                        {r.photos.map((uri, i) => (
                          <Image key={i} source={{ uri }} style={styles.reviewPhoto} contentFit="cover" testID={`review-${r.id}-photo-${i}`} />
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Review modal */}
      <Modal visible={reviewModalOpen} transparent animationType="slide" onRequestClose={() => setReviewModalOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Write a Review</Text>
              <Pressable onPress={() => setReviewModalOpen(false)} testID="close-review-modal"><Feather name="x" size={22} color={colors.onSurface} /></Pressable>
            </View>
            <View style={{ gap: spacing.md }}>
              <Text style={styles.rvLab}>YOUR RATING</Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Pressable key={i} onPress={() => setRvForm({ ...rvForm, rating: i })} testID={`star-${i}`} hitSlop={8}>
                    <Feather name="star" size={30} color={i <= rvForm.rating ? colors.brand : colors.border} />
                  </Pressable>
                ))}
              </View>
              <TextInput
                testID="review-title-input"
                placeholder="Give it a headline..."
                placeholderTextColor={colors.mutedText}
                style={styles.rvInput}
                value={rvForm.title}
                onChangeText={(v) => setRvForm({ ...rvForm, title: v })}
              />
              <TextInput
                testID="review-body-input"
                placeholder="Tell us what you love (or don't)..."
                placeholderTextColor={colors.mutedText}
                style={[styles.rvInput, { minHeight: 90, textAlignVertical: "top" }]}
                multiline
                value={rvForm.body}
                onChangeText={(v) => setRvForm({ ...rvForm, body: v })}
              />
              <Text style={styles.rvLab}>PHOTOS (UP TO 3) — EARN 100 pts FOR YOUR FIRST</Text>
              <View style={styles.photoRow}>
                {rvForm.photos.map((uri, i) => (
                  <View key={i} style={styles.photoBox} testID={`review-photo-${i}`}>
                    <Image source={{ uri }} style={styles.photoImg} contentFit="cover" />
                    <Pressable onPress={() => removePhoto(i)} style={styles.photoRemove} testID={`remove-photo-${i}`}>
                      <Feather name="x" size={12} color={colors.onSurfaceInverse} />
                    </Pressable>
                  </View>
                ))}
                {rvForm.photos.length < 3 && (
                  <Pressable onPress={pickPhoto} style={styles.photoAdd} testID="add-photo-btn">
                    <Feather name="plus" size={22} color={colors.brand} />
                  </Pressable>
                )}
              </View>
              <Pressable style={styles.submitReview} onPress={submitReview} disabled={rvBusy} testID="submit-review-btn">
                {rvBusy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.submitReviewText}>Post Review</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
      {/* Photo bonus toast */}
      {photoAward !== null && (
        <View style={styles.awardToast} testID="photo-award-toast">
          <Feather name="award" size={18} color={colors.brandDark} />
          <Text style={styles.awardText}>+{photoAward} pts for your first photo review!</Text>
        </View>
      )}
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
  ratingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  ratingText: { fontFamily: "DMSans", fontSize: 12, color: colors.onSurfaceSecondary },
  reviewsSection: { marginTop: spacing.xxl, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.xl },
  reviewsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  reviewsEyebrow: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: colors.mutedText },
  reviewsTitle: { fontFamily: "CormorantGaramondBold", fontSize: 24, color: colors.onSurface, marginTop: 2 },
  writeBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.brandLight },
  writeText: { fontFamily: "DMSansBold", fontSize: 11, letterSpacing: 1, color: colors.brandDark, textTransform: "uppercase" },
  noReviews: { ...type.body, marginTop: spacing.md, fontStyle: "italic" },
  reviewCard: { padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, gap: spacing.sm },
  reviewAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandLight, alignItems: "center", justifyContent: "center" },
  reviewInitials: { fontFamily: "DMSansBold", fontSize: 14, color: colors.brandDark },
  reviewName: { fontFamily: "DMSansMedium", fontSize: 13, color: colors.onSurface },
  reviewTitle: { fontFamily: "CormorantGaramondBold", fontSize: 16, color: colors.onSurface },
  reviewBody: { fontFamily: "DMSans", fontSize: 13, color: colors.onSurfaceSecondary, lineHeight: 20 },
  rvLab: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: colors.mutedText },
  starRow: { flexDirection: "row", gap: spacing.sm },
  rvInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, fontFamily: "DMSans", fontSize: 14, color: colors.onSurface },
  submitReview: { backgroundColor: colors.brand, paddingVertical: spacing.md, borderRadius: radius.pill, alignItems: "center", marginTop: spacing.sm },
  submitReviewText: { color: colors.onBrandPrimary, fontFamily: "DMSansBold", letterSpacing: 1.5, textTransform: "uppercase", fontSize: 13 },
  photoRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  photoBox: { width: 80, height: 80, borderRadius: radius.md, position: "relative" },
  photoImg: { width: 80, height: 80, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  photoRemove: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(44,41,37,0.85)", alignItems: "center", justifyContent: "center" },
  photoAdd: { width: 80, height: 80, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.brand, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandLight },
  reviewPhotosRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, flexWrap: "wrap" },
  reviewPhoto: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  realHomes: { paddingBottom: spacing.xl },
  realHomeTile: { width: 140 },
  realHomeImg: { width: 140, height: 140, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  realHomeAuthor: { fontFamily: "DMSans", fontSize: 11, color: colors.mutedText, marginTop: spacing.xs, textAlign: "center" },
  awardToast: { position: "absolute", top: 60, left: spacing.xl, right: spacing.xl, backgroundColor: colors.brandLight, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  awardText: { fontFamily: "DMSansBold", fontSize: 13, color: colors.brandDark },
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
