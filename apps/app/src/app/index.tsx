import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const capabilities = [
    {
      title: t("welcome.capabilities.businessContext.title"),
      description: t("welcome.capabilities.businessContext.description"),
    },
    {
      title: t("welcome.capabilities.reviewedSales.title"),
      description: t("welcome.capabilities.reviewedSales.description"),
    },
    {
      title: t("welcome.capabilities.realResults.title"),
      description: t("welcome.capabilities.realResults.description"),
    },
  ] as const;

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView className="flex-1" edges={["top", "left", "right"]}>
        <ScrollView contentContainerClassName="flex-grow" showsVerticalScrollIndicator={false}>
          <View className="mx-auto w-full max-w-[1040px] flex-1 px-5 pb-10 pt-4 sm:px-8">
            <View className="min-h-16 flex-row items-center justify-between" role="banner">
              <Brand />
              <View className="flex-row items-center gap-2">
                <Button
                  className="hidden sm:flex"
                  label={t("welcome.signIn")}
                  onPress={() => router.push("/sign-in")}
                  size="sm"
                  variant="ghost"
                />
                <Button
                  label={t("welcome.createAccount")}
                  onPress={() => router.push("/sign-up")}
                  size="sm"
                  variant="primary"
                />
              </View>
            </View>

            <View className="flex-1" role="main">
              <View className="mx-auto w-full max-w-[680px] gap-6 py-12 sm:py-16">
                <Heading size="welcome">{t("welcome.title")}</Heading>
                <Text className="text-base leading-7 text-muted-foreground">
                  {t("welcome.description")}
                </Text>
                <View className="gap-3 sm:flex-row">
                  <Button
                    label={t("welcome.setupBusiness")}
                    onPress={() => router.push("/sign-up")}
                    variant="primary"
                  />
                  <Button
                    label={t("welcome.existingAccount")}
                    onPress={() => router.push("/sign-in")}
                    variant="secondary"
                  />
                </View>
                <Text className="text-sm leading-5 text-muted-foreground">
                  {t("welcome.availableNow")}
                </Text>
              </View>

              <View className="border-t border-border sm:flex-row">
                {capabilities.map((item, index) => (
                  <View
                    key={item.title}
                    className={`min-w-0 flex-1 py-6 ${
                      index < capabilities.length - 1
                        ? "border-b border-border sm:border-b-0 sm:border-r sm:pr-6"
                        : ""
                    } ${index > 0 ? "sm:pl-6" : ""}`}
                  >
                    <View className="gap-2">
                      <Heading level={2} size="section">
                        {item.title}
                      </Heading>
                      <Text className="text-sm leading-6 text-muted-foreground">
                        {item.description}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
