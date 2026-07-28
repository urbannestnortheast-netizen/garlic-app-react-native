import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Switch,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, radius, spacing, type } from "@/src/theme";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

type Product = {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  original_price?: number;
  description: string;
  images: string[];
  material?: string;
  dimensions?: string;
  stock: number;
  featured: boolean;
  collection?: string;
  gift_persons: string[];
  gift_occasions: string[];
};

type Category = { id: string; name: string; subcategories: { id: string; name: string }[] };
type Collection = { id: string; name: string };
type Tag = { id: string; name: string };

const empty = {
  name: "", category: "dining", subcategory: "", price: "", original_price: "", description: "",
  imagesText: "", material: "", dimensions: "", stock: "100", featured: false,
  collection: "", gift_persons: [] as string[], gift_occasions: [] as string[],
};

export default function Admin() {
  const router = useRouter();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [persons, setPersons] = useState<Tag[]>([]);
  const [occasions, setOccasions] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, c, col, pers, occ] = await Promise.all([
        api<Product[]>("/products"),
        api<Category[]>("/categories"),
        api<Collection[]>("/collections"),
        api<Tag[]>("/gift-persons"),
        api<Tag[]>("/gift-occasions"),
      ]);
      setProducts(p);
      setCategories(c);
      setCollections(col);
      setPersons(pers);
      setOccasions(occ);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!user || user.role !== "admin") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={styles.gate} testID="admin-gate">
          <Feather name="lock" size={40} color={colors.mutedText} />
          <Text style={styles.gateTitle}>Admin access required</Text>
          <Text style={styles.gateText}>Please sign in with an admin account.</Text>
          <Pressable style={styles.cta} onPress={() => router.replace("/(auth)/login")} testID="admin-login-btn">
            <Text style={styles.ctaText}>Sign In</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const openCreate = () => { setEditingId(null); setForm(empty); setErr(null); setModalOpen(true); };
  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name, category: p.category, subcategory: p.subcategory || "",
      price: String(p.price), original_price: p.original_price ? String(p.original_price) : "",
      description: p.description,
      imagesText: p.images.join("\n"), material: p.material || "", dimensions: p.dimensions || "",
      stock: String(p.stock), featured: p.featured,
      collection: p.collection || "",
      gift_persons: p.gift_persons || [],
      gift_occasions: p.gift_occasions || [],
    });
    setErr(null);
    setModalOpen(true);
  };

  const submit = async () => {
    setErr(null);
    if (!form.name || !form.price) return setErr("Name and price are required.");
    const price = parseFloat(form.price);
    const stock = parseInt(form.stock || "0", 10);
    if (isNaN(price)) return setErr("Invalid price.");
    const body: any = {
      name: form.name.trim(),
      category: form.category,
      subcategory: form.subcategory,
      price,
      description: form.description,
      images: form.imagesText.split("\n").map((s: string) => s.trim()).filter(Boolean),
      material: form.material,
      dimensions: form.dimensions,
      stock,
      featured: !!form.featured,
      collection: form.collection,
      gift_persons: form.gift_persons,
      gift_occasions: form.gift_occasions,
    };
    if (form.original_price) {
      const op = parseFloat(form.original_price);
      if (!isNaN(op)) body.original_price = op;
    }
    setBusy(true);
    try {
      if (editingId) await api(`/products/${editingId}`, { method: "PUT", auth: true, body });
      else await api("/products", { method: "POST", auth: true, body });
      setModalOpen(false);
      load();
    } catch (e: any) {
      setErr(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleTag = (list: "gift_persons" | "gift_occasions", id: string) => {
    setForm((prev: any) => {
      const cur: string[] = prev[list] || [];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return { ...prev, [list]: next };
    });
  };

  const del = async (id: string) => {
    try {
      await api(`/products/${id}`, { method: "DELETE", auth: true });
      load();
    } catch {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="back-btn">
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Admin</Text>
        <Pressable onPress={openCreate} hitSlop={12} testID="admin-add-btn">
          <Feather name="plus" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      <View style={styles.tabsRow}>
        <View style={[styles.tabPill, styles.tabActive]}>
          <Text style={styles.tabTextActive}>Products</Text>
        </View>
        <Pressable
          testID="admin-view-orders-btn"
          style={styles.tabPill}
          onPress={() => router.push("/admin-orders")}
        >
          <Text style={styles.tabText}>Orders</Text>
        </Pressable>
        <Pressable
          testID="admin-view-editorials-btn"
          style={styles.tabPill}
          onPress={() => router.push("/admin-editorials")}
        >
          <Text style={styles.tabText}>Editorials</Text>
        </Pressable>
      </View>

      <Text style={styles.eyebrow}>{products.length} PRODUCTS</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.onSurfaceSecondary} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxxl }}>
          {products.map((p) => (
            <View key={p.id} style={styles.row} testID={`admin-product-${p.id}`}>
              <Image source={{ uri: p.images[0] }} style={styles.thumb} contentFit="cover" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowName} numberOfLines={2}>{p.name}</Text>
                <Text style={styles.rowMeta}>{p.category} · ₹{p.price.toLocaleString("en-IN")}</Text>
                {p.featured && <Text style={styles.rowFeat}>FEATURED</Text>}
              </View>
              <View style={{ gap: spacing.sm }}>
                <Pressable onPress={() => openEdit(p)} style={styles.iconMini} testID={`admin-edit-${p.id}`}>
                  <Feather name="edit-2" size={14} color={colors.onSurface} />
                </Pressable>
                <Pressable onPress={() => del(p.id)} style={styles.iconMini} testID={`admin-delete-${p.id}`}>
                  <Feather name="trash-2" size={14} color={colors.error} />
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
          <View style={styles.header}>
            <Pressable onPress={() => setModalOpen(false)} testID="admin-close-modal">
              <Feather name="x" size={22} color={colors.onSurface} />
            </Pressable>
            <Text style={styles.title}>{editingId ? "Edit Product" : "New Product"}</Text>
            <View style={{ width: 22 }} />
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxxl }}>
              <F label="Name" testID="admin-form-name" value={form.name} onChangeText={(v: string) => setForm({ ...form, name: v })} />
              <View style={{ gap: spacing.sm }}>
                <Text style={styles.lab}>CATEGORY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                  {categories.map((c) => {
                    const on = form.category === c.id;
                    return (
                      <Pressable key={c.id} onPress={() => setForm({ ...form, category: c.id, subcategory: "" })} style={[styles.chip, on && styles.chipOn]} testID={`admin-cat-${c.id}`}>
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
              {categories.find((c) => c.id === form.category)?.subcategories?.length ? (
                <View style={{ gap: spacing.sm }}>
                  <Text style={styles.lab}>SUBCATEGORY</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                    {(categories.find((c) => c.id === form.category)?.subcategories || []).map((s) => {
                      const on = form.subcategory === s.id;
                      return (
                        <Pressable key={s.id} onPress={() => setForm({ ...form, subcategory: s.id })} style={[styles.chip, on && styles.chipOn]} testID={`admin-sub-${s.id}`}>
                          <Text style={[styles.chipText, on && styles.chipTextOn]}>{s.name}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}
              <F label="Price (INR)" testID="admin-form-price" value={form.price} onChangeText={(v: string) => setForm({ ...form, price: v })} keyboardType="numeric" />
              <F label="Original Price (optional, for sale)" testID="admin-form-original-price" value={form.original_price} onChangeText={(v: string) => setForm({ ...form, original_price: v })} keyboardType="numeric" />
              <F label="Description" testID="admin-form-desc" value={form.description} onChangeText={(v: string) => setForm({ ...form, description: v })} multiline numberOfLines={4} />
              <F label="Image URLs (one per line)" testID="admin-form-images" value={form.imagesText} onChangeText={(v: string) => setForm({ ...form, imagesText: v })} multiline numberOfLines={3} />
              <F label="Material" testID="admin-form-material" value={form.material} onChangeText={(v: string) => setForm({ ...form, material: v })} />
              <F label="Dimensions" testID="admin-form-dim" value={form.dimensions} onChangeText={(v: string) => setForm({ ...form, dimensions: v })} />
              <F label="Stock" testID="admin-form-stock" value={form.stock} onChangeText={(v: string) => setForm({ ...form, stock: v })} keyboardType="numeric" />
              <View style={{ gap: spacing.sm }}>
                <Text style={styles.lab}>COLLECTION</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                  {[{ id: "", name: "None" }, ...collections].map((c) => {
                    const on = form.collection === c.id;
                    return (
                      <Pressable key={c.id || "none"} onPress={() => setForm({ ...form, collection: c.id })} style={[styles.chip, on && styles.chipOn]} testID={`admin-col-${c.id || "none"}`}>
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
              <View style={{ gap: spacing.sm }}>
                <Text style={styles.lab}>GIFT FOR (multi)</Text>
                <View style={styles.tagWrap}>
                  {persons.map((p) => {
                    const on = form.gift_persons.includes(p.id);
                    return (
                      <Pressable key={p.id} onPress={() => toggleTag("gift_persons", p.id)} style={[styles.chip, on && styles.chipOn]} testID={`admin-person-${p.id}`}>
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{p.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={{ gap: spacing.sm }}>
                <Text style={styles.lab}>OCCASION (multi)</Text>
                <View style={styles.tagWrap}>
                  {occasions.map((o) => {
                    const on = form.gift_occasions.includes(o.id);
                    return (
                      <Pressable key={o.id} onPress={() => toggleTag("gift_occasions", o.id)} style={[styles.chip, on && styles.chipOn]} testID={`admin-occ-${o.id}`}>
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.lab}>FEATURED</Text>
                <Switch
                  testID="admin-form-featured"
                  value={form.featured}
                  onValueChange={(v) => setForm({ ...form, featured: v })}
                  trackColor={{ true: colors.brandPrimary, false: colors.border }}
                />
              </View>
              {err && <Text style={styles.err}>{err}</Text>}
              <Pressable style={styles.saveBtn} onPress={submit} disabled={busy} testID="admin-save-btn">
                {busy ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <Text style={styles.saveText}>{editingId ? "Update Product" : "Create Product"}</Text>}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function F({ label, testID, ...rest }: any) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.lab}>{label.toUpperCase()}</Text>
      <TextInput testID={testID} style={styles.input} placeholderTextColor={colors.mutedText} {...rest} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.xl, paddingBottom: spacing.md },
  title: { fontFamily: "CormorantGaramondBold", fontSize: 24, color: colors.onSurface },
  eyebrow: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: colors.mutedText, paddingHorizontal: spacing.xl },
  tabsRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  tabPill: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary },
  tabActive: { backgroundColor: colors.brand },
  tabText: { fontFamily: "DMSansMedium", fontSize: 12, color: colors.onSurface },
  tabTextActive: { fontFamily: "DMSansBold", fontSize: 12, color: colors.onBrandPrimary },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "center", padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  rowName: { fontFamily: "CormorantGaramond", fontSize: 16, color: colors.onSurface, lineHeight: 20 },
  rowMeta: { fontFamily: "DMSans", fontSize: 12, color: colors.mutedText },
  rowFeat: { fontFamily: "DMSansBold", fontSize: 10, letterSpacing: 1, color: colors.brandPrimary, marginTop: 2 },
  iconMini: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  lab: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: colors.mutedText },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, fontFamily: "DMSans", fontSize: 14, color: colors.onSurface, textAlignVertical: "top" },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.brandTertiary },
  chipOn: { backgroundColor: colors.brand },
  chipText: { fontFamily: "DMSans", fontSize: 12, color: colors.onSurface },
  chipTextOn: { color: colors.onBrandPrimary },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  err: { fontFamily: "DMSans", color: colors.error, backgroundColor: "#F9EDEC", padding: spacing.md, borderRadius: radius.lg },
  saveBtn: { marginTop: spacing.md, backgroundColor: colors.onSurface, paddingVertical: spacing.lg, borderRadius: radius.pill, alignItems: "center" },
  saveText: { color: colors.onSurfaceInverse, fontFamily: "DMSansBold", letterSpacing: 1.5, textTransform: "uppercase", fontSize: 14 },
  gate: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl, gap: spacing.md },
  gateTitle: { ...type.displaySM, marginTop: spacing.md },
  gateText: { ...type.body, textAlign: "center", marginBottom: spacing.md },
  cta: { backgroundColor: colors.onSurface, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, borderRadius: radius.pill },
  ctaText: { color: colors.onSurfaceInverse, fontFamily: "DMSansBold", letterSpacing: 1.5, textTransform: "uppercase", fontSize: 13 },
});
