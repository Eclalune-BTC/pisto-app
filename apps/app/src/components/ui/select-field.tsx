import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { Label } from "./label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "./select";
import { Text } from "./text";

export type SelectFieldProps<T extends string> = {
  disabled?: boolean;
  label: string;
  onChange: (value: T) => void;
  options: readonly { label: string; value: T }[];
  placeholder?: string;
  value: T | null;
};

export function SelectField<T extends string>({
  disabled,
  label,
  onChange,
  options,
  placeholder,
  value,
}: SelectFieldProps<T>) {
  const { t } = useTranslation();
  const id = useId();
  const [triggerWidth, setTriggerWidth] = useState(0);
  const { width, height } = useWindowDimensions();
  const selected = options.find((option) => option.value === value);
  const missingSelection = value !== null && !selected;
  const primitiveValue = selected ?? { value: value ?? "", label: "" };
  return (
    <View className="min-w-0 gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={primitiveValue}
        onValueChange={(option) => {
          if (!option) return;
          const match = options.find((candidate) => candidate.value === option.value);
          if (!match) throw new Error("The selected option is not in the current option set.");
          onChange(match.value);
        }}
      >
        <SelectTrigger
          nativeID={id}
          accessibilityLabel={label}
          aria-describedby={missingSelection ? `${id}-error` : undefined}
          aria-invalid={missingSelection}
          disabled={disabled}
          className="w-full"
          onLayout={(event) => setTriggerWidth(event.nativeEvent.layout.width)}
        >
          <Text className="min-w-0 flex-1 text-sm native:text-base">
            {selected
              ? selected.label
              : missingSelection
                ? t("filters.selectionUnavailable")
                : (placeholder ?? t("filters.selectOption"))}
          </Text>
        </SelectTrigger>
        <SelectContent
          style={{ width: Math.min(Math.max(triggerWidth, 200), width - 32) }}
          sideOffset={6}
          insets={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: Math.max(120, Math.min(288, height - 160)) }}
          >
            {options.map((option) => (
              <SelectItem
                className="min-h-8 native:min-h-11"
                key={option.value}
                value={option.value}
                label={option.label}
              />
            ))}
          </ScrollView>
        </SelectContent>
      </Select>
      {missingSelection ? (
        <Text
          accessibilityRole="alert"
          nativeID={`${id}-error`}
          className="text-sm text-destructive"
        >
          {t("filters.selectionUnavailable")}
        </Text>
      ) : null}
    </View>
  );
}
