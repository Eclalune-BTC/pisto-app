import { Pressable, Text, View } from "react-native";

export type ChoiceOption<T extends string> = { label: string; value: T };

type ChoiceListProps<T extends string> = {
  label: string;
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function ChoiceList<T extends string>({
  label,
  options,
  value,
  onChange,
}: ChoiceListProps<T>) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-ink dark:text-[#E7EEE9]">{label}</Text>
      <View accessibilityRole="radiogroup" className="border-y border-line dark:border-[#304239]">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              className="min-h-12 flex-row items-center justify-between border-b border-line py-3 last:border-b-0 dark:border-[#304239]"
              key={option.value}
              onPress={() => onChange(option.value)}
            >
              <Text className="font-semibold text-ink dark:text-white">{option.label}</Text>
              <View
                className={`h-5 w-5 items-center justify-center rounded-full border ${
                  selected ? "border-positive" : "border-line dark:border-[#526159]"
                }`}
              >
                {selected ? <View className="h-2.5 w-2.5 rounded-full bg-positive" /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
