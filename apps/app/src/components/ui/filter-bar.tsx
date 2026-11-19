import { Platform, View } from "react-native";
import { cn } from "@/lib/cn";
import { Text } from "./text";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

type FilterOption<T extends string> = { label: string; value: T };
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
        // One row at every width: on the web a group wider than its column scrolls sideways
        // instead of wrapping into a second row of segments.
        className="max-w-full gap-0.5 self-start rounded-lg bg-secondary p-0.5 native:flex-wrap web:overflow-x-auto web:[scrollbar-width:none]"
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
                "max-w-full rounded-md",
                // Pointer rows match the 36px fields beside them; touch keeps a 40pt target.
                Platform.select({
                  web: "h-8 min-w-0 flex-none whitespace-nowrap px-3 sm:h-8 sm:min-w-0 sm:px-3",
                  default: "h-10 min-w-0 px-3 sm:h-10 sm:min-w-0 sm:px-3",
                }),
                selected
                  ? "bg-card shadow-sm shadow-black/10 dark:bg-foreground/15"
                  : "bg-transparent web:hover:bg-background/60",
              )}
            >
              <Text
                className={cn(
                  "text-dense native:text-sm",
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
