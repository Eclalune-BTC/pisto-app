import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui/text";

/** A description list value that states an absence, such as "Sin nota". */
export function MutedValue({ children }: { children: ReactNode }) {
  return <Text className="text-sm leading-5 text-muted-foreground">{children}</Text>;
}

/** A reviewed edit: the current value and the one about to replace it. */
export function ChangedValue({ after, before }: { after: string; before: string }) {
  const { t } = useTranslation();
  return (
    <Text
      accessibilityLabel={t("cash.review.change", { after, before })}
      className="text-sm leading-5"
    >
      <Text className="text-sm leading-5 text-muted-foreground">{before}</Text>
      {"  →  "}
      {after}
    </Text>
  );
}
