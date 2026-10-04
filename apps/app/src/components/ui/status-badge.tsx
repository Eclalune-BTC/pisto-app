import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";

export type StatusTone = "normal" | "exception" | "attention" | "settled";

const toneVariants = {
  normal: "outline",
  exception: "secondary",
  attention: "warning",
  settled: "positive",
} as const satisfies Record<StatusTone, NonNullable<BadgeProps["variant"]>>;

/**
 * One rule for record states across modules: the expected state (posted, active, open) stays
 * quiet, a record out of the normal flow (voided, archived) carries the stronger neutral chip, a
 * state that needs action (overdue) is amber, and a completed one (paid) is settled. Red stays
 * reserved for errors and destructive actions.
 */
export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <Badge variant={toneVariants[tone]}>
      <Text>{label}</Text>
    </Badge>
  );
}
