import type { AssistantSpan } from "@pisto/contracts";
import { Mic } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { TranscriptHighlight, TranscriptMarker } from "@/components/ui/transcript-highlight";
import { cn } from "@/lib/cn";

const FIELDS = [
  { key: "kind", field: "kind" },
  { key: "customer", field: "customer" },
  { key: "product", field: "product" },
  { key: "received", field: "received" },
  { key: "credit", field: "credit" },
] as const satisfies readonly { key: string; field: AssistantSpan["field"] }[];

/** Spans of each example fragment inside the sentence; a reworded fragment must fail loudly. */
export function exampleSpans(text: string, fragments: readonly string[]): AssistantSpan[] {
  let cursor = 0;
  return fragments.map((fragment, index) => {
    const start = text.indexOf(fragment, cursor);
    const field = FIELDS[index]?.field;
    if (start < 0 || !field) throw new Error(`The example fragment "${fragment}" is not in order.`);
    cursor = start + fragment.length;
    return { start, end: cursor, field, marker: index + 1 };
  });
}

/**
 * A static illustration of the dictation flow built from the real transcript component: the
 * sentence a person says and the sale it becomes. It is labeled as an example and saves nothing.
 */
export function DictationExample({ tone }: { tone: "inverse" | "default" }) {
  const { t } = useTranslation();
  const text = t("welcome.example.said");
  const fragments = FIELDS.map(({ key }) => t(`welcome.example.fragments.${key}`));
  const inverse = tone === "inverse";
  return (
    <View accessibilityLabel={t("welcome.example.label")} className="min-w-0 gap-3" role="figure">
      <View
        className={cn(
          "gap-2 rounded-xl px-4 py-3.5",
          inverse ? "bg-primary-foreground/8" : "border border-border bg-card",
        )}
      >
        <View className="flex-row items-center gap-1.5">
          <Icon
            as={Mic}
            className={inverse ? "text-primary-foreground/70" : "text-muted-foreground"}
            size={13}
          />
          <Text
            className={cn(
              "text-xs",
              inverse ? "text-primary-foreground/70" : "text-muted-foreground",
            )}
          >
            {t("welcome.example.youSaid")}
          </Text>
        </View>
        <TranscriptHighlight
          className="text-[17px] leading-8"
          spans={exampleSpans(text, fragments)}
          text={text}
          tone={inverse ? "inverse" : "default"}
        />
      </View>
      <View
        className={cn(
          "gap-0.5 rounded-xl bg-card px-4 py-3",
          inverse ? "ml-0 sm:ml-8" : "border border-border",
        )}
      >
        <View className="flex-row items-center justify-between gap-2 pb-1.5">
          <Text className="font-ui text-[13px] text-card-foreground">
            {t("welcome.example.reviewTitle")}
          </Text>
          <Text className="text-xs text-muted-foreground">{t("welcome.example.unsaved")}</Text>
        </View>
        {FIELDS.map(({ key }, index) => (
          <View
            className={cn(
              "min-h-9 flex-row items-center gap-3 py-1.5",
              index > 0 && "border-t border-border",
            )}
            key={key}
          >
            <TranscriptMarker marker={index + 1} />
            <Text className="w-28 text-[13px] text-muted-foreground">
              {t(`welcome.example.rows.${key}.label`)}
            </Text>
            <Text className="min-w-0 flex-1 font-ui text-[13px] text-card-foreground">
              {t(`welcome.example.rows.${key}.value`)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
