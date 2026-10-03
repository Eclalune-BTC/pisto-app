import { View } from "react-native";
import { DetailList } from "@/components/detail-list";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

import type { CashConfirmationState } from "./state";

export type CashOperationReviewCopy = {
  confirm: string;
  edit: string;
  failedTitle: string;
  uncertainTitle: string;
  uncertainDescription: string;
  retrySameConfirmation: string;
};

type CashOperationReviewProps = {
  rows: { label: string; value: string }[];
  effect: string;
  state: CashConfirmationState;
  errorMessage?: string;
  disabled?: boolean;
  copy: CashOperationReviewCopy;
  onConfirm: () => void;
  onEdit: () => void;
  onCheckStatus: () => void;
};

export function CashOperationReview({
  rows,
  effect,
  state,
  errorMessage,
  disabled = false,
  copy,
  onConfirm,
  onEdit,
  onCheckStatus,
}: CashOperationReviewProps) {
  return (
    <View className="gap-7">
      <DetailList items={rows} />
      <Text className="text-sm leading-5 text-muted-foreground">{effect}</Text>

      {state === "uncertain" ? (
        <View className="gap-3 border-l-4 border-warning bg-warning-surface p-4 ">
          <Text
            accessibilityRole="alert"
            className="font-ui text-foreground text-warning-foreground"
          >
            {copy.uncertainTitle}
          </Text>
          <Text className="text-sm leading-5 text-muted-foreground text-warning-foreground">
            {copy.uncertainDescription}
          </Text>
          <Button
            className="self-start"
            disabled={disabled}
            label={copy.retrySameConfirmation}
            onPress={onCheckStatus}
            variant="outline"
          />
        </View>
      ) : state === "failed" ? (
        <View className="gap-2 border-l-4 border-danger bg-destructive-surface p-4 ">
          <Text accessibilityRole="alert" className="font-ui text-destructive ">
            {copy.failedTitle}
          </Text>
          {errorMessage ? (
            <Text className="text-sm leading-5 text-muted-foreground ">{errorMessage}</Text>
          ) : null}
        </View>
      ) : null}

      {state !== "uncertain" ? (
        <View className="gap-3 sm:flex-row">
          <Button
            label={copy.confirm}
            disabled={disabled}
            loading={state === "pending"}
            onPress={onConfirm}
            variant="default"
          />
          <Button
            disabled={state === "pending"}
            label={copy.edit}
            onPress={onEdit}
            variant="outline"
          />
        </View>
      ) : null}
    </View>
  );
}
