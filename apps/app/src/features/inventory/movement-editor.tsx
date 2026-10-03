import type { RecordInventoryMovementRequest } from "@pisto/contracts";
import { AlertTriangle, ArrowLeft, Check } from "lucide-react-native";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";
import { DetailList } from "@/components/detail-list";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Text } from "@/components/ui/text";

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
  isStale: boolean;
  isRefreshing: boolean;
  onRetryRead: () => void;
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
  isStale,
  isRefreshing,
  onRetryRead,
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
  const mutedColor = useCSSVariable("--color-muted-foreground") as string;
  const destructiveColor = useCSSVariable("--color-destructive") as string;
  const primaryForegroundColor = useCSSVariable("--color-primary-foreground") as string;
  const review = reviewItems !== null;
  const controlsDisabled = mutationState === "pending" || mutationState === "uncertain";
  const actions = Object.keys(copy.actions) as InventoryDraftAction[];
  const selectAction = (value: string) => {
    if (controlsDisabled) return;
    const action = actions.find((candidate) => candidate === value);
    if (!action) throw new Error("The selected inventory action is unavailable.");
    onDraftChange({ ...draft, action });
  };
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
        description={review ? copy.reviewDescription : copy.description}
        eyebrow={productName}
        title={review ? copy.reviewTitle : copy.title}
      />

      {isStale ? <StaleNotice loading={isRefreshing} onRetry={onRetryRead} /> : null}

      {review ? (
        <View className="gap-7">
          <DetailList items={reviewItems} />
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
                  disabled={isStale}
                  loading={mutationState === "pending"}
                  onPress={mutationState === "pending" || isStale ? undefined : onConfirm}
                  variant="default"
                >
                  <Check color={primaryForegroundColor} size={18} strokeWidth={2.8} />
                  <Text>{copy.confirm}</Text>
                </Button>
                <Button
                  disabled={mutationState === "pending"}
                  label={copy.edit}
                  onPress={mutationState === "pending" ? undefined : onEditReview}
                  variant="outline"
                />
              </>
            )}
          </View>
        </View>
      ) : (
        <View className="gap-7 border-y border-border py-7 ">
          <View className="gap-2">
            <Text className="text-sm font-ui text-foreground ">{copy.actionLabel}</Text>
            <RadioGroup
              accessibilityLabel={copy.actionLabel}
              className="gap-2"
              disabled={controlsDisabled}
              onValueChange={selectAction}
              value={draft.action}
            >
              {actions.map((action) => (
                <View className="min-h-12 flex-row items-center gap-3" key={action}>
                  <RadioGroupItem
                    accessibilityLabel={copy.actions[action]}
                    aria-labelledby={`inventory-action-${action}-label`}
                    disabled={controlsDisabled}
                    hitSlop={14}
                    nativeID={`inventory-action-${action}`}
                    value={action}
                  />
                  <View className="min-w-0 flex-1">
                    <Label
                      className="min-h-11 flex-1 py-3 leading-5"
                      disabled={controlsDisabled}
                      nativeID={`inventory-action-${action}-label`}
                      onPress={() => selectAction(action)}
                    >
                      {copy.actions[action]}
                    </Label>
                  </View>
                </View>
              ))}
            </RadioGroup>
          </View>
          <Field
            error={errors.quantity}
            keyboardType="decimal-pad"
            label={copy.quantity}
            onChangeText={(quantity) => onDraftChange({ ...draft, quantity })}
            placeholder={copy.quantityPlaceholder}
            value={draft.quantity}
          />
          <Text className="-mt-5 text-xs leading-5 text-muted-foreground ">
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
          <Button
            className="self-start"
            disabled={isStale || mutationState === "pending" || mutationState === "uncertain"}
            label={copy.review}
            onPress={
              isStale || mutationState === "pending" || mutationState === "uncertain"
                ? undefined
                : onReview
            }
            variant="default"
          />
        </View>
      )}
    </Page>
  );
}
