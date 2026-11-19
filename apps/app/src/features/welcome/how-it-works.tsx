import { Square } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { ChangedValue } from "@/components/layout/review-values";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import { MAX_RECORDING_SECONDS } from "@/features/assistant/recorder-types";
import { cn } from "@/lib/cn";
import { DictationExample } from "./dictation-example";
import {
  BEFORE_DICTATED_SALE,
  EXAMPLE_ACCOUNTS,
  EXAMPLE_MOVEMENTS,
  EXAMPLE_RECEIVABLES,
} from "./example-business";
import { ButtonLook, MovementLine, Surface, SurfaceHeader, useExample } from "./fragments";

export const STEPS = ["say", "review", "save"] as const;
type Step = (typeof STEPS)[number];

/** A frozen microphone level for the illustration; the app draws the live input. */
const LEVELS = [
  0.18, 0.3, 0.52, 0.4, 0.66, 0.84, 0.58, 0.36, 0.5, 0.74, 0.92, 0.7, 0.46, 0.3, 0.42, 0.62, 0.8,
  0.56, 0.34, 0.24, 0.4, 0.68, 0.88, 0.64, 0.44, 0.3, 0.52, 0.72, 0.5, 0.32, 0.22, 0.36, 0.28, 0.18,
  0.12, 0.08,
];
const ELAPSED_SECONDS = 7;

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Step one: the "Nuevo registro" dialog while it listens. */
function Dictating() {
  const { t } = useTranslation();
  return (
    <Surface className="gap-5 p-5">
      <View className="gap-1">
        <Text className="font-ui text-lg leading-6">{t("assistant.dialog.title")}</Text>
        <Text className="text-dense text-muted-foreground">
          {t("assistant.dialog.description")}
        </Text>
      </View>
      <View className="items-center gap-3 rounded-lg bg-primary px-4 py-6 dark:bg-muted">
        {/* The bars give up width before the level runs into the panel's edges on a small phone. */}
        <View
          aria-hidden
          className="h-14 w-full max-w-[213px] flex-row items-center justify-center gap-[3px]"
        >
          {LEVELS.map((level, index) => (
            <View
              className="max-w-[3px] flex-1 rounded-full bg-primary-foreground dark:bg-foreground"
              // biome-ignore lint/suspicious/noArrayIndexKey: bars are positional and never reorder
              key={index}
              style={{ height: Math.max(3, Math.round(level * 52)), opacity: 0.35 + level * 0.65 }}
            />
          ))}
        </View>
        <View className="flex-row flex-wrap items-center justify-center gap-x-2">
          <View className="size-2 rounded-full bg-highlight" />
          <Text className="shrink-0 font-ui text-dense text-primary-foreground dark:text-foreground">
            {t("assistant.dialog.listening")}
          </Text>
          <Text className="shrink-0 text-dense tabular-nums text-primary-foreground/80 dark:text-muted-foreground">
            {t("assistant.dialog.elapsed", {
              elapsed: clock(ELAPSED_SECONDS),
              limit: clock(MAX_RECORDING_SECONDS),
            })}
          </Text>
        </View>
      </View>
      <View className="gap-1">
        <Text className="text-dense text-muted-foreground">
          {t("assistant.dialog.examplesTitle")}
        </Text>
        {[t("assistant.dialog.examples.expense"), t("assistant.dialog.examples.payment")].map(
          (example) => (
            <Text className="text-dense" key={example}>
              «{example}»
            </Text>
          ),
        )}
      </View>
      <View className="flex-row flex-wrap justify-end gap-2">
        <ButtonLook label={t("common.cancel")} variant="outline" />
        <ButtonLook icon={Square} label={t("assistant.dialog.stopAndReview")} />
      </View>
    </Surface>
  );
}

