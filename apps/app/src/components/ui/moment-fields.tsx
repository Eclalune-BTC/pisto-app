import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { type TextInput, View } from "react-native";
import { DateField } from "@/components/ui/date-field";
import { TimeField } from "@/components/ui/time-field";

type MomentFieldsProps = {
  date: string;
  dateError?: string;
  /** Defaults to "Fecha"; name it when the form holds more than one date. */
  dateLabel?: string;
  dateRef?: Ref<TextInput | HTMLInputElement>;
  disabled?: boolean;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  time: string;
  timeError?: string;
  timeLabel?: string;
  timeRef?: Ref<TextInput | HTMLInputElement>;
};

/** The business-local date and minute of an operation; the server resolves it in the business zone. */
export function MomentFields({
  date,
  dateError,
  dateLabel,
  dateRef,
  disabled = false,
  onDateChange,
  onTimeChange,
  time,
  timeError,
  timeLabel,
  timeRef,
}: MomentFieldsProps) {
  const { t } = useTranslation();
  return (
    <View className="min-w-0 flex-row flex-wrap gap-3">
      <View className="min-w-0 grow basis-[180px]">
        <DateField
          disabled={disabled}
          error={dateError}
          label={dateLabel ?? t("common.date")}
          onChange={onDateChange}
          ref={dateRef}
          value={date}
        />
      </View>
      <View className="min-w-0 grow basis-[120px] sm:max-w-[180px]">
        <TimeField
          disabled={disabled}
          error={timeError}
          label={timeLabel ?? t("common.time")}
          onChange={onTimeChange}
          ref={timeRef}
          value={time}
        />
      </View>
    </View>
  );
}
