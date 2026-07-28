import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox } from "react-native";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/context/AuthContext";
import { CartProvider } from "@/src/context/CartContext";
import { colors } from "@/src/theme";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [iconsLoaded, iconsError] = useIconFonts();
  const [fontsLoaded, fontsError] = useFonts({
    CormorantGaramond: "https://fonts.gstatic.com/s/cormorantgaramond/v18/co3YmX5slCNuHLi8bLeY9MK7whWMhyjornFLsS6V7w.ttf",
    CormorantGaramondBold: "https://fonts.gstatic.com/s/cormorantgaramond/v18/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYrEPjuw72jc0.ttf",
    DMSans: "https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAopxRRA.ttf",
    DMSansMedium: "https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwApJxRRA.ttf",
    DMSansBold: "https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAvJxRRA.ttf",
  });

  const ready = (iconsLoaded || iconsError) && (fontsLoaded || fontsError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaProvider>
        <AuthProvider>
          <CartProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.surface },
                animation: "fade",
              }}
            />
          </CartProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
