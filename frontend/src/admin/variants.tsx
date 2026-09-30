import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Modal, KeyboardAvoidingView, Platform, Alert } from "react-native";
import Feather from "@react-native-vector-icons/feather";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useAdminTheme } from "@/src/admin/theme";
import { AdminButton, AdminCard, AdminBadge } from "@/src/admin/ui";
import { AdminField } from "@/src/admin/field";

export type Variant = {
  id: string;
  color: string;
  color_hex: string;
  size: string;
  sku: string;
  stock: number;
  price_delta: number;
  image: string;
};

const COMMON_COLORS: { name: string; hex: string }[] = [
  { name: "Terracotta", hex: "#B45F3B" },
  { name: "Sage", hex: "#8FA779" },
  { name: "Cream", hex: "#F3EBDD" },
  { name: "Charcoal", hex: "#2C2925" },
  { name: "Blush", hex: "#E8B7A7" },
  { name: "Sand", hex: "#D8C6A2" },
  { name: "Slate", hex: "#5C6874" },
  { name: "Rose", hex: "#C89AA0" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Black", hex: "#111111" },
];

function newVariant(): Variant {
  return { id: "", color: "", color_hex: "", size: "", sku: "", stock: 0, price_delta: 0, image: "" };
}

// ----- Public component -----
export function VariantSection({
  variants,
  onChange,
}: {
  variants: Variant[];
  onChange: (next: Variant[]) => void;
}) {
  const t = useAdminTheme();
  const [editing, setEditing] = useState<{ variant: Variant; index: number | null } | null>(null);
  const styles = useStyles();

  const openNew = () => setEditing({ variant: newVariant(), index: null });
  const openEdit = (v: Variant, i: number) => setEditing({ variant: v, index: i });
  const close = () => setEditing(null);

  const save = (v: Variant) => {
    if (editing?.index === null || editing?.index === undefined) {
      onChange([...variants, v]);
    } else {
      const next = [...variants];
      next[editing.index] = v;
      onChange(next);
    }
    close();
  };

  const remove = (i: number) => {
    const doIt = () => {
      const next = [...variants];
      next.splice(i, 1);
      onChange(next);
      close();
    };
    if (Platform.OS === "web") { /* @ts-ignore */ if (window.confirm("Remove this variant?")) doIt(); }
    else Alert.alert("Remove variant?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: doIt },
    ]);
  };

  const totalStock = variants.reduce((s, v) => s + (v.stock || 0), 0);

  return (
    <AdminCard>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={[t.type.h3, { color: t.colors.mutedText }]}>VARIANTS (COLOR & SIZE)</Text>
          <Text style={[t.type.bodySm, { color: t.colors.mutedText, marginTop: 2 }]}>
            {variants.length === 0
              ? "Add color/size options with their own stock (optional)"
              : `${variants.length} option${variants.length > 1 ? "s" : ""} · ${totalStock} total in stock`}
          </Text>
        </View>
        <Pressable
          testID="add-variant-btn"
          onPress={openNew}
          accessibilityRole="button"
          accessibilityLabel="Add variant"
          style={styles.addBtn}
        >
          <Feather name="plus" size={16} color={t.colors.onPrimary} />
        </Pressable>
      </View>

      {variants.length === 0 ? (
        <View style={styles.emptyBox}>
          <Feather name="layers" size={22} color={t.colors.mutedText} />
          <Text style={[t.type.body, { color: t.colors.onSurfaceSecondary, textAlign: "center" }]}>
            Skip if this product has just one version.
          </Text>
          <AdminButton label="Add first variant" variant="secondary" size="sm" onPress={openNew} />
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {variants.map((v, i) => (
            <Pressable
              key={v.id || `v-${i}`}
              onPress={() => openEdit(v, i)}
              accessibilityRole="button"
              accessibilityLabel={`Edit variant ${v.color || "unnamed"} ${v.size || ""}, ${v.stock} in stock`}
              testID={`variant-row-${i}`}
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}
            >
              {v.image ? (
                <Image source={{ uri: v.image }} style={styles.varImg} contentFit="cover" />
              ) : (
                <View style={[styles.varImg, { backgroundColor: v.color_hex || t.colors.surfaceAlt, borderWidth: v.color_hex === "#FFFFFF" ? 1 : 0, borderColor: t.colors.border }]}>
                  {!v.color_hex && <Feather name="layers" size={16} color={t.colors.mutedText} />}
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[t.type.bodyLg, { color: t.colors.onSurface, fontFamily: "DMSansMedium" }]}>
                  {v.color || "Unnamed"}{v.size ? ` · ${v.size}` : ""}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <AdminBadge
                    label={v.stock <= 0 ? "Out of stock" : v.stock < 5 ? `${v.stock} left` : `${v.stock} in stock`}
                    tone={v.stock <= 0 ? "danger" : v.stock < 5 ? "warning" : "success"}
                  />
                  {v.price_delta !== 0 && (
                    <Text style={[t.type.bodySm, { color: t.colors.mutedText }]}>
                      {v.price_delta > 0 ? "+" : ""}₹{Math.abs(v.price_delta)}
                    </Text>
                  )}
                </View>
                {v.sku ? (
                  <Text style={[t.type.bodySm, { color: t.colors.mutedText, marginTop: 2 }]}>SKU {v.sku}</Text>
                ) : null}
              </View>
              <Feather name="chevron-right" size={16} color={t.colors.mutedText} />
            </Pressable>
          ))}
        </View>
      )}

      {editing && (
        <VariantEditor
          initial={editing.variant}
          onCancel={close}
          onSave={save}
          onDelete={editing.index !== null ? () => remove(editing.index!) : undefined}
        />
      )}
    </AdminCard>
  );
}

