import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { cn } from "@/lib/cn";
import { Label } from "./label";
import { Select, SelectContent, SelectItem, SelectTrigger } from "./select";
import { Text } from "./text";

export type SelectFieldProps<T extends string> = {
  disabled?: boolean;
  /** Validation message owned by the field: outlines the trigger and is announced with it. */
  error?: string;
  label: string;
  /** Toolbar filters show their value only; the label still names the control for readers. */
  labelHidden?: boolean;
  onChange: (value: T) => void;
  options: readonly { label: string; value: T }[];
  placeholder?: string;
  value: T | null;
};

export function SelectField<T extends string>({
  disabled,
  error,
  label,
  labelHidden = false,
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
  const message = missingSelection ? t("filters.selectionUnavailable") : error;
  const shownValue = selected
    ? selected.label
    : missingSelection
      ? t("filters.selectionUnavailable")
      : (placeholder ?? t("filters.selectOption"));
  return (
    <View className="min-w-0 gap-1.5">
      <Label className={cn("text-[13px]", labelHidden && "sr-only")} htmlFor={id}>
        {label}
      </Label>
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
          accessibilityLabel={`${label}: ${shownValue}`}
          aria-describedby={message ? `${id}-error` : undefined}
          aria-invalid={Boolean(message)}
          disabled={disabled}
          className={cn("w-full", message && "border-destructive")}
          onLayout={(event) => setTriggerWidth(event.nativeEvent.layout.width)}
        >
          <Text
            className={cn(
              "min-w-0 flex-1 text-sm native:text-base",
              !selected && "text-muted-foreground",
            )}
            numberOfLines={1}
          >
            {shownValue}
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
      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          nativeID={`${id}-error`}
          className="text-[13px] leading-5 text-destructive"
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}
