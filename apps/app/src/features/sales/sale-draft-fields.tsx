import { Text, View } from "react-native";

import { Field } from "@/components/ui/field";
import type { SaleDraftValues } from "@/features/sales/sale-draft";

type Props = {
  currency: string;
  errors: Partial<Record<keyof SaleDraftValues, string>>;
  labels: {
    amount: string;
    date: string;
    datePlaceholder: string;
    description: string;
    descriptionPlaceholder: string;
    time: string;
    timePlaceholder: string;
  };
  onChange: (field: keyof SaleDraftValues, value: string) => void;
  values: SaleDraftValues;
};

export function SaleDraftFields({ currency, errors, labels, onChange, values }: Props) {
  return (
    <View className="gap-7">
      <Field
        error={errors.amount}
        keyboardType="decimal-pad"
        label={labels.amount}
        onChangeText={(value) => onChange("amount", value)}
        placeholder="0.00"
        trailing={
          <Text className="text-sm font-bold text-ink-muted dark:text-[#AAB8B0]">{currency}</Text>
        }
        value={values.amount}
      />
      <View className="gap-5 sm:flex-row">
        <View className="flex-1">
          <Field
            error={errors.date}
            keyboardType="numbers-and-punctuation"
            label={labels.date}
            onChangeText={(value) => onChange("date", value)}
            placeholder={labels.datePlaceholder}
            value={values.date}
          />
        </View>
        <View className="flex-1">
          <Field
            error={errors.time}
            keyboardType="numbers-and-punctuation"
            label={labels.time}
            onChangeText={(value) => onChange("time", value)}
            placeholder={labels.timePlaceholder}
            value={values.time}
          />
        </View>
      </View>
      <Field
        error={errors.description}
        label={labels.description}
        maxLength={240}
        onChangeText={(value) => onChange("description", value)}
        placeholder={labels.descriptionPlaceholder}
        value={values.description}
      />
    </View>
  );
}
