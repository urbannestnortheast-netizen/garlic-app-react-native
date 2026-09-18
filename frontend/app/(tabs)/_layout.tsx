import React from "react";
import { Tabs } from "expo-router";
import Feather from "@react-native-vector-icons/feather";
import { StyleSheet, View, Text } from "react-native";
import { colors, spacing } from "@/src/theme";
import { useCart } from "@/src/context/CartContext";

function CartIcon({ color, size }: { color: string; size: number }) {
  const { count } = useCart();
  return (
    <View>
      <Feather name="shopping-bag" size={size} color={color} />
      {count > 0 && (
        <View style={styles.badge} testID="cart-badge">
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.onSurface,
        tabBarInactiveTintColor: colors.mutedText,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 76,
          paddingTop: spacing.sm,
          paddingBottom: spacing.md,
        },
        tabBarLabelStyle: { fontFamily: "DMSansMedium", fontSize: 11, letterSpacing: 0.5 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Shop",
          tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />,
          tabBarButtonTestID: "tab-shop",
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: "Wishlist",
          tabBarIcon: ({ color, size }) => <Feather name="heart" size={size} color={color} />,
          tabBarButtonTestID: "tab-wishlist",
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: ({ color, size }) => <CartIcon color={color} size={size} />,
          tabBarButtonTestID: "tab-cart",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
          tabBarButtonTestID: "tab-profile",
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute", top: -4, right: -8,
    backgroundColor: colors.brandPrimary, minWidth: 16, height: 16,
    borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
  },
  badgeText: { fontFamily: "DMSansBold", fontSize: 9, color: colors.onBrandPrimary },
});
