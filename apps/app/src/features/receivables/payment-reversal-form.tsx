import type { Href } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { FormActions } from "@/components/layout/form-actions";
import { Section } from "@/components/layout/section";
import { Field } from "@/components/ui/field";
import { MomentFields } from "@/components/ui/moment-fields";

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
        <MomentFields
          date={draft.date}
          dateError={errors.date}
          dateLabel={t("receivables.reversal.date")}
          onDateChange={(value) => onChange("date", value)}
          onTimeChange={(value) => onChange("time", value)}
          time={draft.time}
          timeError={errors.time}
          timeLabel={t("receivables.reversal.time")}
        />
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
