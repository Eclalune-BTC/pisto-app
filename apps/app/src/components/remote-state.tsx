import { TriangleAlert, WifiOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";

export function OfflineState({ level = 1, title }: { level?: 1 | 2 | 3; title?: string }) {
  const { t } = useTranslation();
  return (
    <StatePanel
      description={t("remote.offlineDescription")}
      icon={WifiOff}
      level={level}
      title={title ?? t("remote.offlineTitle")}
    />
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
  return (
    <Alert
      action={
        onRetry ? (
          <Button
            label={t("common.retry")}
            loading={loading}
            onPress={loading ? undefined : onRetry}
            size="sm"
            variant="outline"
          />
        ) : undefined
      }
      icon={TriangleAlert}
      variant="warning"
    >
      <AlertDescription>{t("remote.stale")}</AlertDescription>
    </Alert>
  );
}
