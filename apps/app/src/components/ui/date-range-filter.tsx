import { View } from "react-native";
import { Button } from "./button";
import { DateField } from "./date-field";

type DateRangeFilterProps = {
  applying?: boolean;
  applyLabel: string;
  disabled?: boolean;
  endDate: string;
  endLabel: string;
  endError?: string;
  error?: string;
  onApply: () => void;
  onEndDateChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  startDate: string;
  startLabel: string;
};

export function DateRangeFilter({
  applying,
  applyLabel,
  disabled,
  endDate,
  endLabel,
  endError,
  error,
  onApply,
  onEndDateChange,
  onStartDateChange,
  startDate,
  startLabel,
}: DateRangeFilterProps) {
  return (
    <View className="min-w-0 gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <View className="min-w-0 sm:min-w-48 sm:flex-1">
        <DateField
          disabled={disabled}
          error={error}
          label={startLabel}
          onChange={onStartDateChange}
          onSubmit={onApply}
          value={startDate}
        />
      </View>
      <View className="min-w-0 sm:min-w-48 sm:flex-1">
        <DateField
          disabled={disabled}
          error={endError}
          label={endLabel}
          onChange={onEndDateChange}
          onSubmit={onApply}
          value={endDate}
        />
      </View>
      <Button
        disabled={disabled}
        label={applyLabel}
        loading={applying}
        onPress={onApply}
        variant="outline"
      />
    </View>
  );
}
