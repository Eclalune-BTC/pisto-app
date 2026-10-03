import { View } from "react-native";
import { Text } from "./text";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

export type FilterOption<T extends string> = { label: string; value: T };
type FilterBarProps<T extends string> = {
  disabled?: boolean;
  label: string;
  onChange: (value: T) => void;
  options: readonly FilterOption<T>[];
  showLabel?: boolean;
  value: T;
};

export function FilterBar<T extends string>({
  disabled = false,
  label,
  onChange,
  options,
  showLabel = false,
  value,
}: FilterBarProps<T>) {
  return (
    <View className="min-w-0 max-w-full gap-2">
      {showLabel ? <Text className="font-ui text-sm">{label}</Text> : null}
      <ToggleGroup
        type="single"
        value={value}
        disabled={disabled}
        accessibilityLabel={label}
        variant="outline"
        className="max-w-full flex-wrap gap-2 shadow-none"
        onValueChange={(next) => {
          if (next === "") return;
          const option = options.find((entry) => entry.value === next);
          if (!option) throw new Error("The selected filter is not in the current option set.");
          onChange(option.value);
        }}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            disabled={disabled}
            accessibilityLabel={`${label}: ${option.label}`}
            className="h-auto min-h-11 max-w-full rounded-md border-l px-3 py-2 shadow-none sm:h-auto sm:px-3 sm:py-2 web:flex-none web:whitespace-normal"
          >
            <Text>{option.label}</Text>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </View>
  );
}
