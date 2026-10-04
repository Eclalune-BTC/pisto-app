import { type Href, Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

/**
 * The end of a form: leaving for the parent route, then the primary step. Cancelling replaces the
 * abandoned form in history so going back does not reopen it.
 */
export function FormActions({
  cancelHref,
  destructive = false,
  disabled = false,
  onSubmit,
  submitLabel,
}: {
  cancelHref: Href;
  destructive?: boolean;
  disabled?: boolean;
  onSubmit: () => void;
  submitLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <Link asChild href={cancelHref} replace>
        <Button accessibilityRole="link" variant="outline">
          <Text>{t("common.cancel")}</Text>
        </Button>
      </Link>
      <Button
        disabled={disabled}
        label={submitLabel}
        onPress={onSubmit}
        variant={destructive ? "destructive" : "default"}
      />
    </View>
  );
}
