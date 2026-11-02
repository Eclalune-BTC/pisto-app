import { Link } from "expo-router";
import Head from "expo-router/head";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUniwind } from "uniwind";
import { AppearanceControl } from "@/components/appearance-control";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { DictationExample } from "./dictation-example";

/** What the product records, in the order a shop owner meets it during the day. */
export const RECORD_ITEMS = [
  "sales",
  "purchases",
  "expenses",
  "cash",
  "accounts",
  "inventory",
  "reports",
] as const;

export default function WelcomeScreen() {
  const { t } = useTranslation();
  // The brand panel turns pale green in the dark palette, so dark mode uses a card surface.
  const { theme } = useUniwind();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      {Platform.OS === "web" ? (
        <Head>
          <title>{t("welcome.pageTitle")}</title>
          <meta name="description" content={t("welcome.description")} />
        </Head>
      ) : null}
      <View
        className="z-10 border-b border-border bg-background web:bg-background/90 web:backdrop-blur-md"
        role="banner"
      >
        <View className="mx-auto h-14 w-full max-w-[1120px] flex-row items-center justify-between gap-3 px-4 sm:px-8">
          <Brand />
          <View className="min-w-0 flex-row items-center gap-1 sm:gap-2">
            <Link href="/sign-in" asChild>
              <Button className="px-2.5" label={t("welcome.signIn")} size="sm" variant="ghost" />
            </Link>
            <Link href="/sign-up" asChild>
              <Button className="hidden sm:flex" label={t("welcome.createAccount")} size="sm" />
            </Link>
          </View>
        </View>
      </View>

      <ScrollView contentContainerClassName="flex-grow" keyboardShouldPersistTaps="handled">
        <View className="flex-1" role="main">
          <View className="mx-auto w-full max-w-[1120px] gap-10 px-4 pb-14 pt-10 sm:px-8 sm:pt-16 lg:flex-row lg:items-center lg:gap-14 lg:pb-20">
            <View className="min-w-0 gap-5 lg:flex-1">
              <Heading className="max-w-[560px] text-[34px] leading-[40px] tracking-[-1px] sm:text-[44px] sm:leading-[50px] sm:tracking-[-1.4px]">
                {t("welcome.title")}
              </Heading>
              <Text className="max-w-[500px] text-base leading-7 text-muted-foreground sm:text-[17px]">
                {t("welcome.description")}
              </Text>
              <View className="flex-row flex-wrap gap-2 pt-1">
                <Link href="/sign-up" asChild>
                  <Button className="rounded-lg" label={t("welcome.createAccount")} size="lg" />
                </Link>
                <Link href="/sign-in" asChild>
                  <Button
                    className="rounded-lg"
                    label={t("welcome.signIn")}
                    size="lg"
                    variant="outline"
                  />
                </Link>
              </View>
              <Text className="text-[13px] leading-5 text-muted-foreground">
                {t("welcome.availability")}
              </Text>
            </View>
            <View className="min-w-0 rounded-2xl bg-primary p-4 dark:border dark:border-border dark:bg-card sm:p-7 lg:w-[500px]">
              <DictationExample tone={theme === "dark" ? "default" : "inverse"} />
            </View>
          </View>

          <View className="border-t border-border bg-card">
            <View className="mx-auto w-full max-w-[1120px] gap-8 px-4 py-12 sm:px-8 sm:py-16 lg:flex-row lg:gap-14">
              <View className="gap-2 lg:w-[300px]">
                <Heading level={2} className="text-[22px] leading-8 tracking-[-0.4px]">
                  {t("welcome.records.title")}
                </Heading>
                <Text className="text-sm leading-6 text-muted-foreground">
                  {t("welcome.records.description")}
                </Text>
              </View>
              <View className="min-w-0 flex-1 flex-row flex-wrap" role="list">
                {RECORD_ITEMS.map((item, index) => (
                  <View
                    className={cn(
                      "w-full gap-1 border-t border-border py-4 sm:w-1/2 sm:pr-8",
                      index === 0 && "border-t-0 sm:border-t",
                    )}
                    key={item}
                    role="listitem"
                  >
                    <Text className="font-ui text-[15px] leading-6">
                      {t(`welcome.records.items.${item}.title`)}
                    </Text>
                    <Text className="text-sm leading-6 text-muted-foreground">
                      {t(`welcome.records.items.${item}.description`)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View className="border-t border-border">
            <View className="mx-auto w-full max-w-[1120px] gap-2 px-4 py-10 sm:px-8 lg:flex-row lg:gap-14">
              <Heading level={2} className="text-base leading-6 lg:w-[300px]">
                {t("welcome.scope.title")}
              </Heading>
              <Text className="max-w-[640px] flex-1 text-sm leading-6 text-muted-foreground">
                {t("welcome.scope.description")}
              </Text>
            </View>
          </View>
        </View>

        <SafeAreaView className="border-t border-border" edges={["bottom"]}>
          <View
            className="mx-auto w-full max-w-[1120px] flex-row flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-8"
            role="contentinfo"
          >
            <View className="min-w-0 gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Brand />
              <Text className="min-w-0 shrink text-[13px] leading-5 text-muted-foreground">
                {t("welcome.footer")}
              </Text>
            </View>
            <AppearanceControl />
          </View>
        </SafeAreaView>
      </ScrollView>
    </SafeAreaView>
  );
}
