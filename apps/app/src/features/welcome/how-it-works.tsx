import { Square } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { ChangedValue } from "@/components/layout/review-values";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { MAX_RECORDING_SECONDS } from "@/features/assistant/recorder-types";
import { DictationExample } from "./dictation-example";
import {
  BEFORE_DICTATED_SALE,
  EXAMPLE_ACCOUNTS,
  EXAMPLE_MOVEMENTS,
  EXAMPLE_RECEIVABLES,
} from "./example-business";
import { ButtonLook, MovementLine, Surface, SurfaceHeader, useExample } from "./fragments";

export const STEPS = ["say", "review", "save"] as const;

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
    <Surface className="gap-4 p-4">
      <View className="gap-1">
        <Text className="font-heading text-[15px] leading-5">{t("assistant.dialog.title")}</Text>
        <Text className="text-[13px] leading-5 text-muted-foreground">
          {t("assistant.dialog.description")}
        </Text>
      </View>
      <View className="items-center gap-2 rounded-lg bg-primary px-4 py-4 dark:bg-muted">
        <View aria-hidden className="h-12 flex-row items-center justify-center gap-[3px]">
          {LEVELS.map((level, index) => (
            <View
              className="w-[3px] rounded-full bg-primary-foreground dark:bg-foreground"
              // biome-ignore lint/suspicious/noArrayIndexKey: bars are positional and never reorder
              key={index}
              style={{ height: Math.max(3, Math.round(level * 44)), opacity: 0.35 + level * 0.65 }}
            />
          ))}
        </View>
        <View className="flex-row items-center gap-2">
          <View className="size-2 rounded-full bg-highlight" />
          <Text className="font-ui text-[13px] text-primary-foreground dark:text-foreground">
            {t("assistant.dialog.listening")}
          </Text>
          <Text className="text-[13px] tabular-nums text-primary-foreground/80 dark:text-muted-foreground">
            {t("assistant.dialog.elapsed", {
              elapsed: clock(ELAPSED_SECONDS),
              limit: clock(MAX_RECORDING_SECONDS),
            })}
          </Text>
        </View>
      </View>
      <View className="gap-1">
        <Text className="text-[13px] leading-5 text-muted-foreground">
          {t("assistant.dialog.examplesTitle")}
        </Text>
        {[t("assistant.dialog.examples.expense"), t("assistant.dialog.examples.payment")].map(
          (example) => (
            <Text className="text-[13px] leading-5" key={example}>
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
      <View className="gap-2 border-t border-border px-4 py-3">
        {balances.map((balance) => (
          <View className="flex-row items-center justify-between gap-3" key={balance.key}>
            <Text className="text-[13px] text-muted-foreground">{balance.label}</Text>
            <ChangedValue after={money(balance.after)} before={money(balance.before)} numeric />
          </View>
        ))}
      </View>
    </Surface>
  );
}

function Step({ children, step }: { children: ReactNode; step: (typeof STEPS)[number] }) {
  const { t } = useTranslation();
  return (
    <View
      className="min-w-0 gap-5 md:flex-row md:gap-8 lg:flex-1 lg:flex-col lg:gap-5"
      role="listitem"
    >
      <View className="gap-1.5 md:w-[220px] lg:w-auto">
        <Heading className="text-base leading-6" level={3}>
          {t(`welcome.how.steps.${step}.title`)}
        </Heading>
        <Text className="text-[15px] leading-6 text-muted-foreground">
          {t(`welcome.how.steps.${step}.description`)}
        </Text>
      </View>
      <View
        accessibilityLabel={t(`welcome.how.steps.${step}.figure`)}
        className="pointer-events-none min-w-0 justify-center rounded-xl bg-background p-2.5 sm:p-5 md:flex-1"
        role="figure"
      >
        <View className="w-full min-w-0 max-w-[460px] self-center">{children}</View>
      </View>
    </View>
  );
}

/** "Cómo funciona": one dictated sale from the sentence to the saved record. */
export function HowItWorks() {
  return (
    <View className="min-w-0 gap-12 lg:flex-row lg:items-stretch lg:gap-8" role="list">
      <Step step="say">
        <Dictating />
      </Step>
      <Step step="review">
        <DictationExample tone="default" />
      </Step>
      <Step step="save">
        <Saved />
      </Step>
    </View>
  );
}