/** Step three: the saved sale on top of today's movements and the balances it moved. */
function Saved() {
  const { t } = useTranslation();
  const { money } = useExample();
  const [sale, ...earlier] = EXAMPLE_MOVEMENTS;
  if (!sale) throw new Error("The example needs the dictated sale.");
  const balances = [
    {
      key: "cash",
      label: t("operate.home.money.kinds.cash"),
      before: BEFORE_DICTATED_SALE.cash,
      after: EXAMPLE_ACCOUNTS.cash,
    },
    {
      key: "owed",
      label: t("operate.home.money.owed"),
      before: BEFORE_DICTATED_SALE.receivables,
      after: EXAMPLE_RECEIVABLES.outstanding,
    },
  ];
  return (
    <Surface>
      <View className="px-4 pb-1 pt-3.5">
        <SurfaceHeader action={t("operate.home.today.all")} title={t("operate.home.today.title")} />
      </View>
      <MovementLine className="bg-chart-fill" movement={sale} />
      {earlier.slice(0, 2).map((movement) => (
        <MovementLine className="border-t border-border" key={movement.key} movement={movement} />
      ))}
      <View className="gap-2 border-t border-border px-4 py-3.5">
        {balances.map((balance) => (
          <View className="flex-row items-center justify-between gap-3" key={balance.key}>
            <Text className="text-dense text-muted-foreground">{balance.label}</Text>
            <ChangedValue after={money(balance.after)} before={money(balance.before)} numeric />
          </View>
        ))}
      </View>
    </Surface>
  );
}

/** A step's picture; `DictationExample` already is a labelled figure, so it is not wrapped. */
function StepFigure({ step }: { step: Step }) {
  const { t } = useTranslation();
  const label = t(`welcome.how.steps.${step}.figure`);
  if (step === "review") return <DictationExample label={label} tone="default" />;
  return (
    <View accessibilityLabel={label} role="figure">
      {step === "say" ? <Dictating /> : <Saved />}
    </View>
  );
}

/**
 * "Cómo funciona": one dictated sale from the sentence to the saved record. The steps are tabs,
 * so one picture at a time gets the width to be read.
 */
export function HowItWorks({ heading }: { heading: ReactNode }) {
  const { t } = useTranslation();
  const [active, setActive] = useState<Step>("say");
  return (
    <Tabs
      className="min-w-0 gap-12 lg:flex-row lg:gap-0"
      onValueChange={(value) => {
        const step = STEPS.find((candidate) => candidate === value);
        if (step) setActive(step);
      }}
      orientation="vertical"
      value={active}
    >
      <View className="min-w-0 gap-10 lg:w-[440px] lg:shrink-0 lg:pr-16">
        {heading}
        <TabsList className="flex w-full flex-col flex-nowrap items-stretch justify-start rounded-none border-0 bg-transparent p-0">
          {STEPS.map((step, index) => (
            <TabsTrigger
              // The tab primitive focuses a step from script, so the browser rings it after a
              // pointer press too, around the whole block; focus underlines the step's title.
              className={cn(
                "pisto-own-focus-mark group flex w-full flex-col items-stretch justify-start gap-2 whitespace-normal rounded-none border-t bg-transparent px-0 py-5 shadow-none web:cursor-pointer dark:bg-transparent",
                step === active ? "border-foreground" : "border-border",
              )}
              key={step}
              value={step}
            >
              <View className="flex-row items-baseline gap-4">
                <Text className="w-4 text-dense tabular-nums text-muted-foreground">
                  {index + 1}
                </Text>
                <Text
                  className={cn(
                    "min-w-0 flex-1 text-left font-ui text-title-lg web:underline-offset-4 web:group-focus-visible:underline",
                    step === active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {t(`welcome.how.steps.${step}.title`)}
                </Text>
              </View>
              {step === active ? (
                <Text className="pl-8 text-left font-sans text-base text-muted-foreground web:text-pretty">
                  {t(`welcome.how.steps.${step}.description`)}
                </Text>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </View>
      {/* The same grey stage as the opening, so every product picture stands on one surface. */}
      <View className="min-w-0 items-center justify-center rounded-2xl border border-border bg-muted p-4 sm:p-8 lg:min-h-[520px] lg:flex-1 lg:p-14">
        {STEPS.map((step) => (
          <TabsContent
            className="pointer-events-none w-full max-w-[560px] flex-none"
            key={step}
            value={step}
          >
            <StepFigure step={step} />
          </TabsContent>
        ))}
      </View>
    </Tabs>
  );
}
