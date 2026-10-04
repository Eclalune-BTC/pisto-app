import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { type TextInput, View } from "react-native";
import { DateField } from "@/components/ui/date-field";
import { Field } from "@/components/ui/field";
import { Text } from "@/components/ui/text";
import type { SaleDraftErrors, SaleDraftIssues, SaleDraftValues } from "./sale-draft";

/** Inputs that can take focus; the shared date field does not expose one. */
export type SaleDraftFieldRefs = Record<
  Exclude<keyof SaleDraftValues, "date">,
  RefObject<TextInput | null>
>;

/** The first field a person has to fix, in the order the form shows them. */
export function firstInvalidField(issues: SaleDraftIssues): keyof SaleDraftValues | undefined {
  return (["amount", "date", "time", "description"] as const).find((field) => issues[field]);
}

type SaleDraftFieldsProps = {
  currency: string;
  currencyMinorUnitDigits: number;
  errors: SaleDraftErrors;
  fieldRefs: SaleDraftFieldRefs;
  onChange: (field: keyof SaleDraftValues, value: string) => void;
  values: SaleDraftValues;
};

/** Total with its currency, the business-local moment, and an optional note. */
export function SaleDraftFields({
  currency,
  currencyMinorUnitDigits,
  errors,
  fieldRefs,
  onChange,
  values,
}: SaleDraftFieldsProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-5">
      <Field
        className="tabular-nums"
        error={errors.amount}
        inputMode="decimal"
        keyboardType="decimal-pad"
        label={t("sales.fields.total")}
        onChangeText={(value) => onChange("amount", value)}
        placeholder={(0).toFixed(currencyMinorUnitDigits)}
        ref={fieldRefs.amount}
        trailing={<Text className="font-ui text-sm text-muted-foreground">{currency}</Text>}
        value={values.amount}
      />
      <View className="gap-2">
        <View className="flex-row flex-wrap gap-3">
          <View className="min-w-0 grow basis-[180px]">
            <DateField
              error={errors.date}
              label={t("sales.fields.date")}
              onChange={(value) => onChange("date", value)}
              value={values.date}
            />
          </View>
          <View className="min-w-0 grow basis-[120px] sm:max-w-[160px]">
            <Field
              autoCorrect={false}
              className="tabular-nums"
              error={errors.time}
              keyboardType="numbers-and-punctuation"
              label={t("sales.fields.time")}
              maxLength={5}
              onChangeText={(value) => onChange("time", value)}
              placeholder={t("sales.fields.timePlaceholder")}
              ref={fieldRefs.time}
              value={values.time}
            />
          </View>
        </View>
        <Text className="text-[13px] leading-5 text-muted-foreground">
          {t("sales.fields.timeHint")}
        </Text>
      </View>
      <Field
        error={errors.description}
        label={t("sales.fields.description")}
        maxLength={240}
        onChangeText={(value) => onChange("description", value)}
        placeholder={t("sales.fields.descriptionPlaceholder")}
        ref={fieldRefs.description}
        value={values.description}
      />
    </View>
  );
}
