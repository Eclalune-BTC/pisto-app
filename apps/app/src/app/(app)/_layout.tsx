import { Redirect, Slot } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Text } from "@/components/ui/text";
import { authClient } from "@/lib/auth-client";

export default function AuthenticatedLayout() {
  const { t } = useTranslation();
  const { data: session, error, isPending, isRefetching, refetch } = authClient.useSession();

  if (isPending) {
    return (
      <View className="flex-1 items-start justify-center gap-4 bg-background px-5 sm:px-8 lg:px-10 ">
        <LoadingIndicator color="#237A55" size="large" />
        <Text className="text-sm font-ui text-muted-foreground">{t("session.restoring")}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-start justify-center gap-4 bg-background px-5 sm:px-8 lg:px-10 ">
        <View className="max-w-[420px] gap-2">
          <Text className="text-xl font-ui text-foreground">{t("session.checkFailedTitle")}</Text>
          <Text className="text-sm leading-5 text-muted-foreground">
            {t("session.checkFailedDescription")}
          </Text>
        </View>
        <Button
          label={t("session.checkAgain")}
          loading={isRefetching}
          onPress={() => refetch()}
          variant="outline"
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
