import { AuthProvider } from "@/providers/auth-provider";
import { FarmDataProvider } from "@/providers/farm-data-provider";
import { StockAlertProvider } from "@/providers/stock-alert-provider";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { initLogger } from "@/utils/logger";

SplashScreen.preventAutoHideAsync().catch(() => null);

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Initialize on app start so log directory exists before first writes.
    initLogger().catch(() => null);
  }, []);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => null);
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <FarmDataProvider>
          <StockAlertProvider>
            <ThemeProvider value={DefaultTheme}>
              <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen
                  name="logoscreen"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="loginscreen"
                  options={{ headerShown: false }}
                />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="admin" options={{ headerShown: false }} />
                <Stack.Screen
                  name="modal"
                  options={{
                    presentation: "modal",
                    title: "Modal",
                  }}
                />
              </Stack>
              <StatusBar style="dark" />
            </ThemeProvider>
          </StockAlertProvider>
        </FarmDataProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
