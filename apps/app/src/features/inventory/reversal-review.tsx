import { Text, View } from "react-native";
import { DetailList } from "@/components/detail-list";
import { Button } from "@/components/ui/button";
import type { InventoryMovement } from "../../../../../packages/contracts/src/catalog";
import { formatQuantityMinorUnits } from "./quantity";

export interface ReversalReviewCopy {
  title: string;
  description: string;
  movement: string;
  quantity: string;
  reason: string;
  date: string;
  time: string;
  confirm: string;
  cancel: string;
  failedTitle: string;
  failedDescription: string;
  uncertainTitle: string;
  uncertainDescription: string;
  resolveUncertain: string;
}

export function ReversalReview({
  copy,
  movement,
  mutationState,
  onCancel,
  onConfirm,
  onResolveUncertain,
  reason,
  occurredLocalDate,
  occurredLocalTime,
}: {
  copy: ReversalReviewCopy;
  movement: InventoryMovement;
  mutationState: "idle" | "pending" | "error" | "uncertain";
  onCancel: () => void;
  onConfirm: () => void;
  onResolveUncertain: () => void;
  reason: string;
  occurredLocalDate: string;
  occurredLocalTime: string;
}) {
  return (
    <View className="gap-6 border-y border-line py-6 dark:border-[#304239]">
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-2xl font-black text-ink dark:text-white">
          {copy.title}
        </Text>
        <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
          {copy.description}
        </Text>
      </View>
      <DetailList
        items={[
          { label: copy.movement, value: movement.id },
          {
            label: copy.quantity,
            value: formatQuantityMinorUnits(
              movement.quantityMinorUnits,
              movement.quantityPrecision,
            ),
          },
          { label: copy.reason, value: reason },
          { label: copy.date, value: occurredLocalDate },
          { label: copy.time, value: occurredLocalTime },
        ]}
      />
      {mutationState === "error" || mutationState === "uncertain" ? (
        <View className="gap-1 border-l-4 border-danger bg-[#FFF1F1] p-4 dark:bg-[#3A2020]">
          <Text accessibilityRole="alert" className="font-bold text-danger dark:text-[#FFBABA]">
            {mutationState === "uncertain" ? copy.uncertainTitle : copy.failedTitle}
          </Text>
          <Text className="text-sm text-ink-muted dark:text-[#C9D4CE]">
            {mutationState === "uncertain" ? copy.uncertainDescription : copy.failedDescription}
          </Text>
        </View>
      ) : null}
      <View className="gap-3 sm:flex-row">
        {mutationState === "uncertain" ? (
          <Button label={copy.resolveUncertain} onPress={onResolveUncertain} variant="secondary" />
        ) : (
          <>
            <Button
              label={copy.confirm}
              loading={mutationState === "pending"}
              onPress={onConfirm}
              variant="danger"
            />
            <Button label={copy.cancel} onPress={onCancel} variant="secondary" />
          </>
        )}
      </View>
    </View>
  );
}
