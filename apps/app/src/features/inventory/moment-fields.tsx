import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { type TextInput, View } from "react-native";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";

type MomentFieldsProps = {
  date: string;
  dateError?: string;
  dateRef?: Ref<TextInput | HTMLInputElement>;
  disabled?: boolean;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  time: string;
  timeError?: string;
  timeRef?: Ref<TextInput | HTMLInputElement>;
};

/** The business-local date and minute of a movement; the server resolves it in the business zone. */
export function MomentFields({
  date,
  dateError,
  dateRef,
  disabled = false,
  onDateChange,
  onTimeChange,
  time,
  timeError,
  timeRef,
}: MomentFieldsProps) {
  const { t } = useTranslation();
  return (
    <View className="min-w-0 flex-row flex-wrap gap-3">
      <View className="min-w-0 grow basis-[180px]">
        <DateField
          disabled={disabled}
          error={dateError}
          label={t("inventory.movementEditor.date")}
          onChange={onDateChange}
          ref={dateRef}
          value={date}
        />
      </View>
      <View className="min-w-0 grow basis-[120px] sm:max-w-[180px]">
        <TimeField
          disabled={disabled}
          error={timeError}
          label={t("inventory.movementEditor.time")}
          onChange={onTimeChange}
          ref={timeRef}
          value={time}
        />
      </View>
    </View>
  );
}
