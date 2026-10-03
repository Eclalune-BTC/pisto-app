import { View } from "react-native";
import { Text } from "@/components/ui/text";

type DetailItem = {
  label: string;
  value: string;
};

export function DetailList({ items }: { items: DetailItem[] }) {
  return (
    <View className="border-y border-border">
      {items.map((item) => (
        <View
          className="gap-1 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8"
          key={item.label}
        >
          <Text className="font-sans text-sm text-muted-foreground">{item.label}</Text>
          <Text className="font-ui text-base text-foreground sm:max-w-[62%] sm:text-right">
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
