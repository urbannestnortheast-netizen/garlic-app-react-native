import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput,
  Modal, Switch, KeyboardAvoidingView, Platform,
} from "react-native";
import { Image } from "expo-image";
import Feather from "@react-native-vector-icons/feather";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing, type } from "@/src/theme";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

type Tile = { label: string; image: string; filter: { category?: string; subcategory?: string; collection?: string } };
type Editorial = {
  id: string;
  title: string;
  subtitle: string;
  tiles: Tile[];
  order: number;
  active: boolean;
};

export default function AdminEditorials() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<Editorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Editorial | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<Editorial[]>("/admin/editorials", { auth: true });
      setItems(data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    setErr(null);
    setBusy(true);
    try {
      const body = {
        title: editing.title,
        subtitle: editing.subtitle,
        tiles: editing.tiles,
        order: editing.order,
        active: editing.active,
      };
      await api(`/admin/editorials/${editing.id}`, { method: "PUT", auth: true, body });
      setEditing(null);
      load();
    } catch (e: any) {
      setErr(e.message || "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const updateTile = (idx: number, field: "label" | "image" | "subcategory", value: string) => {
    if (!editing) return;
    const tiles = editing.tiles.map((t, i) => {
      if (i !== idx) return t;
      if (field === "label") return { ...t, label: value };
      if (field === "image") return { ...t, image: value };
      return { ...t, filter: { subcategory: value } };
    });
    setEditing({ ...editing, tiles });
  };

  const addTile = () => {
    if (!editing) return;
    setEditing({ ...editing, tiles: [...editing.tiles, { label: "New", image: "", filter: { subcategory: "" } }] });
  };

  const removeTile = (idx: number) => {
    if (!editing) return;
    setEditing({ ...editing, tiles: editing.tiles.filter((_, i) => i !== idx) });
  };

  if (!user || user.role !== "admin") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={styles.gate}>
          <Feather name="lock" size={40} color={colors.mutedText} />
          <Text style={styles.gateTitle}>Admin only</Text>
          <Pressable style={styles.cta} onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.ctaText}>Sign In</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="back-btn">
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Editorials</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.onSurfaceSecondary} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxxl }}>
          <Text style={styles.eyebrow}>SHOP HOME SECTIONS</Text>
          {items.map((ed) => (
            <Pressable
              key={ed.id}
              testID={`editorial-row-${ed.id}`}
              style={styles.row}
              onPress={() => setEditing({ ...ed, tiles: ed.tiles.map((t) => ({ ...t, filter: { ...t.filter } })) })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{ed.title}</Text>
                <Text style={styles.rowSub}>{ed.subtitle}</Text>
                <Text style={styles.rowMeta}>{ed.tiles.length} tiles · Order {ed.order} · {ed.active ? "Active" : "Hidden"}</Text>
              </View>
              <Feather name="edit-2" size={16} color={colors.onSurface} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
          <View style={styles.header}>
            <Pressable onPress={() => setEditing(null)} testID="close-edit"><Feather name="x" size={22} color={colors.onSurface} /></Pressable>
            <Text style={styles.title}>Edit Section</Text>
            <View style={{ width: 22 }} />
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxxl }}>
              {editing && (
                <>
                  <Field label="Title" testID="ed-title" value={editing.title} onChangeText={(v: string) => setEditing({ ...editing, title: v })} />
                  <Field label="Subtitle" testID="ed-subtitle" value={editing.subtitle} onChangeText={(v: string) => setEditing({ ...editing, subtitle: v })} />
                  <Field label="Order" testID="ed-order" value={String(editing.order)} onChangeText={(v: string) => setEditing({ ...editing, order: parseInt(v || "0", 10) })} keyboardType="numeric" />
                  <View style={styles.switchRow}>
                    <Text style={styles.lab}>ACTIVE (visible on shop home)</Text>
                    <Switch
                      testID="ed-active"
                      value={editing.active}
                      onValueChange={(v) => setEditing({ ...editing, active: v })}
                      trackColor={{ true: colors.brand, false: colors.border }}
                    />
                  </View>
                  <Text style={[styles.lab, { marginTop: spacing.md }]}>TILES ({editing.tiles.length})</Text>
                  {editing.tiles.map((t, i) => (
                    <View key={i} style={styles.tileBox} testID={`ed-tile-${i}`}>
                      <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
                        {t.image ? <Image source={{ uri: t.image }} style={styles.tileThumb} contentFit="cover" /> : <View style={[styles.tileThumb, { alignItems: "center", justifyContent: "center" }]}><Feather name="image" size={20} color={colors.mutedText} /></View>}
                        <View style={{ flex: 1 }}>
                          <Field label="Label" testID={`tile-label-${i}`} value={t.label} onChangeText={(v: string) => updateTile(i, "label", v)} />
                        </View>
                        <Pressable onPress={() => removeTile(i)} testID={`tile-remove-${i}`} hitSlop={8}>
                          <Feather name="x" size={18} color={colors.error} />
                        </Pressable>
                      </View>
                      <Field label="Image URL" testID={`tile-image-${i}`} value={t.image} onChangeText={(v: string) => updateTile(i, "image", v)} />
                      <Field label="Filter — subcategory slug (e.g. cups, plates)" testID={`tile-sub-${i}`} value={t.filter.subcategory || ""} onChangeText={(v: string) => updateTile(i, "subcategory", v)} />
                    </View>
                  ))}
                  <Pressable style={styles.addTile} onPress={addTile} testID="add-tile-btn">
                    <Feather name="plus" size={16} color={colors.brand} />
                    <Text style={styles.addTileText}>Add Tile</Text>
                  </Pressable>
                  {err && <Text style={styles.err}>{err}</Text>}
                  <Pressable style={styles.saveBtn} onPress={save} disabled={busy} testID="ed-save-btn">
                    {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.saveText}>Save Section</Text>}
                  </Pressable>
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Field({ label, testID, ...rest }: any) {
  return (
    <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
      <Text style={styles.lab}>{label.toUpperCase()}</Text>
      <TextInput testID={testID} placeholderTextColor={colors.mutedText} style={styles.input} {...rest} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.xl, paddingBottom: spacing.md },
  title: { fontFamily: "CormorantGaramondBold", fontSize: 22, color: colors.onSurface },
  eyebrow: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: colors.mutedText },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  rowTitle: { fontFamily: "CormorantGaramondBold", fontSize: 18, color: colors.onSurface },
  rowSub: { fontFamily: "CormorantGaramond", fontSize: 14, fontStyle: "italic", color: colors.onSurfaceSecondary, marginTop: 2 },
  rowMeta: { fontFamily: "DMSans", fontSize: 11, color: colors.mutedText, marginTop: spacing.xs },
  lab: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: colors.mutedText },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, fontFamily: "DMSans", fontSize: 14, color: colors.onSurface },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md },
  tileBox: { padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, gap: spacing.xs, marginTop: spacing.sm },
  tileThumb: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  addTile: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.brand, borderRadius: radius.md, justifyContent: "center", marginTop: spacing.sm },
  addTileText: { fontFamily: "DMSansMedium", color: colors.brand, fontSize: 13 },
  err: { fontFamily: "DMSans", color: colors.error, backgroundColor: "#F9EDEC", padding: spacing.md, borderRadius: radius.lg },
  saveBtn: { marginTop: spacing.lg, backgroundColor: colors.brand, paddingVertical: spacing.lg, borderRadius: radius.pill, alignItems: "center" },
  saveText: { color: colors.onBrandPrimary, fontFamily: "DMSansBold", letterSpacing: 1.5, textTransform: "uppercase", fontSize: 14 },
  gate: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl, gap: spacing.md },
  gateTitle: { ...type.displaySM },
  cta: { backgroundColor: colors.brand, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, borderRadius: radius.pill },
  ctaText: { color: colors.onBrandPrimary, fontFamily: "DMSansBold", letterSpacing: 1.5, textTransform: "uppercase", fontSize: 13 },
});
