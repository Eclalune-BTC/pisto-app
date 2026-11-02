import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";

export type StatusTone = "normal" | "exception" | "attention" | "settled";

const toneVariants = {
  exception: "secondary",
  attention: "warning",
  settled: "positive",
} as const satisfies Record<Exclude<StatusTone, "normal">, NonNullable<BadgeProps["variant"]>>;

/**
 * One rule for record states across modules: the expected state (posted, active, open) is plain
 * muted text, because a chip on every row is noise; a record out of the normal flow (voided,
 * archived) carries the neutral chip, a state that needs action (overdue) is amber, and a
 * completed one (paid) is settled. Red stays reserved for errors and destructive actions.
 */
export function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  if (tone === "normal") {
    return <Text className="font-ui text-xs leading-4 text-muted-foreground">{label}</Text>;
  }
  return (
    <Badge variant={toneVariants[tone]}>
      <Text>{label}</Text>
    </Badge>
  );
}
