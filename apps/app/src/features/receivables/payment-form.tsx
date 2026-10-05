import type { Href } from "expo-router";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { FormActions } from "@/components/layout/form-actions";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Field } from "@/components/ui/field";
import { Text } from "@/components/ui/text";
import { TimeField } from "@/components/ui/time-field";
import { PickerField } from "@/features/customers/picker-field";

import type { PaymentDraft } from "./draft";

export type PaymentFormErrors = Partial<Record<keyof PaymentDraft | "cashAccount", string>>;

type PaymentFormProps = {
  /** The account control, where focus returns after the account picker closes. */
  accountFieldRef: RefObject<View | null>;
  accountName: string | null;
  amountPlaceholder: string;
  cancelHref: Href;
  currency: string;
  draft: PaymentDraft;
  errors: PaymentFormErrors;
  /** The confirmed outstanding balance, already formatted, offered as the full payment. */
  outstanding: string;
  onChange: (field: keyof PaymentDraft, value: string) => void;
  onChooseAccount: () => void;
  onPayInFull: () => void;
  onReview: () => void;
  /** Reviewing waits while the reads behind the form are stale. */
  reviewDisabled?: boolean;
};

export function PaymentForm({
  accountFieldRef,
  accountName,
  amountPlaceholder,
  cancelHref,
  currency,
  draft,
  errors,
  onChange,
  onChooseAccount,
  onPayInFull,
  onReview,
  outstanding,
  reviewDisabled = false,
}: PaymentFormProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-8">
      <Section
        description={t("receivables.payment.paymentDescription", { amount: outstanding })}
        title={t("receivables.payment.paymentSection")}
      >
        <View className="gap-1.5">
          <Field
            error={errors.amount}
            keyboardType="decimal-pad"
            label={t("receivables.payment.amount")}
            onChangeText={(value) => onChange("amount", value)}
            placeholder={amountPlaceholder}
            trailing={<Text className="text-xs text-muted-foreground">{currency}</Text>}
            value={draft.amount}
          />
          <Button
            className="self-start"
            label={t("receivables.payment.payInFull", { amount: outstanding })}
            onPress={onPayInFull}
            size="sm"
            variant="outline"
          />
        </View>
        <PickerField
          error={errors.cashAccount}
          label={t("receivables.payment.account")}
          onPress={onChooseAccount}
          placeholder={t("receivables.payment.chooseAccount")}
          ref={accountFieldRef}
          value={accountName ?? undefined}
        />
      </Section>
      <Section
        description={t("receivables.payment.whenDescription")}
        title={t("receivables.payment.whenSection")}
      >
        <View className="gap-4 sm:flex-row">
          <View className="min-w-0 flex-1">
            <DateField
              error={errors.date}
              label={t("receivables.payment.date")}
              onChange={(value) => onChange("date", value)}
              value={draft.date}
            />
          </View>
          <View className="min-w-0 flex-1">
            <TimeField
              error={errors.time}
              label={t("receivables.payment.time")}
              onChange={(value) => onChange("time", value)}
              value={draft.time}
            />
          </View>
        </View>
        <Field
          error={errors.reference}
          label={t("receivables.payment.reference")}
          maxLength={120}
          onChangeText={(value) => onChange("reference", value)}
          placeholder={t("receivables.payment.referencePlaceholder")}
          value={draft.reference}
        />
      </Section>
      <FormActions
        cancelHref={cancelHref}
        disabled={reviewDisabled}
        onSubmit={onReview}
        submitLabel={t("receivables.payment.review")}
      />
    </View>
  );
}
