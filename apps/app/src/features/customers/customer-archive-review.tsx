import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";

import { type CustomerFormCopy, customerPrimaryAction, type MutationState } from "./types";

type CustomerArchiveReviewProps = {
  copy: CustomerFormCopy;
  customerName: string;
  mutation: MutationState;
  onCancel: () => void;
  onConfirm: () => void;
  onRetrySameRequest: () => void;
};

export function CustomerArchiveReview({
  copy,
  customerName,
  mutation,
  onCancel,
  onConfirm,
  onRetrySameRequest,
}: CustomerArchiveReviewProps) {
  const action = customerPrimaryAction(mutation);
  return (
    <View className="gap-5">
      <Text accessibilityRole="header" className="text-2xl font-black text-ink dark:text-white">
        {copy.confirmArchive}
      </Text>
      <Text className="border-y border-line py-5 text-base font-bold text-ink dark:border-[#304239] dark:text-white">
        {customerName}
      </Text>
      {mutation.kind === "uncertain" || mutation.kind === "error" ? (
        <View
          className={`gap-2 border-l-4 p-4 ${
            mutation.kind === "uncertain"
              ? "border-warning bg-[#FFF6E8] dark:bg-[#3A2A18]"
              : "border-danger bg-[#FFF1F1] dark:bg-[#3A2020]"
          }`}
        >
          <Text accessibilityRole="alert" className="text-sm text-ink dark:text-white">
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
          <Button label={copy.retrySameRequest} onPress={onRetrySameRequest} variant="danger" />
        ) : action === "submit" || action === "waiting" ? (
          <Button
            label={copy.confirmArchive}
            loading={action === "waiting"}
            onPress={onConfirm}
            variant="danger"
          />
        ) : null}
      </View>
    </View>
  );
}
