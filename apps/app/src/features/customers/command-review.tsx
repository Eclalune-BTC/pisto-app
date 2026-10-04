import { CircleAlert, TriangleAlert } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

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
  state: CommandState;
  title: string;
};

/**
 * The exact command about to be committed and its explicit confirmation. An uncertain outcome
 * hides editing and offers only the retry of the same command.
 */
export function CommandReview({
  confirmLabel,
  description,
  destructive = false,
  items,
  onConfirm,
  onEdit,
  state,
  title,
}: CommandReviewProps) {
  const { t } = useTranslation();
  const action = commandAction(state);
  return (
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
            label={action === "retry" ? t("common.retrySameConfirmation") : confirmLabel}
            loading={action === "waiting"}
            onPress={onConfirm}
            variant={destructive ? "destructive" : "default"}
          />
        </View>
      )}
    </Section>
  );
}
