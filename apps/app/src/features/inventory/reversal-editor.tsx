import type {
  InventoryMovement,
  InventoryMovementAction,
  ReverseInventoryMovementRequest,
} from "@pisto/contracts";
import { AlertTriangle, ArrowLeft, Check } from "lucide-react-native";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";
import { DetailList } from "@/components/detail-list";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

import { formatQuantityMinorUnits } from "./quantity";
import type { ReversalDraft, ReversalDraftErrors } from "./reversal-draft";

export interface ReversalEditorCopy {
  back: string;
  title: string;
  description: string;
  reason: string;
  reasonPlaceholder: string;
  date: string;
  datePlaceholder: string;
  time: string;
  timePlaceholder: string;
  timeZone: string;
  review: string;
  reviewTitle: string;
  reviewDescription: string;
  movement: string;
  movementAction: string;
  originalDelta: string;
  reversalDelta: string;
  quantity: string;
  confirm: string;
  cancel: string;
  failedTitle: string;
  failedDescription: string;
  uncertainTitle: string;
  uncertainDescription: string;
  retrySameConfirmation: string;
  actions: Record<InventoryMovementAction, string>;
}

function signedQuantity(value: string, precision: number): string {
  const negative = value.startsWith("-");
  const magnitude = formatQuantityMinorUnits(value.replace("-", ""), precision);
  return `${negative ? "−" : "+"}${magnitude}`;
}

export function ReversalEditor({
  command,
  copy,
  draft,
  errors,
  movement,
  mutationMessage,
  mutationState,
  onBack,
  onCancelReview,
  onConfirm,
  onDraftChange,
  onResolveUncertain,
  onReview,
  productName,
  timeZone,
}: {
  command: ReverseInventoryMovementRequest | null;
  copy: ReversalEditorCopy;
  draft: ReversalDraft;
  errors: ReversalDraftErrors;
  movement: InventoryMovement;
  mutationMessage?: string;
  mutationState: "error" | "idle" | "pending" | "uncertain";
  onBack: () => void;
  onCancelReview: () => void;
  onConfirm: () => void;
  onDraftChange: (draft: ReversalDraft) => void;
  onResolveUncertain: () => void;
  onReview: () => void;
  productName: string;
  timeZone: string;
}) {
  const mutedColor = useCSSVariable("--color-muted-foreground") as string;
  const destructiveColor = useCSSVariable("--color-destructive") as string;
  const reversalDelta = movement.deltaMinorUnits.startsWith("-")
    ? movement.deltaMinorUnits.slice(1)
    : `-${movement.deltaMinorUnits}`;

  return (
    <Page width="form">
      <Button
        className="self-start px-0"
        disabled={mutationState === "pending" || mutationState === "uncertain"}
        onPress={mutationState === "pending" || mutationState === "uncertain" ? undefined : onBack}
        size="sm"
        variant="ghost"
      >
        <ArrowLeft color={mutedColor} size={18} />
        <Text className="text-muted-foreground">{copy.back}</Text>
      </Button>
      <ScreenHeader
        description={command ? copy.reviewDescription : copy.description}
        eyebrow={productName}
        title={command ? copy.reviewTitle : copy.title}
      />

      {command ? (
        <View className="gap-7">
          <DetailList
            items={[
              { label: copy.movement, value: movement.id },
              { label: copy.movementAction, value: copy.actions[movement.action] },
              {
                label: copy.originalDelta,
                value: signedQuantity(movement.deltaMinorUnits, movement.quantityPrecision),
              },
              {
                label: copy.reversalDelta,
                value: signedQuantity(reversalDelta, movement.quantityPrecision),
              },
              {
                label: copy.quantity,
                value: formatQuantityMinorUnits(
                  movement.quantityMinorUnits,
                  movement.quantityPrecision,
                ),
              },
              { label: copy.reason, value: command.reason },
              { label: copy.date, value: command.occurredLocalDate },
              { label: copy.time, value: command.occurredLocalTime },
              { label: copy.timeZone, value: timeZone },
            ]}
          />
          {mutationState === "error" || mutationState === "uncertain" ? (
            <View className="flex-row items-start gap-3 border-l-4 border-destructive bg-destructive-surface p-4 ">
              <AlertTriangle color={destructiveColor} size={20} />
              <View className="min-w-0 flex-1 gap-1">
                <Text accessibilityRole="alert" className="font-ui text-destructive ">
                  {mutationState === "uncertain" ? copy.uncertainTitle : copy.failedTitle}
                </Text>
                <Text className="text-sm leading-5 text-muted-foreground ">
                  {mutationState === "uncertain"
                    ? copy.uncertainDescription
                    : (mutationMessage ?? copy.failedDescription)}
                </Text>
              </View>
            </View>
          ) : null}
          <View className="gap-3 sm:flex-row">
            {mutationState === "uncertain" ? (
              <Button
                label={copy.retrySameConfirmation}
                onPress={onResolveUncertain}
                variant="outline"
              />
            ) : (
              <>
                <Button
                  loading={mutationState === "pending"}
                  onPress={mutationState === "pending" ? undefined : onConfirm}
                  variant="destructive"
                >
                  <Icon as={Check} size={18} />
                  <Text>{copy.confirm}</Text>
                </Button>
                <Button
                  disabled={mutationState === "pending"}
                  label={copy.cancel}
                  onPress={mutationState === "pending" ? undefined : onCancelReview}
                  variant="outline"
                />
              </>
            )}
          </View>
        </View>
      ) : (
        <View className="gap-7 border-y border-border py-7 ">
          <Field
            error={errors.reason}
            label={copy.reason}
            maxLength={240}
            onChangeText={(reason) => onDraftChange({ ...draft, reason })}
            placeholder={copy.reasonPlaceholder}
            value={draft.reason}
          />
          <View className="gap-5 sm:flex-row">
            <View className="flex-1">
              <Field
                error={errors.occurredLocalDate}
                keyboardType="numbers-and-punctuation"
                label={copy.date}
                onChangeText={(occurredLocalDate) => onDraftChange({ ...draft, occurredLocalDate })}
                placeholder={copy.datePlaceholder}
                value={draft.occurredLocalDate}
              />
            </View>
            <View className="flex-1">
              <Field
                error={errors.occurredLocalTime}
                keyboardType="numbers-and-punctuation"
                label={copy.time}
                onChangeText={(occurredLocalTime) => onDraftChange({ ...draft, occurredLocalTime })}
                placeholder={copy.timePlaceholder}
                value={draft.occurredLocalTime}
              />
            </View>
          </View>
          <Button className="self-start" label={copy.review} onPress={onReview} variant="default" />
        </View>
      )}
    </Page>
  );
}
