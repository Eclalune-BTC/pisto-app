import type { PropsWithChildren, ReactNode } from "react";
import { View } from "react-native";

/**
 * The closing actions of a form or review: an optional leading action that abandons the task,
 * then the secondary actions and the primary action last.
 */
export function ActionBar({ children, leading }: PropsWithChildren<{ leading?: ReactNode }>) {
  return (
    <View className="flex-row flex-wrap items-center gap-2 border-t border-border pt-4">
      {leading}
      <View className="ml-auto flex-row flex-wrap items-center justify-end gap-2">{children}</View>
    </View>
  );
}
