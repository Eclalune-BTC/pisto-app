import type { AssistantSpan } from "@pisto/contracts";
import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { transcriptSegments } from "@/lib/transcript-segments";

/**
 * What the user said, with each fragment the assistant used highlighted and numbered like the
 * review field it filled. `inverse` sits on the primary (dark green) surface.
 */
export function TranscriptHighlight({
  className,
  spans,
  text,
  tone = "default",
}: {
  className?: string;
  spans: readonly AssistantSpan[];
  text: string;
  tone?: "default" | "inverse";
}) {
  const plain = tone === "inverse" ? "text-primary-foreground" : "text-foreground";
  return (
    <Text className={cn("font-sans text-lg leading-8", plain, className)}>
      {transcriptSegments(text, spans).map((segment, index) =>
        segment.marker === null ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional and never reorder
          <Text key={index} className={cn("font-sans text-lg leading-8", plain)}>
            {segment.text}
          </Text>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional and never reorder
          <Text key={index} className="font-sans text-lg leading-8">
            <Text className="rounded-xs bg-highlight px-0.5 font-ui text-lg leading-8 text-highlight-foreground">
              {segment.text}
            </Text>{" "}
            <TranscriptMarker marker={segment.marker} tone={tone} />
          </Text>
        ),
      )}
    </Text>
  );
}

export function TranscriptMarker({
  marker,
  tone = "default",
}: {
  marker: number;
  tone?: "default" | "inverse";
}) {
  return (
    <View
      className={cn(
        "size-4 items-center justify-center rounded-xs",
        tone === "inverse" ? "bg-highlight" : "bg-primary",
      )}
    >
      <Text
        className={cn(
          "font-ui text-[10px] leading-3",
          tone === "inverse" ? "text-highlight-foreground" : "text-primary-foreground",
        )}
      >
        {marker}
      </Text>
    </View>
  );
}
