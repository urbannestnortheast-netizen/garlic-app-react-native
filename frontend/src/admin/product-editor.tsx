import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Alert, Modal, Switch } from "react-native";
import Feather from "@react-native-vector-icons/feather";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAdminTheme } from "@/src/admin/theme";
import { AdminButton, AdminCard } from "@/src/admin/ui";
import { AdminField } from "@/src/admin/field";
import { api } from "@/src/api/client";

const CATEGORIES = ["dining", "kitchen", "decor", "bath", "soft-furnishing", "accessories"];

export type EditorProduct = {
  id?: string;
  name: string;
  category: string;
  subcategory?: string;
  price: string; // as string for input
  original_price?: string;
  description?: string;
  images: string[];
  material?: string;
  dimensions?: string;
  stock: string;
  featured: boolean;
  collection?: string;
};

export function ProductEditor({
  productId,
  initial,
}: {
  productId?: string;
  initial?: any;
}) {
  const t = useAdminTheme();
  const router = useRouter();
  const isEdit = !!productId;

  const [form, setForm] = useState<EditorProduct>({
    id: initial?.id,
    name: initial?.name || "",
    category: initial?.category || "kitchen",
    subcategory: initial?.subcategory || "",
    price: initial?.price != null ? String(initial.price) : "",
    original_price: initial?.original_price != null ? String(initial.original_price) : "",
    description: initial?.description || "",
    images: initial?.images || [],
    material: initial?.material || "",
    dimensions: initial?.dimensions || "",
    stock: initial?.stock != null ? String(initial.stock) : "100",
    featured: initial?.featured || false,
    collection: initial?.collection || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const styles = useStyles();

  const set = <K extends keyof EditorProduct>(k: K, v: EditorProduct[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
    if (errors[k as string]) setErrors((e) => ({ ...e, [k]: "" }));
  };

  const pickImages = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        if (Platform.OS === "web") { /* @ts-ignore */ window.alert("Photo permission is required to add product images."); }
        else Alert.alert("Permission needed", "Photo library access is required to add images.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 8 - form.images.length,
        quality: 0.7,
        base64: true,
      });
      if (result.canceled) return;
      const newImgs = result.assets
        .map((a) => (a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri))
        .filter(Boolean) as string[];
      set("images", [...form.images, ...newImgs].slice(0, 8));
    } catch (e: any) {
      const msg = e?.message || "Could not pick images";
      if (Platform.OS === "web") { /* @ts-ignore */ window.alert(msg); } else Alert.alert("Error", msg);
    }
  }, [form.images]);

  const removeImage = (idx: number) => {
    set("images", form.images.filter((_, i) => i !== idx));
  };

  const setPrimary = (idx: number) => {
    if (idx === 0) return;
    const next = [...form.images];
    const [moved] = next.splice(idx, 1);
    next.unshift(moved);
    set("images", next);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Product name is required";
    if (!form.category) e.category = "Choose a category";
    const priceNum = parseFloat(form.price);
    if (isNaN(priceNum) || priceNum <= 0) e.price = "Enter a valid price";
    const stockNum = parseInt(form.stock, 10);
    if (isNaN(stockNum) || stockNum < 0) e.stock = "Stock must be 0 or more";
    if (form.original_price) {
      const op = parseFloat(form.original_price);
      if (isNaN(op) || op <= priceNum) e.original_price = "Original price must be greater than sale price";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        subcategory: form.subcategory?.trim() || "",
        price: parseFloat(form.price),
        original_price: form.original_price ? parseFloat(form.original_price) : null,
        description: form.description?.trim() || "",
        images: form.images,
        material: form.material?.trim() || "",
        dimensions: form.dimensions?.trim() || "",
        stock: parseInt(form.stock, 10),
        featured: !!form.featured,
        collection: form.collection?.trim() || "",
        gift_persons: [],
        gift_occasions: [],
      };
      if (isEdit) {
        await api(`/products/${productId}`, { method: "PUT", auth: true, body: payload });
      } else {
        await api("/products", { method: "POST", auth: true, body: payload });
      }
      setDirty(false);
      // On create → jump to the products list so the new item is visible.
      // On edit → back to previous screen (which was either products list or product detail).
      if (isEdit) {
        router.back();
      } else {
        router.replace("/admin/products");
      }
    } catch (e: any) {
      const msg = e?.message || "Save failed";
      if (Platform.OS === "web") { /* @ts-ignore */ window.alert(msg); } else Alert.alert("Save failed", msg);
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async () => {
    if (!productId) return;
    const doIt = async () => {
      try {
        await api(`/products/${productId}`, { method: "DELETE", auth: true });
        router.back();
      } catch (e: any) {
        const msg = e?.message || "Delete failed";
        if (Platform.OS === "web") { /* @ts-ignore */ window.alert(msg); } else Alert.alert("Error", msg);
      }
    };
    if (Platform.OS === "web") {
      /* @ts-ignore */
      if (window.confirm("Delete this product?\nThis cannot be undone.")) doIt();
    } else {
      Alert.alert("Delete product?", "This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doIt },
      ]);
    }
  };

  const attemptClose = () => {
    if (!dirty) return router.back();
    if (Platform.OS === "web") {
      /* @ts-ignore */
      if (window.confirm("You have unsaved changes. Discard them?")) router.back();
    } else {
      Alert.alert("Discard changes?", "Your edits will be lost.", [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => router.back() },
      ]);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={attemptClose} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={t.colors.onSurface} />
        </Pressable>
        <Text style={[t.type.h2, { color: t.colors.onSurface }]}>{isEdit ? "Edit product" : "New product"}</Text>
        {isEdit ? (
          <Pressable onPress={deleteProduct} accessibilityRole="button" accessibilityLabel="Delete product" hitSlop={12} style={styles.iconBtn}>
            <Feather name="trash-2" size={20} color={t.colors.danger} />
          </Pressable>
        ) : <View style={{ width: 44 }} />}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 16 }}>
          {/* Images */}
          <AdminCard>
            <Text style={[t.type.h3, { color: t.colors.mutedText, marginBottom: 12 }]}>PRODUCT IMAGES</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {form.images.map((uri, idx) => (
                <View key={uri.slice(-32) + idx} style={styles.imgTile}>
                  <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  {idx === 0 && (
                    <View style={styles.primaryBadge}>
                      <Text style={{ ...t.type.button, fontSize: 9, color: t.colors.onPrimary }}>PRIMARY</Text>
                    </View>
                  )}
                  <View style={styles.imgActions}>
                    {idx !== 0 && (
                      <Pressable onPress={() => setPrimary(idx)} accessibilityLabel="Make this the primary image" hitSlop={8} style={styles.imgAction}>
                        <Feather name="star" size={12} color="#fff" />
                      </Pressable>
                    )}
                    <Pressable onPress={() => removeImage(idx)} accessibilityLabel="Remove image" hitSlop={8} style={[styles.imgAction, { backgroundColor: t.colors.danger }]}>
                      <Feather name="x" size={12} color="#fff" />
                    </Pressable>
                  </View>
                </View>
              ))}
              {form.images.length < 8 && (
                <Pressable
                  onPress={pickImages}
                  accessibilityRole="button"
                  accessibilityLabel="Add product image"
                  testID="add-image-btn"
                  style={[styles.imgTile, styles.imgTileAdd]}
                >
                  <Feather name="plus" size={20} color={t.colors.primary} />
                  <Text style={[t.type.bodySm, { color: t.colors.primary, marginTop: 4, fontFamily: "DMSansMedium" }]}>Add</Text>
                </Pressable>
              )}
            </ScrollView>
            {form.images.length === 0 && (
              <Text style={[t.type.bodySm, { color: t.colors.mutedText, marginTop: 10 }]}>
                Add up to 8 photos. First image is the primary.
              </Text>
            )}
          </AdminCard>

          {/* Basic */}
          <AdminCard>
            <Text style={[t.type.h3, { color: t.colors.mutedText, marginBottom: 12 }]}>BASIC INFORMATION</Text>
            <View style={{ gap: 14 }}>
              <AdminField label="Product name" required value={form.name} onChangeText={(v) => set("name", v)} placeholder="e.g. Ceramic Dinner Set" error={errors.name} testID="product-name-input" />
              <View>
                <Text style={{ ...t.type.label, color: t.colors.onSurfaceSecondary, marginBottom: 6 }}>
                  Category <Text style={{ color: t.colors.danger }}>*</Text>
                </Text>
                <Pressable
                  onPress={() => setCategoryOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select category. Currently: ${form.category}`}
                  testID="category-picker"
                  style={styles.selectBtn}
                >
                  <Text style={[t.type.body, { color: t.colors.onSurface, flex: 1, textTransform: "capitalize" }]}>
                    {form.category}
                  </Text>
                  <Feather name="chevron-down" size={16} color={t.colors.mutedText} />
                </Pressable>
                {errors.category ? <Text style={[t.type.bodySm, { color: t.colors.danger, marginTop: 6 }]}>{errors.category}</Text> : null}
              </View>
              <AdminField label="Subcategory" value={form.subcategory || ""} onChangeText={(v) => set("subcategory", v)} placeholder="e.g. cups, plates" />
              <AdminField label="Description" value={form.description || ""} onChangeText={(v) => set("description", v)} placeholder="Product details, materials, care instructions…" multiline numberOfLines={4} maxLength={1000} />
              <AdminField label="Collection" value={form.collection || ""} onChangeText={(v) => set("collection", v)} placeholder="e.g. trending, new-arrivals" />
            </View>
          </AdminCard>

          {/* Pricing */}
          <AdminCard>
            <Text style={[t.type.h3, { color: t.colors.mutedText, marginBottom: 12 }]}>PRICING</Text>
            <View style={{ gap: 14 }}>
              <AdminField label="Sale price" required prefix="₹" value={form.price} onChangeText={(v) => set("price", v)} placeholder="0.00" keyboardType="numeric" error={errors.price} testID="product-price-input" />
              <AdminField label="Original price (MRP)" prefix="₹" value={form.original_price || ""} onChangeText={(v) => set("original_price", v)} placeholder="0.00" keyboardType="numeric" error={errors.original_price} hint="Leave blank if not on sale" />
            </View>
          </AdminCard>

          {/* Inventory */}
          <AdminCard>
            <Text style={[t.type.h3, { color: t.colors.mutedText, marginBottom: 12 }]}>INVENTORY</Text>
            <AdminField label="Stock quantity" required value={form.stock} onChangeText={(v) => set("stock", v)} placeholder="0" keyboardType="numeric" error={errors.stock} testID="product-stock-input" />
          </AdminCard>

          {/* Specs */}
          <AdminCard>
            <Text style={[t.type.h3, { color: t.colors.mutedText, marginBottom: 12 }]}>PRODUCT DETAILS</Text>
            <View style={{ gap: 14 }}>
              <AdminField label="Material" value={form.material || ""} onChangeText={(v) => set("material", v)} placeholder="e.g. Stoneware ceramic" />
              <AdminField label="Dimensions" value={form.dimensions || ""} onChangeText={(v) => set("dimensions", v)} placeholder='e.g. 12" x 6" x 3"' />
            </View>
          </AdminCard>

          {/* Visibility */}
          <AdminCard>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[t.type.bodyLg, { color: t.colors.onSurface, fontFamily: "DMSansMedium" }]}>Feature this product</Text>
                <Text style={[t.type.bodySm, { color: t.colors.mutedText, marginTop: 2 }]}>Show in featured sections on the customer app</Text>
              </View>
              <Switch
                testID="featured-switch"
                value={form.featured}
                onValueChange={(v) => set("featured", v)}
                accessibilityLabel="Feature this product"
                trackColor={{ true: t.colors.primary, false: t.colors.border }}
              />
            </View>
          </AdminCard>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky action */}
      <View style={styles.stickyBar}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <AdminButton label="Cancel" variant="secondary" fullWidth onPress={attemptClose} testID="product-editor-cancel-btn" />
          </View>
          <View style={{ flex: 2 }}>
            <AdminButton
              label={isEdit ? "Save Changes" : "Publish"}
              icon="check"
              fullWidth
              onPress={save}
              loading={saving}
              testID="save-product-btn"
            />
          </View>
        </View>
      </View>

      {/* Category picker */}
      <Modal transparent visible={categoryOpen} animationType="slide" onRequestClose={() => setCategoryOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setCategoryOpen(false)} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={[t.type.h1, { color: t.colors.onSurface, marginBottom: 12 }]}>Choose category</Text>
          <View style={{ gap: 6 }}>
            {CATEGORIES.map((c) => {
              const active = form.category === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => { set("category", c); setCategoryOpen(false); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={c}
                  style={[styles.sheetRow, { backgroundColor: active ? t.colors.primarySoft : "transparent" }]}
                >
                  <Text style={[t.type.bodyLg, { color: t.colors.onSurface, flex: 1, textTransform: "capitalize", fontFamily: active ? "DMSansBold" : "DMSans" }]}>
                    {c}
                  </Text>
                  {active && <Feather name="check" size={18} color={t.colors.primary} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function useStyles() {
  const t = useAdminTheme();
  return StyleSheet.create({
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, minHeight: 56 },
    iconBtn: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", padding: 8 },
    imgTile: {
      width: 96, height: 96, borderRadius: t.radius.md, overflow: "hidden",
      backgroundColor: t.colors.surfaceAlt, position: "relative",
    },
    imgTileAdd: {
      borderWidth: 1.5, borderColor: t.colors.primary, borderStyle: "dashed",
      alignItems: "center", justifyContent: "center", backgroundColor: t.colors.primarySoft,
    },
    primaryBadge: {
      position: "absolute", top: 6, left: 6,
      backgroundColor: t.colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    },
    imgActions: {
      position: "absolute", bottom: 6, right: 6, flexDirection: "row", gap: 4,
    },
    imgAction: {
      width: 24, height: 24, borderRadius: 12,
      backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center",
    },
    selectBtn: {
      flexDirection: "row", alignItems: "center",
      borderWidth: 1, borderColor: t.colors.border, borderRadius: t.radius.md,
      minHeight: 48, paddingHorizontal: 12, backgroundColor: t.colors.surface,
    },
    stickyBar: {
      position: "absolute", left: 0, right: 0, bottom: 0,
      padding: 16, backgroundColor: t.colors.surface,
      borderTopWidth: 1, borderTopColor: t.colors.border,
    },
    sheetBackdrop: { flex: 1, backgroundColor: t.colors.overlay },
    sheet: { backgroundColor: t.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
    sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: t.colors.border, marginBottom: 12 },
    sheetRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: t.radius.md, minHeight: 56 },
  });
}
