import "@/global.css";

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { QueryProvider } from "@/providers/query-provider";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryProvider>
            <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="sign-in" />
              <Stack.Screen name="sign-up" />
              <Stack.Screen name="(app)" />
            </Stack>
          </QueryProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
