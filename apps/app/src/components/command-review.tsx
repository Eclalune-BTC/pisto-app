import { CircleAlert, TriangleAlert } from "lucide-react-native";
import { type ReactNode, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Platform, View } from "react-native";
import { type DescriptionItem, DescriptionList } from "@/components/layout/description-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { isLockedPhase, type MutationPhase } from "@/lib/mutation-phase";

type CommandReviewProps = {
  /** Figures shown above the summary, such as the balance a movement changes. */
  children?: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  /** Access or freshness was lost; it blocks a first confirmation, never the same-command retry. */
  disabled?: boolean;
  errorMessage?: string;
  failedTitle?: string;
  items: readonly DescriptionItem[];
  /** The consequence of confirming, stated under the facts. */
  note?: string;
  onConfirm: () => void;
  onEdit: () => void;
  phase: MutationPhase;
  /** Names the review region that receives focus; the page header shows it. */
  title: string;
  uncertainDescription?: string;
};

/**
 * The exact command about to be committed. While it is pending or its outcome is unknown, the
 * way back to editing is closed: only the same reviewed command may be sent again.
 */
export function CommandReview({
  children,
  confirmLabel,
  destructive = false,
  disabled = false,
  errorMessage,
  failedTitle,
  items,
  note,
  onConfirm,
  onEdit,
  phase,
  title,
  uncertainDescription,
}: CommandReviewProps) {
  const { t } = useTranslation();
  const region = useRef<View>(null);
  const locked = isLockedPhase(phase);
  useEffect(() => {
    // The button that opened the review left with the form; keyboard focus follows the step.
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
      {children}
      <DescriptionList items={items} />
      {note ? <Text className="text-[13px] leading-5 text-muted-foreground">{note}</Text> : null}
      {phase === "uncertain" ? (
        <Alert icon={TriangleAlert} variant="warning">
          <AlertTitle>{t("common.uncertainTitle")}</AlertTitle>
          <AlertDescription>
            {uncertainDescription || t("common.reviewUncertainDescription")}
          </AlertDescription>
        </Alert>
      ) : phase === "failed" ? (
        <Alert icon={CircleAlert} variant="destructive">
          <AlertTitle>{failedTitle ?? t("common.reviewFailedTitle")}</AlertTitle>
          {errorMessage ? <AlertDescription>{errorMessage}</AlertDescription> : null}
        </Alert>
      ) : null}
      <View className="flex-row flex-wrap justify-end gap-2 pt-1">
        {phase === "uncertain" ? (
          <Button label={t("common.retrySameConfirmation")} onPress={onConfirm} />
        ) : (
          <>
            <Button
              disabled={locked}
              label={t("common.editData")}
              onPress={locked ? undefined : onEdit}
              variant="outline"
            />
            <Button
              disabled={disabled}
              label={confirmLabel}
              loading={phase === "pending"}
              onPress={disabled || locked ? undefined : onConfirm}
              variant={destructive ? "destructive" : "default"}
            />
          </>
        )}
      </View>
    </View>
  );
}
