import { useRouter } from "expo-router";
import { ArrowRight, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Brand } from "@/components/brand";
import { Button, ButtonText } from "@/components/ui/button";

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const capabilities = [
    {
      number: "01",
      title: t("welcome.capabilities.businessContext.title"),
      description: t("welcome.capabilities.businessContext.description"),
    },
    {
      number: "02",
      title: t("welcome.capabilities.reviewedSales.title"),
      description: t("welcome.capabilities.reviewedSales.description"),
    },
    {
      number: "03",
      title: t("welcome.capabilities.realResults.title"),
      description: t("welcome.capabilities.realResults.description"),
    },
  ] as const;

  return (
    <View className="flex-1 bg-ink">
      <SafeAreaView className="flex-1" edges={["top", "left", "right"]}>
        <ScrollView contentContainerClassName="flex-grow" showsVerticalScrollIndicator={false}>
          <View className="mx-auto w-full max-w-[1280px] flex-1 px-5 pb-10 pt-4 sm:px-8 lg:px-12">
            <View className="min-h-16 flex-row items-center justify-between" role="banner">
              <Brand inverse />
              <View className="flex-row items-center gap-2">
                <Button
                  className="hidden sm:flex"
                  onPress={() => router.push("/sign-in")}
                  size="sm"
                  variant="ghost"
                >
                  <ButtonText className="text-white" variant="ghost">
                    {t("welcome.signIn")}
                  </ButtonText>
                </Button>
                <Button onPress={() => router.push("/sign-up")} size="sm" variant="accent">
                  <ButtonText variant="accent">{t("welcome.createAccount")}</ButtonText>
                  <ArrowRight color="#14241D" size={16} strokeWidth={2.5} />
                </Button>
              </View>
            </View>

            <View className="flex-1" role="main">
              <View className="flex-1 justify-center gap-12 py-14 lg:min-h-[610px] lg:py-20">
                <View className="max-w-[980px] gap-7">
                  <Text className="self-start text-sm font-bold text-accent">
                    {t("welcome.eyebrow")}
                  </Text>
                  <Text
                    accessibilityRole="header"
                    className="text-[48px] font-black leading-[51px] tracking-[-2.4px] text-white sm:text-[68px] sm:leading-[70px] lg:text-[82px] lg:leading-[82px]"
                  >
                    {t("welcome.title")}
                  </Text>
                  <Text className="max-w-[700px] text-lg leading-7 text-[#BFD0C6] sm:text-xl sm:leading-8">
                    {t("welcome.description")}
                  </Text>
                  <View className="gap-3 sm:flex-row">
                    <Button onPress={() => router.push("/sign-up")} size="lg" variant="accent">
                      <ButtonText variant="accent">{t("welcome.setupBusiness")}</ButtonText>
                      <ArrowRight color="#14241D" size={18} strokeWidth={2.5} />
                    </Button>
                    <Button
                      className="border border-[#496155] bg-transparent"
                      label={t("welcome.existingAccount")}
                      onPress={() => router.push("/sign-in")}
                      size="lg"
                    />
                  </View>
                  <View className="flex-row items-start gap-2">
                    <Check color="#D9FB67" size={17} strokeWidth={2.8} />
                    <Text className="max-w-[680px] text-sm leading-5 text-[#AFC0B6]">
                      {t("welcome.availableNow")}
                    </Text>
                  </View>
                </View>
              </View>

              <View className="border-t border-[#385247] sm:flex-row">
                {capabilities.map((item, index) => (
                  <View
                    key={item.number}
                    className={`flex-1 gap-4 py-7 ${
                      index < capabilities.length - 1
                        ? "border-b border-[#385247] sm:border-b-0 sm:border-r sm:pr-7"
                        : ""
                    } ${index > 0 ? "sm:pl-7" : ""}`}
                  >
                    <Text className="text-xs font-black tracking-[1.5px] text-accent">
                      {item.number}
                    </Text>
                    <View className="gap-2">
                      <Text className="text-lg font-bold text-white">{item.title}</Text>
                      <Text className="text-sm leading-5 text-[#AFC0B6]">{item.description}</Text>
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
