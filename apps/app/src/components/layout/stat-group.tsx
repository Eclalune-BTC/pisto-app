import { Children, type PropsWithChildren, type ReactNode } from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

/** A strip of exact figures that share one border, instead of floating KPI cards. */
export function StatGroup({ children }: PropsWithChildren) {
  return (
    <View
      className={cn(
        "flex-row flex-wrap gap-px overflow-hidden rounded-lg border border-border bg-border",
        Children.toArray(children).length === 1 && "self-start",
      )}
    >
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
    <View className="min-w-[140px] flex-1 basis-[140px] gap-1 bg-card px-4 py-3">
      <Text className="text-xs leading-4 text-muted-foreground">{label}</Text>
      <Text
        className={cn(
          "font-heading text-2xl leading-8 tracking-[-0.5px] tabular-nums",
          tone === "destructive" && "text-destructive",
          tone === "warning" && "text-warning-foreground",
        )}
        numberOfLines={1}
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
