import type { RecordInventoryMovementRequest } from "@pisto/contracts";
import { AlertTriangle, ArrowLeft, Check } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { DetailList } from "@/components/detail-list";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export type InventoryDraftAction = Exclude<RecordInventoryMovementRequest["action"], "reverse">;

export interface InventoryMovementDraft {
  action: InventoryDraftAction;
  occurredLocalDate: string;
  occurredLocalTime: string;
  quantity: string;
  reason: string;
}

export type InventoryMovementErrors = Partial<
  Record<"occurredLocalDate" | "occurredLocalTime" | "quantity" | "reason", string>
>;

export interface MovementEditorCopy {
  back: string;
  title: string;
  description: string;
  reviewTitle: string;
  reviewDescription: string;
  actions: Record<InventoryDraftAction, string>;
  actionLabel: string;
  quantity: string;
  quantityPlaceholder: string;
  reason: string;
  reasonPlaceholder: string;
  date: string;
  datePlaceholder: string;
  time: string;
  timePlaceholder: string;
  precisionHint: (precision: number) => string;
  review: string;
  edit: string;
  confirm: string;
  failedTitle: string;
  failedDescription: string;
  uncertainTitle: string;
  uncertainDescription: string;
  retrySameConfirmation: string;
}

interface MovementEditorProps {
  copy: MovementEditorCopy;
  draft: InventoryMovementDraft;
  errors: InventoryMovementErrors;
  mutationMessage?: string;
  mutationState: "idle" | "pending" | "error" | "uncertain";
  onBack: () => void;
  onConfirm: () => void;
  onDraftChange: (draft: InventoryMovementDraft) => void;
  onEditReview: () => void;
  onResolveUncertain: () => void;
  onReview: () => void;
  productName: string;
  quantityPrecision: number;
  reviewItems: { label: string; value: string }[] | null;
}

export function MovementEditor({
  copy,
  draft,
  errors,
  mutationMessage,
  mutationState,
  onBack,
  onConfirm,
  onDraftChange,
  onEditReview,
  onResolveUncertain,
  onReview,
  productName,
  quantityPrecision,
  reviewItems,
}: MovementEditorProps) {
  const review = reviewItems !== null;
  return (
    <Page width="form">
      <Button className="self-start px-0" onPress={onBack} size="sm" variant="ghost">
        <ArrowLeft color="#617168" size={18} />
        <ButtonText className="text-ink-muted dark:text-[#AAB8B0]" variant="ghost">
          {copy.back}
        </ButtonText>
      </Button>
      <ScreenHeader
        description={review ? copy.reviewDescription : copy.description}
        eyebrow={productName}
        title={review ? copy.reviewTitle : copy.title}
      />

      {review ? (
        <View className="gap-7">
          <DetailList items={reviewItems} />
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
                label={copy.retrySameConfirmation}
                onPress={onResolveUncertain}
                variant="secondary"
              />
            ) : (
              <>
                <Button loading={mutationState === "pending"} onPress={onConfirm} variant="accent">
                  <Check color="#14241D" size={18} strokeWidth={2.8} />
                  <ButtonText variant="accent">{copy.confirm}</ButtonText>
                </Button>
                <Button label={copy.edit} onPress={onEditReview} variant="secondary" />
              </>
            )}
          </View>
        </View>
      ) : (
        <View className="gap-7 border-y border-line py-7 dark:border-[#304239]">
          <View className="gap-2">
            <Text className="text-sm font-semibold text-ink dark:text-[#E7EEE9]">
              {copy.actionLabel}
            </Text>
            <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-x-6 gap-y-1">
              {(Object.keys(copy.actions) as InventoryDraftAction[]).map((action) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: draft.action === action }}
                  className={
                    draft.action === action
                      ? "min-h-11 justify-center border-b-2 border-positive py-2"
                      : "min-h-11 justify-center py-2"
                  }
                  key={action}
                  onPress={() => onDraftChange({ ...draft, action })}
                >
                  <Text className="font-semibold text-ink dark:text-white">
                    {copy.actions[action]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Field
            error={errors.quantity}
            keyboardType="decimal-pad"
            label={copy.quantity}
            onChangeText={(quantity) => onDraftChange({ ...draft, quantity })}
            placeholder={copy.quantityPlaceholder}
            value={draft.quantity}
          />
          <Text className="-mt-5 text-xs leading-5 text-ink-muted dark:text-[#91A198]">
            {copy.precisionHint(quantityPrecision)}
          </Text>
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
