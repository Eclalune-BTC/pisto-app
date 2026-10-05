import type { Href } from "expo-router";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { FormActions } from "@/components/layout/form-actions";
import { Section } from "@/components/layout/section";
import { DateField } from "@/components/ui/date-field";
import { Field } from "@/components/ui/field";
import { Text } from "@/components/ui/text";
import { PickerField } from "@/features/customers/picker-field";

import type { PostReceivableDraft } from "./draft";

export type ReceivableFormErrors = Partial<Record<keyof PostReceivableDraft | "customer", string>>;

type ReceivableFormProps = {
  amountPlaceholder: string;
  cancelHref: Href;
  currency: string;
  customer: { detail?: string; name: string } | null;
  /** The customer control, where focus returns after the customer picker closes. */
  customerFieldRef: RefObject<View | null>;
  /** The customer a charge was started from is still being read. */
  customerLoading: boolean;
  draft: PostReceivableDraft;
  errors: ReceivableFormErrors;
  onChange: (field: keyof PostReceivableDraft, value: string) => void;
  onChooseCustomer: () => void;
  onReview: () => void;
  /** Reviewing waits while the reads behind the form are stale. */
  reviewDisabled?: boolean;
};

export function ReceivableForm({
  amountPlaceholder,
  cancelHref,
  currency,
  customer,
  customerFieldRef,
  customerLoading,
  draft,
  errors,
  onChange,
  onChooseCustomer,
  onReview,
  reviewDisabled = false,
}: ReceivableFormProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-8">
      <Section title={t("receivables.form.chargeSection")}>
        <PickerField
          detail={customer?.detail}
          error={errors.customer}
          label={t("receivables.form.customer")}
          onPress={onChooseCustomer}
          placeholder={
            customerLoading
              ? t("receivables.list.customerLoading")
              : t("receivables.form.chooseCustomer")
          }
          ref={customerFieldRef}
          value={customer?.name}
        />
        <Field
          error={errors.amount}
          keyboardType="decimal-pad"
          label={t("receivables.form.amount")}
          onChangeText={(value) => onChange("amount", value)}
          placeholder={amountPlaceholder}
          trailing={<Text className="text-xs text-muted-foreground">{currency}</Text>}
          value={draft.amount}
        />
        <Field
          error={errors.description}
          label={t("receivables.form.descriptionLabel")}
          maxLength={240}
          onChangeText={(value) => onChange("description", value)}
          placeholder={t("receivables.form.descriptionPlaceholder")}
          value={draft.description}
        />
      </Section>
      <Section
        description={t("receivables.form.datesDescription")}
        title={t("receivables.form.datesSection")}
      >
        <View className="gap-4 sm:flex-row">
          <View className="min-w-0 flex-1">
            <DateField
              error={errors.postedDate}
              label={t("receivables.form.postedDate")}
              onChange={(value) => onChange("postedDate", value)}
              value={draft.postedDate}
            />
          </View>
          <View className="min-w-0 flex-1">
            <DateField
              error={errors.dueDate}
              label={t("receivables.form.dueDateOptional")}
              onChange={(value) => onChange("dueDate", value)}
              value={draft.dueDate}
            />
          </View>
        </View>
      </Section>
      <FormActions
        cancelHref={cancelHref}
        disabled={reviewDisabled}
        onSubmit={onReview}
        submitLabel={t("receivables.form.review")}
      />
    </View>
  );
}
