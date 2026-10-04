import { CircleAlert, TriangleAlert } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Platform, View } from "react-native";
import { type DescriptionItem, DescriptionList } from "@/components/layout/description-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { MutationPhase } from "@/lib/mutation-phase";

type CashOperationReviewProps = {
  confirmLabel: string;
  /** Access or freshness was lost; it blocks the first confirmation, never the same-command retry. */
  disabled?: boolean;
  effect: string;
  errorMessage?: string;
  items: readonly DescriptionItem[];
  onConfirm: () => void;
  onEdit: () => void;
  phase: MutationPhase;
  /** Names the review region that receives focus. */
  title: string;
};

/**
 * The exact command about to be committed. An uncertain outcome removes the way back to editing:
 * only the same reviewed command may be sent again.
 */
export function CashOperationReview({
  confirmLabel,
  disabled = false,
  effect,
  errorMessage,
  items,
  onConfirm,
  onEdit,
  phase,
  title,
}: CashOperationReviewProps) {
  const { t } = useTranslation();
  const region = useRef<View>(null);
  useEffect(() => {
    // The button that opened the review is gone with the form; keyboard focus follows the step.
    if (Platform.OS === "web") (region.current as unknown as HTMLElement | null)?.focus();
  }, []);
  return (
    <View
      accessibilityLabel={title}
      className="gap-4 web:outline-none"
      ref={region}
      role="region"
      tabIndex={-1}
    >
      <DescriptionList items={items} />
      <Text className="text-[13px] leading-5 text-muted-foreground">{effect}</Text>
      {phase === "uncertain" ? (
        <Alert icon={TriangleAlert} variant="warning">
          <AlertTitle>{t("common.uncertainTitle")}</AlertTitle>
          <AlertDescription>{t("cash.review.uncertainDescription")}</AlertDescription>
        </Alert>
      ) : phase === "failed" ? (
        <Alert icon={CircleAlert} variant="destructive">
          <AlertTitle>{t("cash.review.failedTitle")}</AlertTitle>
          {errorMessage ? <AlertDescription>{errorMessage}</AlertDescription> : null}
        </Alert>
      ) : null}
      <View className="flex-row flex-wrap justify-end gap-2">
        {phase === "uncertain" ? (
          <Button label={t("common.retrySameConfirmation")} onPress={onConfirm} />
        ) : (
          <>
            <Button
              disabled={phase === "pending"}
              label={t("common.edit")}
              onPress={onEdit}
              variant="outline"
            />
            <Button
              disabled={disabled}
              label={confirmLabel}
              loading={phase === "pending"}
              onPress={onConfirm}
            />
          </>
        )}
      </View>
    </View>
  );
}
