import { AlertTriangle, WifiOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

export function OfflineState({ level = 1, title }: { level?: 1 | 2 | 3; title?: string }) {
  const { t } = useTranslation();
  return (
    <View className="w-full max-w-[560px] flex-1 items-start justify-center gap-3 px-6">
      <Icon as={WifiOff} className="text-muted-foreground" size={24} />
      <Heading level={level} size="section">
        {title ?? t("remote.offlineTitle")}
      </Heading>
      <Text className="max-w-[460px] text-sm leading-5 text-muted-foreground">
        {t("remote.offlineDescription")}
      </Text>
    </View>
  );
}

export function StaleNotice({
  onRetry,
  loading = false,
}: {
  onRetry?: () => void;
  loading?: boolean;
} = {}) {
  const { t } = useTranslation();
  const notice = (
    <Alert icon={AlertTriangle} variant="default">
      <AlertDescription>{t("remote.stale")}</AlertDescription>
    </Alert>
  );
  if (!onRetry) return notice;
  return (
    <View className="gap-3">
      {notice}
      <Button
        className="self-start"
        label={t("common.retry")}
        loading={loading}
        onPress={loading ? undefined : onRetry}
        size="sm"
        variant="outline"
      />
    </View>
  );
}
