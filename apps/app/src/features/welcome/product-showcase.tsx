import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, StyleSheet, View } from "react-native";
import { useUniwind } from "uniwind";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import { OPERATE_GROUPS, OPERATE_MODULES } from "@/features/operate/navigation";
import { cn } from "@/lib/cn";
import insightDark from "../../../assets/product/insight-dark.png";
import insightLight from "../../../assets/product/insight-light.png";
import moneyDark from "../../../assets/product/money-dark.png";
import moneyLight from "../../../assets/product/money-light.png";
import relationshipsDark from "../../../assets/product/relationships-dark.png";
import relationshipsLight from "../../../assets/product/relationships-light.png";
import stockDark from "../../../assets/product/stock-dark.png";
import stockLight from "../../../assets/product/stock-light.png";

const screenshots = {
  money: { light: moneyLight, dark: moneyDark },
  stock: { light: stockLight, dark: stockDark },
  relationships: { light: relationshipsLight, dark: relationshipsDark },
  insight: { light: insightLight, dark: insightDark },
};

export function ProductShowcase() {
  const { t } = useTranslation();
  const { theme } = useUniwind();
  const [active, setActive] = useState("money");
  return (
    <Tabs value={active} onValueChange={setActive} className="gap-7">
      <TabsList
        accessibilityLabel={t("welcome.product.navigation")}
        className="self-stretch bg-muted sm:self-center"
      >
        {OPERATE_GROUPS.map(({ id }) => (
          <TabsTrigger
            key={id}
            value={id}
            className={cn(
              "min-w-[120px] flex-1 px-3 sm:min-w-0 sm:flex-none sm:px-6",
              active === id && "border-border",
            )}
          >
            <Text
              className={cn(
                "font-ui text-sm text-muted-foreground",
                active === id && "text-foreground",
              )}
            >
              {t(`welcome.product.${id}.tab`)}
            </Text>
          </TabsTrigger>
        ))}
      </TabsList>
      {OPERATE_GROUPS.map(({ id }) => (
        <TabsContent key={id} value={id} tabIndex={0}>
          <Card className="gap-0 overflow-hidden py-0 shadow-none lg:flex-row">
            <CardContent className="min-w-0 gap-6 p-6 sm:p-8 lg:w-[38%] lg:justify-center lg:p-10">
              <CardHeader className="gap-3 px-0">
                <CardTitle className="font-heading text-[27px] leading-9 text-foreground">
                  {t(`welcome.product.${id}.title`)}
                </CardTitle>
                <CardDescription className="text-base leading-7">
                  {t(`welcome.product.${id}.description`)}
                </CardDescription>
              </CardHeader>
              <View className="gap-4">
                {OPERATE_MODULES.filter((module) => module.group === id).map((module) => (
                  <View key={module.id} className="gap-1 border-l-2 border-border pl-4">
                    <Text className="font-ui text-sm text-foreground">{t(module.labelKey)}</Text>
                    <Text className="text-sm leading-6 text-muted-foreground">
                      {t(module.descriptionKey)}
                    </Text>
                  </View>
                ))}
              </View>
            </CardContent>
            <View className="min-w-0 justify-center gap-3 border-t border-border bg-muted p-4 sm:p-6 lg:flex-1 lg:border-l lg:border-t-0 lg:p-8">
              <View
                className="overflow-hidden rounded-xl border border-border bg-background"
                style={{ aspectRatio: 4 / 3 }}
              >
                <Image
                  accessible
                  accessibilityLabel={t(`welcome.product.${id}.imageAlt`)}
                  resizeMode="contain"
                  source={screenshots[id][theme === "dark" ? "dark" : "light"]}
                  style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
                />
              </View>
              <Text className="text-center text-xs leading-5 text-muted-foreground">
                {t("welcome.product.captureNote")}
              </Text>
            </View>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}
