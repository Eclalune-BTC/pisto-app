import type { PropsWithChildren, ReactNode } from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

/**
 * A strip of exact figures that share one border, instead of floating KPI cards. It always spans
 * its column, so a single figure lines up with the table or list under it.
 */
export function StatGroup({ children }: PropsWithChildren) {
  return (
    <View className="flex-row flex-wrap gap-px overflow-hidden rounded-xl border border-border bg-border">
      {children}
    </View>
  );
}

export function Stat({
  detail,
  label,
  tone = "default",
  value,
}: {
  /** Context such as the period or what the figure excludes; never an invented trend. */
  detail?: ReactNode;
  label: string;
  tone?: "default" | "destructive" | "warning";
  value: string;
}) {
  return (
    // The same 16 px inset as a table cell, so stacked blocks start their text on one line.
    <View
      className="min-w-0 max-w-full grow shrink gap-1 bg-card px-4 py-3.5"
      style={{ flexBasis: Math.max(152, Math.min(400, value.length * 16 + 32)) }}
    >
      <Text className="text-xs leading-4 text-muted-foreground">{label}</Text>
      <Text
        className={cn(
          "font-heading text-heading tabular-nums web:break-all",
          tone === "destructive" && "text-destructive",
          tone === "warning" && "text-warning-foreground",
        )}
        selectable
      >
        {value}
      </Text>
      {typeof detail === "string" ? (
        <Text className="text-xs leading-4 text-muted-foreground">{detail}</Text>
      ) : (
        detail
      )}
    </View>
  );
}
