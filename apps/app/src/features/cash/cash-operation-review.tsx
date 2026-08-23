import { Text, View } from "react-native";

import { DetailList } from "@/components/detail-list";
import { Button } from "@/components/ui/button";

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
  copy,
  onConfirm,
  onEdit,
  onCheckStatus,
}: CashOperationReviewProps) {
  return (
    <View className="gap-7">
      <DetailList items={rows} />
      <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">{effect}</Text>

      {state === "uncertain" ? (
        <View className="gap-3 border-l-4 border-warning bg-[#FFF6E8] p-4 dark:bg-[#3A2A18]">
          <Text accessibilityRole="alert" className="font-bold text-ink dark:text-[#F2E4D2]">
            {copy.uncertainTitle}
          </Text>
          <Text className="text-sm leading-5 text-ink-muted dark:text-[#D7C7B4]">
            {copy.uncertainDescription}
          </Text>
          <Button
            className="self-start"
            label={copy.retrySameConfirmation}
            onPress={onCheckStatus}
            variant="secondary"
          />
        </View>
      ) : state === "failed" ? (
        <View className="gap-2 border-l-4 border-danger bg-[#FFF1F1] p-4 dark:bg-[#3A2020]">
          <Text accessibilityRole="alert" className="font-bold text-danger dark:text-[#FFBABA]">
            {copy.failedTitle}
          </Text>
          {errorMessage ? (
            <Text className="text-sm leading-5 text-ink-muted dark:text-[#C9D4CE]">
              {errorMessage}
            </Text>
          ) : null}
        </View>
      ) : null}

      {state !== "uncertain" ? (
        <View className="gap-3 sm:flex-row">
          <Button
            label={copy.confirm}
            loading={state === "pending"}
            onPress={onConfirm}
            variant="accent"
          />
          <Button
            disabled={state === "pending"}
            label={copy.edit}
            onPress={onEdit}
            variant="secondary"
          />
        </View>
      ) : null}
    </View>
  );
}
