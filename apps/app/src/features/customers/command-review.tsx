import { CircleAlert, TriangleAlert } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Platform, View } from "react-native";

import { type DescriptionItem, DescriptionList } from "@/components/layout/description-list";
import { Section } from "@/components/layout/section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { type CommandState, commandAction } from "./command-state";

type CommandReviewProps = {
  confirmLabel: string;
  description: string;
  destructive?: boolean;
  items: readonly DescriptionItem[];
  onConfirm: () => void;
  onEdit: () => void;
  /** The reads the command was prepared from could not be refreshed. */
  stale?: boolean;
  state: CommandState;
  title: string;
};

/**
 * The exact command about to be committed and its explicit confirmation. An uncertain outcome
 * hides editing and offers only the retry of the same command, which stays available while the
 * reads are stale because the server deduplicates it; a first send waits for a fresh read.
 */
export function CommandReview({
  confirmLabel,
  description,
  destructive = false,
  items,
  onConfirm,
  onEdit,
  stale = false,
  state,
  title,
}: CommandReviewProps) {
  const { t } = useTranslation();
  const action = commandAction(state);
  const regionRef = useRef<View>(null);
  // The control that opened the review is gone; its heading takes focus and scrolls into view.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const root = regionRef.current as unknown as HTMLElement | null;
    const heading = root?.querySelector<HTMLElement>("h1, h2, h3, [role='heading']");
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus();
  }, []);
  return (
    <View ref={regionRef}>
      <Section description={description} title={title}>
        <DescriptionList items={items} />
        {state.phase === "uncertain" ? (
          <Alert icon={TriangleAlert} variant="warning">
            <AlertTitle>{t("common.uncertainTitle")}</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : state.phase === "failed" ? (
          <Alert icon={CircleAlert} variant="destructive">
            <AlertTitle>{t("relationships.command.failedTitle")}</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        {action === "none" ? null : (
          <View className="flex-row flex-wrap items-center gap-2">
            {action === "retry" ? null : (
              <Button
                disabled={action === "waiting"}
                label={t("relationships.command.edit")}
                onPress={onEdit}
                variant="outline"
              />
            )}
            <Button
              disabled={stale && action === "confirm"}
              label={action === "retry" ? t("common.retrySameConfirmation") : confirmLabel}
              loading={action === "waiting"}
              onPress={onConfirm}
              variant={destructive ? "destructive" : "default"}
            />
          </View>
        )}
      </Section>
    </View>
  );
}
