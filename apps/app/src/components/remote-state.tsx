import { WifiOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

export function OfflineState({ title }: { title?: string }) {
  const { t } = useTranslation();
  return (
    <View className="w-full max-w-[560px] flex-1 items-start justify-center gap-3 px-6">
      <WifiOff color="#617168" size={24} />
      <Text className="text-xl font-black text-ink dark:text-white">
        {title ?? t("remote.offlineTitle")}
      </Text>
      <Text className="max-w-[460px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
        {t("remote.offlineDescription")}
      </Text>
    </View>
  );
}

export function StaleNotice() {
  const { t } = useTranslation();
  return (
    <View className="border-l-4 border-warning bg-[#FFF6E8] p-3 dark:bg-[#3A2A18]">
      <Text className="text-sm leading-5 text-ink dark:text-[#F2E4D2]">{t("remote.stale")}</Text>
    </View>
  );
}
