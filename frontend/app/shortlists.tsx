import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput,
  Modal, KeyboardAvoidingView, Platform, useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import Feather from "@react-native-vector-icons/feather";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing, type } from "@/src/theme";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";

type ShortlistProduct = { id: string; name: string; price: number; images: string[]; bought: boolean };
type Shortlist = {
  id: string; name: string; occasion: string; message: string;
  cover_image: string; share_slug: string; products: ShortlistProduct[]; count: number;
};

export default function ShortlistsList() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const CARD_W = (width - spacing.xl * 2 - spacing.md) / 2;
  const styles = React.useMemo(() => makeStyles(CARD_W), [CARD_W]);
  const [lists, setLists] = useState<Shortlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", occasion: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const data = await api<Shortlist[]>("/shortlists", { auth: true });
      setLists(data);
    } catch {}
    finally { setLoading(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const create = async () => {
    setErr(null);
    if (!form.name.trim()) return setErr("Give your Nest Table a name.");
    setBusy(true);
    try {
      const sl = await api<Shortlist>("/shortlists", { method: "POST", auth: true, body: form });
      setModalOpen(false);
      setForm({ name: "", occasion: "", message: "" });
      router.push(`/shortlist/${sl.id}`);
    } catch (e: any) {
      setErr(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} testID="back-btn">
            <Feather name="arrow-left" size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>The Nest Table</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.emptyWrap} testID="shortlist-signin">
          <Feather name="bookmark" size={40} color={colors.mutedText} />
          <Text style={styles.emptyTitle}>Sign in to curate</Text>
          <Text style={styles.emptyText}>Create shareable gift shortlists for weddings, housewarmings & birthdays.</Text>
          <Pressable style={styles.cta} testID="shortlist-signin-btn" onPress={() => router.push("/(auth)/login")}>
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
        <Text style={styles.title}>Nest Table</Text>
        <Pressable onPress={() => setModalOpen(true)} hitSlop={12} testID="new-shortlist-btn">
          <Feather name="plus" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxxl }}>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>SHAREABLE GIFT REGISTRIES</Text>
          <Text style={styles.heroTitle}>Curate & share{"\n"}your dream list</Text>
          <Text style={styles.heroSub}>Perfect for weddings, housewarmings, and birthdays. Share a link — friends can see and buy.</Text>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.onSurfaceSecondary} />
        ) : lists.length === 0 ? (
          <View style={styles.emptyWrap} testID="shortlists-empty">
            <Feather name="bookmark" size={40} color={colors.mutedText} />
            <Text style={styles.emptyTitle}>Your first Nest Table awaits</Text>
            <Text style={styles.emptyText}>Tap the + above to start curating.</Text>
            <Pressable style={styles.cta} testID="create-first-btn" onPress={() => setModalOpen(true)}>
              <Text style={styles.ctaText}>Create Nest Table</Text>
            </Pressable>
          </View>
        ) : (
          lists.map((sl) => (
            <Pressable
              key={sl.id}
              testID={`shortlist-${sl.id}`}
              style={styles.card}
              onPress={() => router.push(`/shortlist/${sl.id}`)}
            >
              <View style={styles.thumbsRow}>
                {sl.products.slice(0, 3).map((p) => (
                  <Image key={p.id} source={{ uri: p.images[0] }} style={styles.thumb} contentFit="cover" />
                ))}
                {sl.products.length === 0 && (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <Feather name="bookmark" size={22} color={colors.mutedText} />
                  </View>
                )}
              </View>
              <View style={{ padding: spacing.lg, gap: 4 }}>
                {sl.occasion ? <Text style={styles.cardEyebrow}>{sl.occasion.toUpperCase()}</Text> : null}
                <Text style={styles.cardName}>{sl.name}</Text>
                <Text style={styles.cardMeta}>{sl.count} {sl.count === 1 ? "piece" : "pieces"}</Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalBg}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>New Nest Table</Text>
              <Pressable onPress={() => setModalOpen(false)} testID="close-modal">
                <Feather name="x" size={22} color={colors.onSurface} />
              </Pressable>
            </View>
            <TextInput
              testID="shortlist-name-input"
              style={styles.input}
              placeholder="e.g. Priya & Rohan's Home"
              placeholderTextColor={colors.mutedText}
              value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v })}
            />
            <TextInput
              testID="shortlist-occasion-input"
              style={styles.input}
              placeholder="Occasion (e.g. Wedding, Housewarming)"
              placeholderTextColor={colors.mutedText}
              value={form.occasion}
              onChangeText={(v) => setForm({ ...form, occasion: v })}
            />
            <TextInput
              testID="shortlist-message-input"
              style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
              placeholder="A note for your friends..."
              placeholderTextColor={colors.mutedText}
              multiline
              value={form.message}
              onChangeText={(v) => setForm({ ...form, message: v })}
            />
            {err && <Text style={styles.err}>{err}</Text>}
            <Pressable style={styles.createBtn} onPress={create} disabled={busy} testID="create-shortlist-btn">
              {busy ? <ActivityIndicator color={colors.onSurfaceInverse} /> : <Text style={styles.createText}>Create</Text>}
            </Pressable>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (CARD_W: number) => StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.xl, paddingBottom: spacing.md },
  title: { fontFamily: "CormorantGaramondBold", fontSize: 22, color: colors.onSurface },
  hero: { backgroundColor: colors.accentLight, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm },
  heroEyebrow: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 2, color: colors.brandDark },
  heroTitle: { fontFamily: "CormorantGaramondBold", fontSize: 28, lineHeight: 32, color: colors.onSurface, marginTop: spacing.sm },
  heroSub: { fontFamily: "DMSans", fontSize: 13, color: colors.onSurfaceSecondary, marginTop: spacing.xs, lineHeight: 20 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: "hidden" },
  thumbsRow: { flexDirection: "row", height: 140 },
  thumb: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRightWidth: 1, borderRightColor: colors.surface },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  cardEyebrow: { fontFamily: "DMSansMedium", fontSize: 10, letterSpacing: 2, color: colors.brandDark },
  cardName: { fontFamily: "CormorantGaramondBold", fontSize: 22, color: colors.onSurface, lineHeight: 26 },
  cardMeta: { fontFamily: "DMSans", fontSize: 12, color: colors.mutedText },
  emptyWrap: { alignItems: "center", padding: spacing.xxl, gap: spacing.md, marginTop: spacing.xl },
  emptyTitle: { ...type.displaySM, marginTop: spacing.md, textAlign: "center" },
  emptyText: { ...type.body, textAlign: "center", maxWidth: "90%" },
  cta: { marginTop: spacing.md, backgroundColor: colors.brand, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, borderRadius: radius.pill },
  ctaText: { color: colors.onBrandPrimary, fontFamily: "DMSansBold", letterSpacing: 1.5, textTransform: "uppercase", fontSize: 13 },
  modalBg: { flex: 1, backgroundColor: "rgba(44,41,37,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surface, padding: spacing.xl, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  modalTitle: { fontFamily: "CormorantGaramondBold", fontSize: 24, color: colors.onSurface },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, fontFamily: "DMSans", fontSize: 15, color: colors.onSurface },
  createBtn: { backgroundColor: colors.brand, paddingVertical: spacing.lg, borderRadius: radius.pill, alignItems: "center", marginTop: spacing.sm },
  createText: { color: colors.onBrandPrimary, fontFamily: "DMSansBold", letterSpacing: 1.5, textTransform: "uppercase", fontSize: 14 },
  err: { fontFamily: "DMSans", color: colors.error, backgroundColor: "#F9EDEC", padding: spacing.md, borderRadius: radius.lg },
});
