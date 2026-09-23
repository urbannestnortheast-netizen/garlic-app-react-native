import React, { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { ProductEditor } from "@/src/admin/product-editor";
import { useAdminTheme } from "@/src/admin/theme";
import { AdminEmpty } from "@/src/admin/ui";
import { api } from "@/src/api/client";

export default function EditProductRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useAdminTheme();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        const p = await api(`/products/${id}`);
        setProduct(p);
      } catch (e: any) {
        setErr(e?.message || "Could not load product");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={t.colors.primary} />
      </SafeAreaView>
    );
  }
  if (err || !product) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: t.colors.bg }}>
        <AdminEmpty icon="alert-circle" title="Product not found" subtitle={err || undefined} />
      </SafeAreaView>
    );
  }
  return <ProductEditor productId={id as string} initial={product} />;
}
