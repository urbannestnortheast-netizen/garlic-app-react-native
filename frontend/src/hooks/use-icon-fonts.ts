// Icon font loader for Expo apps. Fonts are loaded from a CDN only under
// Expo Go (StoreClient) — that's where @react-native-vector-icons .ttf files
// come back as 0 bytes from Metro's asset resolver on Android. Native
// dev/prod builds and web pass an empty map, so useFonts resolves to
// [true, null] immediately via react-native-vector-icons autolinking / web stubs.
// Only Feather is used across the app.
// Usage: const [loaded, error] = useIconFonts();

import Constants, { ExecutionEnvironment } from "expo-constants";
import { useFonts } from "expo-font";

// Must match @react-native-vector-icons/feather in package.json
const FEATHER_VERSION = "13.1.4";

// Font-name key that @react-native-vector-icons/feather queries -> CDN .ttf URL
const iconFontMap = (): Record<string, string> => ({
  Feather: `https://cdn.jsdelivr.net/npm/@react-native-vector-icons/feather@${FEATHER_VERSION}/Fonts/Feather.ttf`,
});

export const useIconFonts = (): readonly [boolean, Error | null] =>
  useFonts(
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient
      ? iconFontMap()
      : {},
  );
