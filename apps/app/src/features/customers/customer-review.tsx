import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";

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
      <Text accessibilityRole="header" className="text-2xl font-black text-ink dark:text-white">
        {title}
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
          <Text className="font-bold text-ink dark:text-white">
            {copy.customers.form.uncertainTitle}
          </Text>
          <Text accessibilityRole="alert" className="text-sm text-ink-muted dark:text-[#D5C8B8]">
            {mutation.message}
          </Text>
        </View>
      ) : mutation.kind === "error" ? (
        <Text accessibilityRole="alert" className="text-sm text-danger dark:text-[#FFBABA]">
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
            variant="accent"
          />
        ) : action === "submit" || action === "waiting" ? (
          <Button
            label={confirmLabel}
            loading={action === "waiting"}
            onPress={onConfirm}
            variant="accent"
          />
        ) : null}
      </View>
    </View>
  );
}
