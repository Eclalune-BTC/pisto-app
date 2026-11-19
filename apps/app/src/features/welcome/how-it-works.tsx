import { Play } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

export const STEPS = ["product", "payment", "receipt"] as const;
export type FilmChapter = (typeof STEPS)[number];
export const FILM_STARTS = { product: 0, payment: 8, receipt: 13 } satisfies Record<
  FilmChapter,
  number
>;

export function FilmLayout({
  active,
  media,
  onSelect,
}: {
  active: FilmChapter;
  media: ReactNode;
  onSelect: (step: FilmChapter) => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="min-w-0 gap-6 sm:gap-8">
      <View className="gap-3 md:flex-row md:items-end md:justify-between md:gap-10">
        <Heading className="web:scroll-mt-5" level={2} nativeID="how" size="display" tabIndex={-1}>
          {t("welcome.how.filmTitle")}
        </Heading>
        <Text className="max-w-[420px] text-base leading-6 text-muted-foreground">
          {t("welcome.how.filmDescription")}
        </Text>
      </View>
      <View className="min-w-0 gap-3 lg:flex-row lg:items-start lg:gap-8">
        <View className="min-w-0 lg:flex-[2.1]">{media}</View>
        <View className="min-w-0 lg:flex-1" role="list">
          {STEPS.map((step, index) => (
            <View key={step} role="listitem">
              <Button
                accessibilityLabel={t(`welcome.how.chapters.${step}`)}
                accessibilityState={{ selected: active === step }}
                aria-pressed={active === step}
                className={cn(
                  "h-auto min-h-[72px] flex-row items-start justify-start gap-3 rounded-none border-t border-border px-1 py-3 lg:py-4",
                  active === step && "bg-muted",
                )}
                onPress={() => onSelect(step)}
                variant="ghost"
              >
                <View className="w-8 items-start pt-0.5">
                  {active === step ? (
                    <Icon as={Play} className="text-foreground" size={16} />
                  ) : (
                    <Text className="font-ui text-sm text-muted-foreground">0{index + 1}</Text>
                  )}
                </View>
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="text-left font-heading text-title text-foreground">
                    {t(`welcome.how.chapters.${step}`)}
                  </Text>
                  <Text className="text-left font-sans text-sm leading-5 text-muted-foreground">
                    {t(`welcome.how.detail.${step}`)}
                  </Text>
                </View>
              </Button>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
