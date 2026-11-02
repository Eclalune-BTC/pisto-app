import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/text";
import type { RealtimeStatus } from "@/lib/realtime";
import { nextInterrupted } from "./realtime-interruption";

export function useRealtimeInterrupted(status: RealtimeStatus): boolean {
  const [previous, setPrevious] = useState(status);
  const [interrupted, setInterrupted] = useState(false);
  if (status !== previous) {
    setPrevious(status);
    setInterrupted(nextInterrupted(previous, status, interrupted));
  }
  return interrupted;
}

/** Nothing while updates arrive; one quiet line after a real disconnect while it reconnects. */
export function RealtimeNotice({ compact, status }: { compact: boolean; status: RealtimeStatus }) {
  const { t } = useTranslation();
  const interrupted = useRealtimeInterrupted(status);
  if (!interrupted) return null;
  return (
    <Text className="min-w-0 shrink text-xs text-muted-foreground" numberOfLines={1} role="status">
      {compact ? t("shell.realtimeInterruptedShort") : t("shell.realtimeInterrupted")}
    </Text>
  );
}
