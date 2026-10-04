import type { PropsWithChildren } from "react";
import { View } from "react-native";

/** The closing actions of a form or review: secondary actions first, the primary action last. */
export function ActionBar({ children }: PropsWithChildren) {
  return <View className="flex-row flex-wrap items-center justify-end gap-2 pt-2">{children}</View>;
}
