import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import type { RealtimeStatus as Status } from "@/lib/realtime";

/** Whether changes from other devices are arriving live; the dot alone stays when collapsed. */
export function RealtimeStatus({ collapsed, status }: { collapsed: boolean; status: Status }) {
  const { t } = useTranslation();
  const label = t(`shell.realtime.${status}`);
  return (
    <View
      accessibilityLabel={label}
      className={cn("h-7 flex-row items-center gap-2 px-2", collapsed && "justify-center")}
      role="status"
    >
      <View
        className={cn(
          "size-1.5 rounded-full",
          status === "live" ? "bg-primary" : "bg-muted-foreground/60",
        )}
      />
      {collapsed ? null : <Text className="text-xs text-muted-foreground">{label}</Text>}
    </View>
  );
}
