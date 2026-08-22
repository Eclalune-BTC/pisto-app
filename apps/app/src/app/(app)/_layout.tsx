import { Redirect, Slot } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

import { AppShell } from "@/components/app-shell";
import { authClient } from "@/lib/auth-client";

export default function AuthenticatedLayout() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-canvas dark:bg-[#0F1D18]">
        <ActivityIndicator color="#237A55" size="large" />
        <Text className="text-sm font-semibold text-ink-muted dark:text-[#AAB8B0]">
          Restoring your secure session…
        </Text>
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <AppShell email={session.user.email} name={session.user.name}>
      <Slot />
    </AppShell>
  );
}
