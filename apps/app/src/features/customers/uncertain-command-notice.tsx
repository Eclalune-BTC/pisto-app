import { TriangleAlert } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Keeps an unresolved confirmation visible after its dialog is closed, so the page never looks
 * settled while the server may have committed the command. Resuming reopens the same command.
 */
export function UncertainCommandNotice({
  message,
  onResume,
}: {
  message: string;
  onResume: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Alert
      action={<Button label={t("common.retry")} onPress={onResume} size="sm" variant="outline" />}
      icon={TriangleAlert}
      variant="warning"
    >
      <AlertTitle>{t("common.uncertainTitle")}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
