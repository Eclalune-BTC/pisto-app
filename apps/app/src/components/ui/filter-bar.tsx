import { View } from "react-native";
import { cn } from "@/lib/cn";
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

/** Segmented control for a required single choice; an empty selection is never emitted. */
export function FilterBar<T extends string>({
  disabled = false,
  label,
  onChange,
  options,
  showLabel = false,
  value,
}: FilterBarProps<T>) {
  return (
    <View className="min-w-0 max-w-full gap-1.5">
      {showLabel ? <Text className="font-ui text-xs text-muted-foreground">{label}</Text> : null}
      <ToggleGroup
        type="single"
        value={value}
        disabled={disabled}
        accessibilityLabel={label}
        className="max-w-full flex-wrap gap-0.5 self-start rounded-md border border-border bg-muted p-0.5"
        onValueChange={(next) => {
          if (next === "") return;
          const option = options.find((entry) => entry.value === next);
          if (!option) throw new Error("The selected filter is not in the current option set.");
          onChange(option.value);
        }}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              disabled={disabled}
              accessibilityLabel={`${label}: ${option.label}`}
              role="radio"
              className={cn(
                "h-auto min-h-7 max-w-full rounded-sm px-2.5 py-1 native:min-h-10 native:px-3 web:flex-none web:whitespace-nowrap",
                "border",
                selected
                  ? "border-border bg-card shadow-sm shadow-black/5 dark:bg-foreground/15"
                  : "border-transparent bg-transparent web:hover:bg-background/60",
              )}
            >
              <Text
                className={cn(
                  "text-[13px] native:text-sm",
                  selected ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {option.label}
              </Text>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </View>
  );
}
