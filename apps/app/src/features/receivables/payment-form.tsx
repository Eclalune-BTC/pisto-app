import type { Href } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Field } from "@/components/ui/field";
import { Text } from "@/components/ui/text";
import { FormActions } from "@/features/customers/form-actions";
import { PickerField } from "@/features/customers/picker-field";

import type { PaymentDraft } from "./draft";

export type PaymentFormErrors = Partial<Record<keyof PaymentDraft | "cashAccount", string>>;

type PaymentFormProps = {
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
};

export function PaymentForm({
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
            className="self-start px-1"
            label={t("receivables.payment.payInFull", { amount: outstanding })}
            onPress={onPayInFull}
            size="sm"
            variant="ghost"
          />
        </View>
        <PickerField
          error={errors.cashAccount}
          label={t("receivables.payment.account")}
          onPress={onChooseAccount}
          placeholder={t("receivables.payment.chooseAccount")}
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
            <Field
              error={errors.time}
              keyboardType="numbers-and-punctuation"
              label={t("receivables.payment.time")}
              maxLength={5}
              onChangeText={(value) => onChange("time", value)}
              placeholder={t("receivables.payment.timePlaceholder")}
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
        onSubmit={onReview}
        submitLabel={t("receivables.payment.review")}
      />
    </View>
  );
}