// ----- Editor sheet -----
function VariantEditor({
  initial, onCancel, onSave, onDelete,
}: {
  initial: Variant;
  onCancel: () => void;
  onSave: (v: Variant) => void;
  onDelete?: () => void;
}) {
  const t = useAdminTheme();
  const [color, setColor] = useState(initial.color);
  const [colorHex, setColorHex] = useState(initial.color_hex);
  const [size, setSize] = useState(initial.size);
  const [sku, setSku] = useState(initial.sku);
  const [stock, setStock] = useState(String(initial.stock ?? 0));
  const [priceDelta, setPriceDelta] = useState(String(initial.price_delta ?? 0));
  const [image, setImage] = useState(initial.image);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const styles = useStyles();

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") return;
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false, quality: 0.7, base64: true,
      });
      if (r.canceled || !r.assets[0]) return;
      const asset = r.assets[0];
      setImage(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri);
    } catch {}
  };

  const submit = () => {
    const e: Record<string, string> = {};
    if (!color.trim()) e.color = "Color is required";
    const s = parseInt(stock, 10);
    if (isNaN(s) || s < 0) e.stock = "Stock must be 0 or more";
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({
      id: initial.id,
      color: color.trim(),
      color_hex: colorHex.trim(),
      size: size.trim(),
      sku: sku.trim(),
      stock: s,
      price_delta: parseFloat(priceDelta || "0") || 0,
      image,
    });
  };

  return (
    <Modal transparent visible animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 560 }} contentContainerStyle={{ gap: 14, paddingBottom: 12 }}>
            <Text style={[t.type.h1, { color: t.colors.onSurface }]}>{onDelete ? "Edit variant" : "New variant"}</Text>

            {/* Image */}
            <View>
              <Text style={{ ...t.type.label, color: t.colors.onSurfaceSecondary, marginBottom: 6 }}>Variant image</Text>
              <Pressable
                onPress={pickImage}
                accessibilityRole="button"
                accessibilityLabel="Choose variant image"
                style={styles.imgPicker}
              >
                {image ? (
                  <Image source={{ uri: image }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                ) : (
                  <View style={{ alignItems: "center", gap: 4 }}>
                    <Feather name="image" size={18} color={t.colors.primary} />
                    <Text style={[t.type.bodySm, { color: t.colors.primary, fontFamily: "DMSansMedium" }]}>Add image</Text>
                  </View>
                )}
              </Pressable>
              {image ? (
                <Pressable onPress={() => setImage("")} hitSlop={10} accessibilityLabel="Remove image" style={{ marginTop: 6 }}>
                  <Text style={[t.type.bodySm, { color: t.colors.danger }]}>Remove image</Text>
                </Pressable>
              ) : null}
            </View>

            <AdminField label="Color name" required value={color} onChangeText={setColor} placeholder="e.g. Terracotta" error={errors.color} testID="variant-color-input" />

            {/* Color swatch chips */}
            <View>
              <Text style={{ ...t.type.label, color: t.colors.onSurfaceSecondary, marginBottom: 6 }}>Quick pick swatch</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {COMMON_COLORS.map((c) => {
                  const active = colorHex.toLowerCase() === c.hex.toLowerCase();
                  return (
                    <Pressable
                      key={c.hex}
                      onPress={() => { setColorHex(c.hex); if (!color.trim()) setColor(c.name); }}
                      accessibilityRole="button"
                      accessibilityLabel={c.name}
                      style={[
                        styles.swatch,
                        { backgroundColor: c.hex, borderColor: active ? t.colors.primary : t.colors.border, borderWidth: active ? 3 : 1 },
                      ]}
                    />
                  );
                })}
              </ScrollView>
              <Text style={[t.type.bodySm, { color: t.colors.mutedText, marginTop: 4 }]}>
                {colorHex ? `Selected: ${colorHex}` : "Optional — for the color swatch shown to shoppers"}
              </Text>
            </View>

            <AdminField label="Size" value={size} onChangeText={setSize} placeholder="e.g. Small · M · 12 inch" hint="Leave blank if no size options" />
            <AdminField label="Stock quantity" required value={stock} onChangeText={setStock} keyboardType="numeric" error={errors.stock} testID="variant-stock-input" />
            <AdminField label="Price adjustment" prefix="₹" value={priceDelta} onChangeText={setPriceDelta} keyboardType="numeric" hint="+ or − vs base price. e.g. +200 for larger size" />
            <AdminField label="SKU" value={sku} onChangeText={setSku} placeholder="e.g. TER-M-01" hint="Internal inventory code" />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              {onDelete && (
                <View style={{ flex: 1 }}>
                  <AdminButton label="Remove" variant="secondary" icon="trash-2" fullWidth onPress={onDelete} testID="variant-remove-btn" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <AdminButton label="Cancel" variant="secondary" fullWidth onPress={onCancel} />
              </View>
              <View style={{ flex: 2 }}>
                <AdminButton label="Save" icon="check" fullWidth onPress={submit} testID="variant-save-btn" />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function useStyles() {
  const t = useAdminTheme();
  return StyleSheet.create({
    addBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: t.colors.primary, alignItems: "center", justifyContent: "center",
    },
    emptyBox: {
      alignItems: "center", gap: 10, padding: 16,
      backgroundColor: t.colors.surfaceAlt, borderRadius: t.radius.md,
    },
    row: {
      flexDirection: "row", alignItems: "center", gap: 12, padding: 10,
      backgroundColor: t.colors.surfaceAlt, borderRadius: t.radius.md,
    },
    varImg: {
      width: 48, height: 48, borderRadius: t.radius.sm, overflow: "hidden",
      alignItems: "center", justifyContent: "center", backgroundColor: t.colors.surface,
    },
    backdrop: { flex: 1, backgroundColor: t.colors.overlay },
    sheet: { backgroundColor: t.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
    handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: t.colors.border, marginBottom: 12 },
    imgPicker: {
      width: 96, height: 96, borderRadius: t.radius.md, overflow: "hidden",
      backgroundColor: t.colors.primarySoft, borderWidth: 1.5, borderStyle: "dashed", borderColor: t.colors.primary,
      alignItems: "center", justifyContent: "center",
    },
    swatch: {
      width: 36, height: 36, borderRadius: 18,
    },
  });
}
