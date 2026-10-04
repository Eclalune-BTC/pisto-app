import "@/global.css";

import { IBMPlexSans_400Regular } from "@expo-google-fonts/ibm-plex-sans/400Regular";
import { IBMPlexSans_500Medium } from "@expo-google-fonts/ibm-plex-sans/500Medium";
import { IBMPlexSans_600SemiBold } from "@expo-google-fonts/ibm-plex-sans/600SemiBold";
import { PortalHost } from "@rn-primitives/portal";
import { useFonts } from "expo-font";
import { type ErrorBoundaryProps, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useUniwind } from "uniwind";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { i18n } from "@/i18n/config";
import { useNavigationTheme } from "@/lib/navigation-theme";
import { AppearanceProvider } from "@/providers/appearance-provider";
import { I18nProvider } from "@/providers/i18n-provider";
import { QueryProvider } from "@/providers/query-provider";

void SplashScreen.preventAutoHideAsync();

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);
  const systemFont =
    Platform.OS === "web" ? "system-ui" : Platform.OS === "ios" ? "System" : "sans-serif";
  return (
    <SafeAreaProvider>
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView contentContainerClassName="flex-grow justify-center p-5">
          <View className="mx-auto w-full max-w-[420px] gap-4" role="main">
            <Heading style={{ fontFamily: systemFont }}>{i18n.t("startup.errorTitle")}</Heading>
            <Text
              accessibilityRole="alert"
              className="text-base leading-6 text-muted-foreground"
              style={{ fontFamily: systemFont }}
            >
              {i18n.t("startup.errorDescription")}
            </Text>
            <Button
              className="self-start"
              onPress={() => {
                if (Platform.OS === "web") window.location.reload();
                else void retry();
              }}
            >
              <Text
                className="text-base text-primary-foreground"
                style={{ fontFamily: systemFont }}
              >
                {i18n.t("common.retry")}
              </Text>
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  const { theme } = useUniwind();
  const navigationTheme = useNavigationTheme(theme === "dark");
  const [fontsLoaded, fontError] = useFonts({
    PistoRegular: IBMPlexSans_400Regular,
    PistoMedium: IBMPlexSans_500Medium,
    PistoSemibold: IBMPlexSans_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (fontError) throw fontError;
  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={navigationTheme}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <I18nProvider>
            <AppearanceProvider>
              <QueryProvider>
                <StatusBar style={theme === "dark" ? "light" : "dark"} />
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="sign-in" />
                  <Stack.Screen name="sign-up" />
                  <Stack.Screen name="(app)" />
                </Stack>
                <PortalHost />
              </QueryProvider>
            </AppearanceProvider>
          </I18nProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
