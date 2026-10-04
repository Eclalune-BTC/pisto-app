import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { DateField } from "@/components/ui/date-field";
import { Field } from "@/components/ui/field";

type LocalDateTimeFieldsProps = {
  date: string;
  dateError?: string;
  disabled?: boolean;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  time: string;
  timeError?: string;
};

/** The business-local minute of an operation; the server resolves it in the business time zone. */
export function LocalDateTimeFields({
  date,
  dateError,
  disabled = false,
  onDateChange,
  onTimeChange,
  time,
  timeError,
}: LocalDateTimeFieldsProps) {
  const { t } = useTranslation();
  return (
    <View className="min-w-0 gap-4 sm:flex-row">
      <View className="min-w-0 sm:flex-1">
        <DateField
          disabled={disabled}
          error={dateError}
          label={t("cash.fields.date")}
          onChange={onDateChange}
          value={date}
        />
      </View>
      <View className="min-w-0 sm:flex-1">
        <Field
          autoCapitalize="none"
          autoCorrect={false}
          editable={!disabled}
          error={timeError}
          keyboardType="numbers-and-punctuation"
          label={t("cash.fields.time")}
          maxLength={5}
          onChangeText={onTimeChange}
          placeholder={t("cash.fields.timePlaceholder")}
          value={time}
        />
      </View>
    </View>
  );
}
