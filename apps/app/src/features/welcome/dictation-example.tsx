import type { AssistantSpan } from "@pisto/contracts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import { TranscriptHighlight, TranscriptMarker } from "@/components/ui/transcript-highlight";
import { MoneyFigure } from "@/features/operate/money-figure";
import { EXAMPLE_CURRENCY, EXAMPLE_DIGITS, EXAMPLE_SALE } from "./example-business";
import { useExample } from "./fragments";

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

function SaleDraft({ showSource }: { showSource: boolean }) {
  const { t } = useTranslation();
  const { money, locale } = useExample();
  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Text className="font-ui text-sm">
          {t("welcome.example.product")} ·{" "}
          {t("welcome.example.line", {
            count: EXAMPLE_SALE.quantity,
            price: money(EXAMPLE_SALE.unitPrice),
          })}
        </Text>
        <Text className="text-xs text-muted-foreground">{t("welcome.example.unsaved")}</Text>
      </View>
      <View className="flex-row border-t border-border pt-3">
        <View className="pisto-receipt-total min-w-0 flex-1 gap-1 pr-2">
          <Text className="text-xs text-muted-foreground sm:text-sm">
            {t("welcome.example.total")}
          </Text>
          <MoneyFigure
            className="text-figure-lg sm:text-figure-xl"
            currency={EXAMPLE_CURRENCY}
            fractionClassName="text-title-lg sm:text-figure-lg"
            fractionDigits={EXAMPLE_DIGITS}
            locale={locale}
            minorUnits={EXAMPLE_SALE.total}
          />
        </View>
        <View className="pisto-receipt-cash min-w-0 flex-1 gap-1 border-l border-border px-3 sm:px-5">
          <Text className="text-xs text-muted-foreground sm:text-sm">
            {t("welcome.example.cash")}
          </Text>
          <Text className="font-heading text-figure-lg tabular-nums sm:text-figure-xl">
            {money(EXAMPLE_SALE.received)}
          </Text>
          {showSource ? (
            <Text className="text-xs text-muted-foreground">
              «{t("welcome.example.fragments.received")}»
            </Text>
          ) : null}
        </View>
        <View className="pisto-receipt-credit min-w-0 flex-1 gap-1 border-l border-border pl-3 sm:pl-5">
          <Text className="text-xs text-muted-foreground sm:text-sm">
            {t("operate.home.money.owed")}
          </Text>
          <Text className="font-heading text-figure-lg tabular-nums sm:text-figure-xl">
            {money(EXAMPLE_SALE.outstanding)}
          </Text>
          {showSource ? (
            <Text className="text-xs text-muted-foreground">
              «{t("welcome.example.fragments.credit")}»
            </Text>
          ) : null}
        </View>
      </View>
      <View
        aria-hidden
        className="pisto-payment-split h-1.5 w-full flex-row overflow-hidden rounded-xs bg-muted"
      >
        <View className="bg-chart-1" style={{ flex: Number(EXAMPLE_SALE.received) }} />
        <View className="bg-highlight-strong" style={{ flex: Number(EXAMPLE_SALE.outstanding) }} />
      </View>
    </View>
  );
}

function SaleSentence() {
  const { t } = useTranslation();
  const sentence = t("welcome.example.said");
  const fragments = FIELDS.map(({ key }) => t(`welcome.example.fragments.${key}`));
  return (
    <View className="pisto-receipt-total gap-2">
      <Text className="font-ui text-sm">{t("assistant.review.transcriptTitle")}</Text>
      <TranscriptHighlight spans={exampleSpans(sentence, fragments)} text={sentence} />
      <View className="flex-row flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4">
        {FIELDS.map(({ key }, index) => (
          <View key={key} className="flex-row items-center gap-1.5">
            <TranscriptMarker marker={index + 1} />
            <Text className="text-xs text-muted-foreground">
              {t(`welcome.example.fields.${key}`)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function DictationExample({ showSource = false }: { showSource?: boolean } = {}) {
  const { t } = useTranslation();
  const [view, setView] = useState("draft");
  return (
    <Tabs
      value={view}
      onValueChange={setView}
      className="min-w-0 gap-5 lg:flex-row lg:items-start lg:gap-16"
    >
      <View className="gap-2 lg:w-[38%]">
        <Text
          accessibilityRole="header"
          aria-level={2}
          className="font-heading text-title-lg web:scroll-mt-5 sm:text-heading"
          nativeID="example-sale"
          tabIndex={-1}
        >
          {t("welcome.example.label")}
        </Text>
        <Text className="text-sm text-muted-foreground">
          {t("welcome.sample.business")} · {t("welcome.sample.people.carlos")}
        </Text>
        <TabsList accessibilityLabel={t("welcome.example.label")} className="mt-1 self-start">
          {(["sentence", "draft"] as const).map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              <Text>{t(`welcome.example.views.${tab}`)}</Text>
            </TabsTrigger>
          ))}
        </TabsList>
      </View>
      <View className="min-w-0 lg:flex-1">
        <TabsContent tabIndex={0} value="draft">
          <SaleDraft showSource={showSource} />
        </TabsContent>
        <TabsContent tabIndex={0} value="sentence">
          <SaleSentence />
        </TabsContent>
      </View>
    </Tabs>
  );
}
