import type { Receivable } from "@pisto/contracts";
import { useTranslation } from "react-i18next";

import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";

const stateTones = {
  open: "normal",
  overdue: "attention",
  paid: "settled",
  voided: "exception",
} as const satisfies Record<Receivable["state"], StatusTone>;

export function ReceivableStateBadge({ state }: { state: Receivable["state"] }) {
  const { t } = useTranslation();
  return <StatusBadge label={t(`receivables.states.${state}`)} tone={stateTones[state]} />;
}
