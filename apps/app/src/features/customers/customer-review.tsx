import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

import { buildCustomersCopy } from "./copy";
import { customerPrimaryAction, type MutationState } from "./types";

export type CustomerReviewField = { label: string; value: string };

type CustomerReviewProps = {
  confirmLabel: string;
  fields: CustomerReviewField[];
  mutation: MutationState;
  onConfirm: () => void;
  onEdit: () => void;
  onRetrySameRequest: () => void;
  title: string;
};

export function CustomerReview({
  confirmLabel,
  fields,
  mutation,
  onConfirm,
  onEdit,
  onRetrySameRequest,
  title,
}: CustomerReviewProps) {
  const { t } = useTranslation();
  const copy = useMemo(() => buildCustomersCopy(t), [t]);
  const action = customerPrimaryAction(mutation);
  return (
    <View className="gap-6">
      <Text accessibilityRole="header" className="text-2xl font-heading text-foreground">
        {title}
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
          <Text className="font-ui text-foreground">{copy.customers.form.uncertainTitle}</Text>
          <Text
            accessibilityRole="alert"
            className="text-sm text-muted-foreground text-warning-foreground"
          >
            {mutation.message}
          </Text>
        </View>
      ) : mutation.kind === "error" ? (
        <Text accessibilityRole="alert" className="text-sm text-destructive ">
          {mutation.message}
        </Text>
      ) : null}
      <View className="gap-3 sm:flex-row sm:justify-end">
        {mutation.kind !== "uncertain" ? (
          <Button
            disabled={action === "waiting"}
            label={copy.receivables.review.cancel}
            onPress={onEdit}
            variant="ghost"
          />
        ) : null}
        {action === "retry" ? (
          <Button
            label={copy.customers.form.retrySameConfirmation}
            onPress={onRetrySameRequest}
            variant="default"
          />
        ) : action === "submit" || action === "waiting" ? (
          <Button
            label={confirmLabel}
            loading={action === "waiting"}
            onPress={onConfirm}
            variant="default"
          />
        ) : null}
      </View>
    </View>
  );
}
