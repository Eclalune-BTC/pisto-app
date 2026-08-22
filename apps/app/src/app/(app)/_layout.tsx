import { Redirect, Slot } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function AuthenticatedLayout() {
  const { data: session, error, isPending, isRefetching, refetch } = authClient.useSession();

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

  if (error) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-canvas px-6 dark:bg-[#0F1D18]">
        <View className="max-w-[420px] gap-2">
          <Text className="text-center text-xl font-bold text-ink dark:text-white">
            Session check failed
          </Text>
          <Text className="text-center text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
            Pisto could not confirm whether you are signed in. Your account state has not been
            changed.
          </Text>
        </View>
        <Button
          label="Retry session check"
          loading={isRefetching}
          onPress={() => refetch()}
          variant="secondary"
        />
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
