import type { PropsWithChildren, ReactNode } from "react";
import { View } from "react-native";

/**
 * A record page in two columns once the content area has room for both: what happened to the
 * record (figures, tables) in the main column, and its facts in a narrow one beside it. Narrower
 * screens stack them, main column first.
 */
export function DetailColumns({ aside, children }: PropsWithChildren<{ aside: ReactNode }>) {
  return (
    <View className="min-w-0 gap-6 min-[1360px]:flex-row min-[1360px]:items-start min-[1360px]:gap-8">
      <View className="min-w-0 gap-6 min-[1360px]:flex-1">{children}</View>
      <View className="min-w-0 gap-6 min-[1360px]:w-[320px] min-[1360px]:shrink-0">{aside}</View>
    </View>
  );
}
