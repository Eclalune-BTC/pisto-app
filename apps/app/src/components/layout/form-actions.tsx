import { type Href, Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

type FormActionsProps = {
  destructive?: boolean;
  disabled?: boolean;
  onSubmit: () => void;
  submitLabel: string;
} & (
  | {
      /** Leaving replaces the abandoned form in history so going back does not reopen it. */
      cancelHref: Href;
      onCancel?: never;
    }
  | { cancelHref?: never; onCancel: () => void }
);

/** The end of every form: cancel, then the primary step, aligned to the trailing edge. */
export function FormActions({
  cancelHref,
  destructive = false,
  disabled = false,
  onCancel,
  onSubmit,
  submitLabel,
}: FormActionsProps) {
  const { t } = useTranslation();
  return (
    <View className="flex-row flex-wrap items-center justify-end gap-2 pt-1">
      {cancelHref ? (
        <Link asChild href={cancelHref} replace>
          <Button accessibilityRole="link" variant="outline">
            <Text>{t("common.cancel")}</Text>
          </Button>
        </Link>
      ) : (
        <Button label={t("common.cancel")} onPress={onCancel} variant="outline" />
      )}
      <Button
        disabled={disabled}
        label={submitLabel}
        onPress={disabled ? undefined : onSubmit}
        variant={destructive ? "destructive" : "default"}
      />
    </View>
  );
}
