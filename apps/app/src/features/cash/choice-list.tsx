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

/** A required exclusive choice whose options are short enough to show all at once. */
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
    <View className="min-w-0 gap-2">
      <Text className="font-ui text-sm text-foreground">{label}</Text>
      <RadioGroup
        accessibilityLabel={label}
        className="gap-0"
        disabled={disabled}
        onValueChange={select}
        value={value}
      >
        {options.map((option) => (
          <View
            className="min-h-9 flex-row items-center gap-2.5 native:min-h-11"
            key={option.value}
          >
            <RadioGroupItem
              accessibilityLabel={option.label}
              aria-labelledby={`${id}-${option.value}-label`}
              disabled={disabled}
              hitSlop={12}
              nativeID={`${id}-${option.value}`}
              value={option.value}
            />
            <View className="min-w-0 flex-1">
              <Label
                className="py-2 font-sans leading-5 native:py-3"
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
