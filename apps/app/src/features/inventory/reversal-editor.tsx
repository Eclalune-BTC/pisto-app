import type {
  InventoryMovement,
  InventoryMovementAction,
  ReverseInventoryMovementRequest,
} from "@pisto/contracts";
import { AlertTriangle, ArrowLeft, Check } from "lucide-react-native";
import { Text, View } from "react-native";
import { DetailList } from "@/components/detail-list";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

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
  resolveUncertain: string;
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
  const reversalDelta = movement.deltaMinorUnits.startsWith("-")
    ? movement.deltaMinorUnits.slice(1)
    : `-${movement.deltaMinorUnits}`;

  return (
    <Page width="form">
      <Button className="self-start px-0" onPress={onBack} size="sm" variant="ghost">
        <ArrowLeft color="#617168" size={18} />
        <ButtonText className="text-ink-muted dark:text-[#AAB8B0]" variant="ghost">
          {copy.back}
        </ButtonText>
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
            <View className="flex-row items-start gap-3 border-l-4 border-danger bg-[#FFF1F1] p-4 dark:bg-[#3A2020]">
              <AlertTriangle color="#B94242" size={20} />
              <View className="min-w-0 flex-1 gap-1">
                <Text
                  accessibilityRole="alert"
                  className="font-bold text-danger dark:text-[#FFBABA]"
                >
                  {mutationState === "uncertain" ? copy.uncertainTitle : copy.failedTitle}
                </Text>
                <Text className="text-sm leading-5 text-ink-muted dark:text-[#C9D4CE]">
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
                label={copy.resolveUncertain}
                onPress={onResolveUncertain}
                variant="secondary"
              />
            ) : (
              <>
                <Button loading={mutationState === "pending"} onPress={onConfirm} variant="danger">
                  <Check color="#FFFFFF" size={18} />
                  <ButtonText variant="danger">{copy.confirm}</ButtonText>
                </Button>
                <Button label={copy.cancel} onPress={onCancelReview} variant="secondary" />
              </>
            )}
          </View>
        </View>
      ) : (
        <View className="gap-7 border-y border-line py-7 dark:border-[#304239]">
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
          <Button className="self-start" label={copy.review} onPress={onReview} variant="accent" />
        </View>
      )}
    </Page>
  );
}
