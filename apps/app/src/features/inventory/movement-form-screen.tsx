import { type RefObject, useId } from "react";
import { useTranslation } from "react-i18next";
import { type TextInput, View } from "react-native";
import { CommandReview } from "@/components/command-review";
import type { DescriptionItem } from "@/components/layout/description-list";
import { FormActions } from "@/components/layout/form-actions";
import { FormSection } from "@/components/layout/form-section";
import { PageHeader } from "@/components/layout/page-header";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { MomentFields } from "@/components/ui/moment-fields";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import type { MutationPhase } from "@/lib/mutation-phase";
import {
  type InventoryDraftAction,
  type InventoryMovementDraft,
  type InventoryMovementErrors,
  inventoryDraftActions,
} from "./movement-draft";

export type MovementFieldRefs = {
  occurredLocalDate: RefObject<TextInput | HTMLInputElement | null>;
  occurredLocalTime: RefObject<TextInput | HTMLInputElement | null>;
  quantity: RefObject<TextInput | null>;
  reason: RefObject<TextInput | null>;
};

type MovementFormScreenProps = {
  draft: InventoryMovementDraft;
  errors: InventoryMovementErrors;
  fieldRefs: MovementFieldRefs;
  isRefreshing: boolean;
  isStale: boolean;
  mutationMessage?: string;
  /** The current balance with its unit, from the latest product read. */
  onHand: string;
  onCancel: () => void;
  onConfirm: () => void;
  onDraftChange: (draft: InventoryMovementDraft) => void;
  onEditReview: () => void;
  onRetryRead: () => void;
  onReview: () => void;
  phase: MutationPhase;
  productName: string;
  quantityPrecision: number;
  /** The prepared command's summary; the screen shows its review while it is present. */
  reviewItems: DescriptionItem[] | null;
};

export function MovementFormScreen({
  draft,
  errors,
  fieldRefs,
  isRefreshing,
  isStale,
  mutationMessage,
  onCancel,
  onConfirm,
  onDraftChange,
  onEditReview,
  onHand,
  onRetryRead,
  onReview,
  phase,
  productName,
  quantityPrecision,
  reviewItems,
}: MovementFormScreenProps) {
  const { t } = useTranslation();
  const description = t("inventory.movementEditor.description", { onHand, product: productName });
  const staleNotice = isStale ? <StaleNotice loading={isRefreshing} onRetry={onRetryRead} /> : null;

  if (reviewItems) {
    return (
      <Page width="form">
        <PageHeader
          description={t("inventory.movementEditor.reviewDescription")}
          title={t("inventory.movementEditor.reviewTitle")}
        />
        {staleNotice}
        <CommandReview
          confirmLabel={t("inventory.movementEditor.confirm")}
          disabled={isStale}
          errorMessage={mutationMessage}
          failedTitle={t("inventory.movementEditor.failedTitle")}
          items={reviewItems}
          onConfirm={onConfirm}
          onEdit={onEditReview}
          phase={phase}
          title={t("inventory.movementEditor.reviewTitle")}
          uncertainDescription={t("inventory.movementEditor.uncertainDescription")}
        />
      </Page>
    );
  }

  return (
    <Page width="form">
      <PageHeader description={description} title={t("inventory.movementEditor.title")} />
      {staleNotice}
      <FormSection title={t("inventory.movementEditor.movementSection")}>
        <ActionField
          onChange={(action) => onDraftChange({ ...draft, action })}
          value={draft.action}
        />
        <Field
          className="tabular-nums"
          description={
            quantityPrecision === 0
              ? t("inventory.movementEditor.wholeNumbersHint")
              : t("inventory.movementEditor.precisionHint", { count: quantityPrecision })
          }
          error={errors.quantity}
          inputMode="decimal"
          keyboardType="decimal-pad"
          label={t("inventory.movementEditor.quantity")}
          onChangeText={(quantity) => onDraftChange({ ...draft, quantity })}
          ref={fieldRefs.quantity}
          value={draft.quantity}
        />
        <Field
          error={errors.reason}
          label={t("inventory.movementEditor.reason")}
          maxLength={240}
          onChangeText={(reason) => onDraftChange({ ...draft, reason })}
          placeholder={t("inventory.movementEditor.reasonPlaceholder")}
          ref={fieldRefs.reason}
          value={draft.reason}
        />
      </FormSection>
      <FormSection
        description={t("inventory.movementEditor.momentDescription")}
        title={t("inventory.movementEditor.momentSection")}
      >
        <MomentFields
          date={draft.occurredLocalDate}
          dateError={errors.occurredLocalDate}
          dateLabel={t("inventory.movementEditor.date")}
          dateRef={fieldRefs.occurredLocalDate}
          onDateChange={(occurredLocalDate) => onDraftChange({ ...draft, occurredLocalDate })}
          onTimeChange={(occurredLocalTime) => onDraftChange({ ...draft, occurredLocalTime })}
          time={draft.occurredLocalTime}
          timeError={errors.occurredLocalTime}
          timeLabel={t("inventory.movementEditor.time")}
          timeRef={fieldRefs.occurredLocalTime}
        />
      </FormSection>
      <FormActions
        disabled={isStale}
        onCancel={onCancel}
        onSubmit={onReview}
        submitLabel={t("inventory.movementEditor.review")}
      />
    </Page>
  );
}

/** The three movements a person records, each with what it means for the balance. */
function ActionField({
  onChange,
  value,
}: {
  onChange: (action: InventoryDraftAction) => void;
  value: InventoryDraftAction;
}) {
  const { t } = useTranslation();
  const id = useId();
  const select = (next: string) => {
    const action = inventoryDraftActions.find((candidate) => candidate === next);
    if (!action) throw new Error("The selected inventory action is unavailable.");
    onChange(action);
  };
  return (
    <View className="min-w-0 gap-1.5">
      <Text className="font-ui text-[13px] leading-5" nativeID={`${id}-label`}>
        {t("inventory.movementEditor.actionLabel")}
      </Text>
      <RadioGroup
        accessibilityLabel={t("inventory.movementEditor.actionLabel")}
        aria-labelledby={`${id}-label`}
        className="gap-0 overflow-hidden rounded-lg border border-border bg-card"
        onValueChange={select}
        value={value}
      >
        {inventoryDraftActions.map((action, index) => (
          <View
            className={cn(
              "min-w-0 flex-row items-start gap-3 px-3 py-2.5",
              index > 0 && "border-t border-border",
            )}
            key={action}
          >
            <RadioGroupItem
              accessibilityLabel={t(`inventory.movementActions.${action}`)}
              aria-describedby={`${id}-${action}-description`}
              aria-labelledby={`${id}-${action}-label`}
              className="mt-0.5"
              nativeID={`${id}-${action}`}
              value={action}
            />
            <View className="min-w-0 flex-1 gap-0.5">
              <Label nativeID={`${id}-${action}-label`} onPress={() => select(action)}>
                {t(`inventory.movementActions.${action}`)}
              </Label>
              <Text
                className="text-[13px] leading-5 text-muted-foreground"
                nativeID={`${id}-${action}-description`}
              >
                {t(`inventory.movementEditor.actionDescriptions.${action}`)}
              </Text>
            </View>
          </View>
        ))}
      </RadioGroup>
    </View>
  );
}
