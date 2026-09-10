import { Redirect, Slot } from "expo-router";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function AuthenticatedLayout() {
  const { t } = useTranslation();
  const { data: session, error, isPending, isRefetching, refetch } = authClient.useSession();

  if (isPending) {
    return (
      <View className="flex-1 items-start justify-center gap-4 bg-canvas px-5 sm:px-8 lg:px-10 dark:bg-[#0F1D18]">
        <ActivityIndicator color="#237A55" size="large" />
        <Text className="text-sm font-semibold text-muted-foreground">
          {t("session.restoring")}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-start justify-center gap-4 bg-canvas px-5 sm:px-8 lg:px-10 dark:bg-[#0F1D18]">
        <View className="max-w-[420px] gap-2">
          <Text className="text-xl font-bold text-foreground">{t("session.checkFailedTitle")}</Text>
          <Text className="text-sm leading-5 text-muted-foreground">
            {t("session.checkFailedDescription")}
          </Text>
        </View>
        <Button
          label={t("session.checkAgain")}
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
    <AppShell key={session.user.id} email={session.user.email} name={session.user.name}>
      <Slot />
    </AppShell>
  );
}
