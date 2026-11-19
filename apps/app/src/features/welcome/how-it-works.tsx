import { Play } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { type ChapterId, TOUR_IDS, TOURS, type TourId } from "./tours";

/** "Cómo funciona": the visitor picks one of the films, reads what it shows and jumps by chapter. */
export function TourLayout({
  tour,
  chapter,
  media,
  onTour,
  onChapter,
}: {
  tour: TourId;
  chapter: ChapterId;
  media: ReactNode;
  onTour: (tour: TourId) => void;
  onChapter: (chapter: ChapterId) => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="min-w-0 gap-6 sm:gap-8">
      <View className="gap-3 md:flex-row md:items-end md:justify-between md:gap-10">
        <Heading className="web:scroll-mt-5" level={2} nativeID="how" size="display" tabIndex={-1}>
          {t("welcome.how.heading")}
        </Heading>
        <Text className="max-w-[420px] text-base leading-6 text-muted-foreground">
          {t("welcome.how.description")}
        </Text>
      </View>
      <Tabs
        className="min-w-0 gap-5 sm:gap-6"
        onValueChange={(value) => {
          const next = TOUR_IDS.find((id) => id === value);
          if (next && next !== tour) onTour(next);
        }}
        value={tour}
      >
        <TabsList
          accessibilityLabel={t("welcome.how.toursLabel")}
          className="w-full flex-row flex-nowrap items-stretch justify-start gap-x-6 rounded-none border-0 border-b border-border bg-transparent p-0 sm:gap-x-10"
        >
          {TOUR_IDS.map((id) => (
            <TabsTrigger
              className={cn(
                "h-auto min-h-14 flex-col items-start justify-center gap-0 rounded-none border-b-2 bg-transparent px-0 py-2 shadow-none web:cursor-pointer dark:bg-transparent",
                tour === id ? "border-foreground" : "border-transparent",
              )}
              key={id}
              value={id}
            >
              <Text className="text-sm sm:text-base">{t(`welcome.how.tours.${id}.name`)}</Text>
              <Text className="font-sans text-xs tabular-nums text-muted-foreground sm:text-sm">
                {TOURS[id].duration}
              </Text>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent className="gap-5 sm:gap-6" key={tour} value={tour}>
          <Text className="pisto-caption-in max-w-[720px] text-base leading-6 sm:text-lg sm:leading-7">
            {t(`welcome.how.tours.${tour}.summary`)}
          </Text>
          <View className="min-w-0 gap-3 lg:flex-row lg:items-start lg:gap-8">
            <View className="min-w-0 lg:flex-[2.1]">{media}</View>
            <View className="min-w-0 lg:flex-1" role="list">
              {TOURS[tour].chapters.map(({ id }, index) => (
                <View key={id} role="listitem">
                  <Button
                    accessibilityLabel={t(`welcome.how.chapters.${id}`)}
                    accessibilityState={{ selected: chapter === id }}
                    aria-pressed={chapter === id}
                    className={cn(
                      "h-auto min-h-11 flex-row items-start justify-start gap-3 rounded-none border-t border-border px-1 py-3",
                      chapter === id && "bg-muted",
                    )}
                    onPress={() => onChapter(id)}
                    variant="ghost"
                  >
                    <View className="w-8 items-start pt-0.5">
                      {chapter === id ? (
                        <Icon as={Play} className="text-foreground" size={16} />
                      ) : (
                        <Text className="font-ui text-sm text-muted-foreground">0{index + 1}</Text>
                      )}
                    </View>
                    <View className="min-w-0 flex-1 gap-1">
                      <Text className="text-left font-heading text-title text-foreground">
                        {t(`welcome.how.chapters.${id}`)}
                      </Text>
                      {chapter === id ? (
                        <Text className="text-left font-sans text-sm leading-5 text-muted-foreground">
                          {t(`welcome.how.detail.${id}`)}
                        </Text>
                      ) : null}
                    </View>
                  </Button>
                </View>
              ))}
            </View>
          </View>
        </TabsContent>
      </Tabs>
    </View>
  );
}
