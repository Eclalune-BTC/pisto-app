import type { Href } from "expo-router";
import { Info } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Section } from "@/components/layout/section";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";

import type { CustomerDraftValues } from "./draft";
import { FormActions } from "./form-actions";

export type CustomerFormErrors = Partial<Record<keyof CustomerDraftValues, string>>;

type CustomerFormProps = {
  cancelHref: Href;
  errors: CustomerFormErrors;
  formError?: string;
  onChange: (field: keyof CustomerDraftValues, value: string) => void;
  onSubmit: () => void;
  /** Reviewing waits while the reads behind the form are stale. */
  reviewDisabled?: boolean;
  values: CustomerDraftValues;
};

export function CustomerForm({
  cancelHref,
  errors,
  formError,
  onChange,
  onSubmit,
  reviewDisabled = false,
  values,
}: CustomerFormProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-8">
      <Section title={t("customers.form.identity")}>
        <Field
          autoCapitalize="words"
          error={errors.name}
          label={t("customers.fields.name")}
          maxLength={120}
          onChangeText={(value) => onChange("name", value)}
          placeholder={t("customers.form.namePlaceholder")}
          value={values.name}
        />
      </Section>
      <Section
        description={t("customers.form.contactDescription")}
        title={t("customers.form.contact")}
      >
        <View className="gap-4 sm:flex-row">
          <View className="min-w-0 flex-1">
            <Field
              error={errors.phone}
              keyboardType="phone-pad"
              label={t("customers.fields.phone")}
              maxLength={40}
              onChangeText={(value) => onChange("phone", value)}
              placeholder={t("customers.form.phonePlaceholder")}
              value={values.phone}
            />
          </View>
          <View className="min-w-0 flex-1">
            <Field
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.email}
              keyboardType="email-address"
              label={t("customers.fields.email")}
              maxLength={254}
              onChangeText={(value) => onChange("email", value)}
              placeholder={t("customers.form.emailPlaceholder")}
              value={values.email}
            />
          </View>
        </View>
        <Field
          error={errors.notes}
          label={t("customers.fields.notes")}
          maxLength={1000}
          multiline
          onChangeText={(value) => onChange("notes", value)}
          placeholder={t("customers.form.notesPlaceholder")}
          value={values.notes}
        />
      </Section>
      {formError ? (
        <Alert icon={Info}>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}
      <FormActions
        cancelHref={cancelHref}
        disabled={reviewDisabled}
        onSubmit={onSubmit}
        submitLabel={t("customers.form.review")}
      />
    </View>
  );
}
