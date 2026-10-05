import type { Href } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Section } from "@/components/layout/section";
import { DateField } from "@/components/ui/date-field";
import { Field } from "@/components/ui/field";
import { TimeField } from "@/components/ui/time-field";
import { FormActions } from "@/features/customers/form-actions";

import type { PaymentReversalDraft } from "./draft";

export type PaymentReversalFormErrors = Partial<Record<keyof PaymentReversalDraft, string>>;

type PaymentReversalFormProps = {
  cancelHref: Href;
  draft: PaymentReversalDraft;
  errors: PaymentReversalFormErrors;
  onChange: (field: keyof PaymentReversalDraft, value: string) => void;
  onReview: () => void;
  /** Reviewing waits while the reads behind the form are stale. */
  reviewDisabled?: boolean;
};

export function PaymentReversalForm({
  cancelHref,
  draft,
  errors,
  onChange,
  onReview,
  reviewDisabled = false,
}: PaymentReversalFormProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-8">
      <Section
        description={t("receivables.reversal.whenDescription")}
        title={t("receivables.reversal.whenSection")}
      >
        <View className="gap-4 sm:flex-row">
          <View className="min-w-0 flex-1">
            <DateField
              error={errors.date}
              label={t("receivables.reversal.date")}
              onChange={(value) => onChange("date", value)}
              value={draft.date}
            />
          </View>
          <View className="min-w-0 flex-1">
            <TimeField
              error={errors.time}
              label={t("receivables.reversal.time")}
              onChange={(value) => onChange("time", value)}
              value={draft.time}
            />
          </View>
        </View>
        <Field
          error={errors.reference}
          label={t("receivables.reversal.reference")}
          maxLength={120}
          onChangeText={(value) => onChange("reference", value)}
          placeholder={t("receivables.reversal.referencePlaceholder")}
          value={draft.reference}
        />
      </Section>
      <FormActions
        cancelHref={cancelHref}
        destructive
        disabled={reviewDisabled}
        onSubmit={onReview}
        submitLabel={t("receivables.reversal.review")}
      />
    </View>
  );
}
