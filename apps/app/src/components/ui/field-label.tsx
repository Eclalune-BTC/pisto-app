import type { ReactNode } from "react";
import { View } from "react-native";

import { TranscriptMarker } from "./transcript-highlight";

/**
 * A field label followed, during an assistant review, by the number of the transcript fragment
 * that filled the field. The number repeats what the transcript shows, so readers skip it.
 */
export function FieldLabel({ children, marker }: { children: ReactNode; marker?: number | null }) {
  if (!marker) return children;
  return (
    <View className="flex-row items-center gap-1.5">
      {children}
      <View aria-hidden>
        <TranscriptMarker marker={marker} />
      </View>
    </View>
  );
}
