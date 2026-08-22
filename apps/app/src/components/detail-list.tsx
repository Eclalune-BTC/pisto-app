import { Text, View } from "react-native";

type DetailItem = {
  label: string;
  value: string;
};

export function DetailList({ items }: { items: DetailItem[] }) {
  return (
    <View className="border-y border-line dark:border-[#304239]">
      {items.map((item) => (
        <View
          className="gap-1 border-b border-line py-4 last:border-b-0 dark:border-[#304239] sm:flex-row sm:items-baseline sm:justify-between sm:gap-8"
          key={item.label}
        >
          <Text className="text-sm font-semibold text-ink-muted dark:text-[#AAB8B0]">
            {item.label}
          </Text>
          <Text className="text-base font-bold text-ink dark:text-white sm:max-w-[62%] sm:text-right">
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
