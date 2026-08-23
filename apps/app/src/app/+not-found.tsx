import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";

export default function NotFoundRoute() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Page width="reading">
      <View className="min-h-64 items-start justify-center gap-4">
        <Text accessibilityRole="header" className="text-2xl font-black text-ink dark:text-white">
          {t("notFound.title")}
        </Text>
        <Text className="max-w-[520px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
          {t("notFound.description")}
        </Text>
        <Button
          label={t("notFound.action")}
          onPress={() => router.replace("/")}
          variant="secondary"
        />
      </View>
    </Page>
  );
}
