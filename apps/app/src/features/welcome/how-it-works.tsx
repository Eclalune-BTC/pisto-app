import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { ProductPreview } from "./product-preview";

export const STEPS = ["say", "review", "save"] as const;

export function HowItWorks() {
  const { t } = useTranslation();
  return (
    <View className="min-w-0 gap-8 lg:flex-row lg:items-center lg:gap-16 xl:gap-24">
      <View className="min-w-0 flex-1 gap-6">
        <Heading
          className="web:scroll-mt-5"
          level={2}
          nativeID="how"
          size="marketing"
          tabIndex={-1}
        >
          {t("welcome.how.title")}
        </Heading>
        <View role="list">
          {STEPS.map((step, index) => (
            <View
              className="flex-row gap-4 border-t border-border py-4 sm:gap-6"
              key={step}
              role="listitem"
            >
              <Text
                aria-hidden
                className="w-5 pt-0.5 font-ui text-dense tabular-nums text-muted-foreground"
              >
                {index + 1}
              </Text>
              <View className="min-w-0 flex-1 gap-1">
                <Heading level={3} size="item">
                  {t(`welcome.how.steps.${step}.title`)}
                </Heading>
                <Text className="max-w-[420px] text-base text-muted-foreground">
                  {t(`welcome.how.steps.${step}.description`)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
      <View className="min-w-0 lg:flex-1">
        <ProductPreview />
      </View>
    </View>
  );
}
