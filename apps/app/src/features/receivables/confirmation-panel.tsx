import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";

import {
  type ConfirmationCopy,
  type ConfirmationField,
  type FinancialMutationState,
  financialMutationAction,
} from "./types";

type ConfirmationPanelProps = {
  copy: ConfirmationCopy;
  fields: ConfirmationField[];
  mutation: FinancialMutationState;
  onCancel: () => void;
  onConfirm: () => void;
  onRetrySameCommand: () => void;
};

export function ConfirmationPanel({
  copy,
  fields,
  mutation,
  onCancel,
  onConfirm,
  onRetrySameCommand,
}: ConfirmationPanelProps) {
  const action = financialMutationAction(mutation);
  return (
    <View className="gap-6">
      <Text accessibilityRole="header" className="text-2xl font-black text-ink dark:text-white">
        {copy.reviewTitle}
      </Text>
      <View className="border-y border-line dark:border-[#304239]">
        {fields.map((field) => (
          <View
            className="gap-1 border-b border-line py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-8 dark:border-[#304239]"
            key={field.label}
          >
            <Text className="text-sm font-semibold text-ink-muted dark:text-[#AAB8B0]">
              {field.label}
            </Text>
            <Text className="max-w-[540px] text-base font-bold text-ink sm:text-right dark:text-white">
              {field.value}
            </Text>
          </View>
        ))}
      </View>
      {mutation.kind === "uncertain" ? (
        <View className="gap-2 border-l-4 border-warning bg-[#FFF6E8] p-4 dark:bg-[#3A2A18]">
          <Text className="font-bold text-ink dark:text-white">{copy.uncertainTitle}</Text>
          <Text className="text-sm leading-5 text-ink-muted dark:text-[#D5C8B8]">
            {copy.uncertainDescription}
          </Text>
          <Text className="text-sm leading-5 text-ink-muted dark:text-[#D5C8B8]">
            {mutation.message}
          </Text>
        </View>
      ) : mutation.kind === "error" ? (
        <View className="gap-1 border-l-4 border-danger bg-[#FFF1F1] p-4 dark:bg-[#3A2020]">
          <Text className="font-bold text-danger dark:text-[#FFBABA]">{copy.errorTitle}</Text>
          <Text accessibilityRole="alert" className="text-sm text-ink-muted dark:text-[#C9D4CE]">
            {mutation.message}
          </Text>
        </View>
      ) : null}
      <View className="gap-3 sm:flex-row sm:justify-end">
        <Button
          disabled={action === "waiting"}
          label={copy.cancel}
          onPress={onCancel}
          variant="ghost"
        />
        {action === "retry" ? (
          <Button label={copy.retrySameCommand} onPress={onRetrySameCommand} variant="accent" />
        ) : action === "confirm" || action === "waiting" ? (
          <Button
            label={action === "waiting" ? copy.confirming : copy.confirm}
            loading={action === "waiting"}
            onPress={onConfirm}
            variant="accent"
          />
        ) : null}
      </View>
    </View>
  );
}
