import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

/** A description list value that states an absence, such as "Sin nota". */
export function MutedValue({ children }: { children: ReactNode }) {
  return <Text className="text-sm leading-5 text-muted-foreground">{children}</Text>;
}

/** A reviewed edit: the current value and the one about to replace it, read as one sentence. */
export function ChangedValue({
  after,
  before,
  numeric = false,
}: {
  after: string;
  before: string;
  numeric?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View className="min-w-0">
      <Text aria-hidden className={cn("text-sm leading-5", numeric && "tabular-nums")}>
        <Text className="text-sm leading-5 text-muted-foreground">{before}</Text>
        {"  →  "}
        <Text className="font-ui text-sm leading-5">{after}</Text>
      </Text>
      <Text className="sr-only">{t("common.change", { after, before })}</Text>
    </View>
  );
}
