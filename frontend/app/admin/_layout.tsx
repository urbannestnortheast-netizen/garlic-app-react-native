import React, { useEffect } from "react";
import { View, ActivityIndicator, StatusBar, Platform } from "react-native";
import { Tabs, useRouter, Redirect } from "expo-router";
import Feather from "@react-native-vector-icons/feather";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AdminThemeProvider, useAdminTheme } from "@/src/admin/theme";
import { useAuth } from "@/src/context/AuthContext";

function TabBarIcon({ name, color }: { name: string; color: string }) {
  return <Feather name={name as any} size={22} color={color} />;
}

function AdminTabsInner() {
  const t = useAdminTheme();
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.replace("/(auth)/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={t.colors.primary} />
      </View>
    );
  }
  if (!user || user.role !== "admin") {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <>
      {Platform.OS !== "web" ? (
        <StatusBar barStyle={t.isDark ? "light-content" : "dark-content"} backgroundColor={t.colors.bg} />
      ) : null}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: t.colors.primary,
          tabBarInactiveTintColor: t.colors.mutedText,
          tabBarStyle: {
            backgroundColor: t.colors.surface,
            borderTopColor: t.colors.border,
            borderTopWidth: 1,
            height: Platform.select({ ios: 88, default: 64 }),
            paddingTop: 6,
            paddingBottom: Platform.select({ ios: 24, default: 8 }),
          },
          tabBarLabelStyle: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 0.4 },
          sceneStyle: { backgroundColor: t.colors.bg },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
            tabBarAccessibilityLabel: "Dashboard",
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: "Orders",
            tabBarIcon: ({ color }) => <TabBarIcon name="shopping-bag" color={color} />,
            tabBarAccessibilityLabel: "Orders",
          }}
        />
        <Tabs.Screen
          name="products"
          options={{
            title: "Products",
            tabBarIcon: ({ color }) => <TabBarIcon name="package" color={color} />,
            tabBarAccessibilityLabel: "Products",
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: "More",
            tabBarIcon: ({ color }) => <TabBarIcon name="grid" color={color} />,
            tabBarAccessibilityLabel: "More options",
          }}
        />
        {/* Non-tab routes hidden from tab bar */}
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="order/[id]" options={{ href: null }} />
        <Tabs.Screen name="product/[id]" options={{ href: null }} />
        <Tabs.Screen name="product/new" options={{ href: null }} />
        <Tabs.Screen name="inventory" options={{ href: null }} />
        <Tabs.Screen name="customers" options={{ href: null }} />
        <Tabs.Screen name="customer/[id]" options={{ href: null }} />
        <Tabs.Screen name="reviews" options={{ href: null }} />
        <Tabs.Screen name="promotions" options={{ href: null }} />
      </Tabs>
    </>
  );
}

export default function AdminLayout() {
  return (
    <SafeAreaProvider>
      <AdminThemeProvider>
        <AdminTabsInner />
      </AdminThemeProvider>
    </SafeAreaProvider>
  );
}
