import { useId } from "react";
import { View } from "react-native";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Text } from "@/components/ui/text";

export type ChoiceOption<T extends string> = { label: string; value: T };

type ChoiceListProps<T extends string> = {
  label: string;
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
};

export function ChoiceList<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: ChoiceListProps<T>) {
  const id = useId();
  if (!options.some((option) => option.value === value)) {
    throw new Error("The selected cash choice is unavailable.");
  }
  const select = (nextValue: string) => {
    if (disabled) return;
    const option = options.find((candidate) => candidate.value === nextValue);
    if (!option) throw new Error("The selected cash choice is unavailable.");
    onChange(option.value);
  };
  return (
    <View className="gap-2">
      <Text className="text-sm font-ui text-foreground">{label}</Text>
      <RadioGroup
        accessibilityLabel={label}
        className="border-y border-border"
        disabled={disabled}
        onValueChange={select}
        value={value}
      >
        {options.map((option) => (
          <View
            className="min-h-12 flex-row items-center gap-3 border-b border-border last:border-b-0"
            key={option.value}
          >
            <RadioGroupItem
              accessibilityLabel={option.label}
              aria-labelledby={`${id}-${option.value}-label`}
              disabled={disabled}
              hitSlop={14}
              nativeID={`${id}-${option.value}`}
              value={option.value}
            />
            <View className="min-w-0 flex-1">
              <Label
                className="min-h-11 flex-1 py-3 leading-5"
                disabled={disabled}
                nativeID={`${id}-${option.value}-label`}
                onPress={() => select(option.value)}
              >
                {option.label}
              </Label>
            </View>
          </View>
        ))}
      </RadioGroup>
    </View>
  );
}
