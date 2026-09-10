import { Platform, Pressable, Text, View } from "react-native";

import { cn } from "@/lib/cn";

export type FilterOption<T extends string> = { label: string; value: T };

type FilterBarProps<T extends string> = {
  disabled?: boolean;
  label: string;
  onChange: (value: T) => void;
  options: readonly FilterOption<T>[];
  showLabel?: boolean;
  value: T;
};

/** A small, mutually exclusive filter set. Each button keeps its full context. */
export function FilterBar<T extends string>({
  disabled = false,
  label,
  onChange,
  options,
  showLabel = false,
  value,
}: FilterBarProps<T>) {
  return (
    <View className="gap-2">
      {showLabel ? (
        <Text className="text-sm font-semibold text-ink dark:text-[#E7EEE9]">{label}</Text>
      ) : null}
      <View className="flex-row flex-wrap border-b border-border">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              accessibilityLabel={`${label}: ${option.label}`}
              accessibilityRole={Platform.OS === "web" ? "button" : "togglebutton"}
              accessibilityState={
                Platform.OS === "web" ? { disabled } : { checked: selected, disabled }
              }
              aria-pressed={Platform.OS === "web" ? selected : undefined}
              className={cn(
                "min-h-12 max-w-full justify-center border-b-2 px-4 py-3 active:opacity-70 disabled:opacity-45",
                selected ? "border-positive" : "border-transparent",
              )}
              disabled={disabled}
              key={option.value}
              onPress={() => onChange(option.value)}
            >
              <Text
                className={cn(
                  "text-sm font-bold",
                  selected ? "text-positive dark:text-[#8DDEAF]" : "text-muted-foreground",
                )}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
