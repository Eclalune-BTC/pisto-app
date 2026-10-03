import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

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
      <Text accessibilityRole="header" className="text-2xl font-heading text-foreground">
        {copy.reviewTitle}
      </Text>
      <View className="border-y border-border">
        {fields.map((field) => (
          <View
            className="gap-1 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-8 "
            key={field.label}
          >
            <Text className="text-sm font-ui text-muted-foreground">{field.label}</Text>
            <Text className="max-w-[540px] text-base font-ui text-foreground sm:text-right dark:text-white">
              {field.value}
            </Text>
          </View>
        ))}
      </View>
      {mutation.kind === "uncertain" ? (
        <View className="gap-2 border-l-4 border-warning bg-warning-surface p-4 ">
          <Text className="font-ui text-foreground">{copy.uncertainTitle}</Text>
          <Text className="text-sm leading-5 text-muted-foreground text-warning-foreground">
            {copy.uncertainDescription}
          </Text>
          <Text className="text-sm leading-5 text-muted-foreground text-warning-foreground">
            {mutation.message}
          </Text>
        </View>
      ) : mutation.kind === "error" ? (
        <View className="gap-1 border-l-4 border-danger bg-destructive-surface p-4 ">
          <Text className="font-ui text-destructive ">{copy.errorTitle}</Text>
          <Text accessibilityRole="alert" className="text-sm text-muted-foreground ">
            {mutation.message}
          </Text>
        </View>
      ) : null}
      <View className="gap-3 sm:flex-row sm:justify-end">
        {mutation.kind !== "uncertain" ? (
          <Button
            disabled={action === "waiting"}
            label={copy.cancel}
            onPress={onCancel}
            variant="ghost"
          />
        ) : null}
        {action === "retry" ? (
          <Button
            label={copy.retrySameConfirmation}
            onPress={onRetrySameCommand}
            variant="default"
          />
        ) : action === "confirm" || action === "waiting" ? (
          <Button
            label={action === "waiting" ? copy.confirming : copy.confirm}
            loading={action === "waiting"}
            onPress={onConfirm}
            variant="default"
          />
        ) : null}
      </View>
    </View>
  );
}
