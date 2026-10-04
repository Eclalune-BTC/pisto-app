import type { Receivable } from "@pisto/contracts";
import { useTranslation } from "react-i18next";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";

const stateVariants = {
  open: "warning",
  overdue: "destructive",
  paid: "positive",
  voided: "outline",
} as const satisfies Record<Receivable["state"], NonNullable<BadgeProps["variant"]>>;

export function ReceivableStateBadge({ state }: { state: Receivable["state"] }) {
  const { t } = useTranslation();
  return (
    <Badge variant={stateVariants[state]}>
      <Text>{t(`receivables.states.${state}`)}</Text>
    </Badge>
  );
}
