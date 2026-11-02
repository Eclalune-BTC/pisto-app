import { Link } from "expo-router";
import Head from "expo-router/head";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppearanceControl } from "@/components/appearance-control";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { HowItWorks } from "./how-it-works";
import { ModulePreviews } from "./module-previews";
import { ProductPreview } from "./product-preview";
import { RolesAndTrust } from "./roles-section";

/** The one content width every band of the page shares, with the shell's gutters. */
const CONTAINER = "mx-auto w-full max-w-[1200px] px-4 sm:px-8";

const SECTION_TITLE =
  "text-[26px] leading-8 tracking-[-0.6px] sm:text-[32px] sm:leading-10 sm:tracking-[-0.9px]";

function Band({
  children,
  description,
  surface = "page",
  title,
}: {
  children: ReactNode;
  description: string;
  surface?: "page" | "card";
  title: string;
}) {
  return (
    <View className={cn("border-t border-border", surface === "card" && "bg-card")}>
      <View className={cn(CONTAINER, "gap-10 py-16 sm:gap-14 sm:py-24")}>
        <View className="max-w-[620px] gap-3">
          <Heading className={SECTION_TITLE} level={2}>
            {title}
          </Heading>
          <Text className="text-base leading-7 text-muted-foreground sm:text-[17px]">
            {description}
          </Text>
        </View>
        {children}
      </View>
    </View>
  );
}

export default function WelcomeScreen() {
  const { t } = useTranslation();

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
        <View className={cn(CONTAINER, "h-14 flex-row items-center justify-between gap-3")}>
          <Brand />
          <View className="min-w-0 flex-row items-center gap-1 sm:gap-2">
            <AppearanceControl compact />
            <Link href="/sign-in" asChild>
              <Button className="px-2.5" label={t("welcome.signIn")} size="sm" variant="ghost" />
            </Link>
            <Link href="/sign-up" asChild>
              <Button label={t("welcome.createAccount")} size="sm" />
            </Link>
          </View>
        </View>
      </View>

      <ScrollView contentContainerClassName="flex-grow" keyboardShouldPersistTaps="handled">
        <View className="flex-1" role="main">
          <View
            className={cn(
              CONTAINER,
              "gap-12 pb-16 pt-12 sm:gap-14 sm:pb-24 sm:pt-20 xl:flex-row xl:items-center xl:gap-14",
            )}
          >
            <View className="min-w-0 gap-6 xl:w-[420px]">
              <Heading className="max-w-[620px] text-[36px] leading-[42px] tracking-[-1.2px] web:text-balance sm:text-[50px] sm:leading-[56px] sm:tracking-[-1.8px] xl:text-[46px] xl:leading-[52px]">
                {t("welcome.title")}
              </Heading>
              <Text className="max-w-[560px] text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                {t("welcome.description")}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                <Link href="/sign-up" asChild>
                  <Button label={t("welcome.createAccount")} size="lg" />
                </Link>
                <Link href="/sign-in" asChild>
                  <Button label={t("welcome.signIn")} size="lg" variant="outline" />
                </Link>
              </View>
              <Text className="text-[13px] leading-5 text-muted-foreground">
                {t("welcome.availability")}
              </Text>
            </View>
            <View className="min-w-0 xl:flex-1">
              <ProductPreview />
            </View>
          </View>

          <Band
            description={t("welcome.how.description")}
            surface="card"
            title={t("welcome.how.title")}
          >
            <HowItWorks />
          </Band>

          <Band description={t("welcome.modules.description")} title={t("welcome.modules.title")}>
            <ModulePreviews />
          </Band>

          <Band
            description={t("welcome.roles.description")}
            surface="card"
            title={t("welcome.roles.title")}
          >
            <RolesAndTrust />
          </Band>

          <View className="bg-primary dark:border-t dark:border-border dark:bg-background">
            <View
              className={cn(
                CONTAINER,
                "gap-8 py-16 sm:py-20 lg:flex-row lg:items-center lg:justify-between",
              )}
            >
              <View className="min-w-0 max-w-[620px] gap-3">
                <Heading
                  className={cn(SECTION_TITLE, "text-primary-foreground dark:text-foreground")}
                  level={2}
                >
                  {t("welcome.cta.title")}
                </Heading>
                <Text className="text-base leading-7 text-primary-foreground/75 dark:text-muted-foreground sm:text-[17px]">
                  {t("welcome.cta.description")}
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                <Link href="/sign-up" asChild>
                  <Button
                    className="bg-highlight web:hover:bg-highlight-strong dark:bg-primary dark:web:hover:bg-primary/85"
                    size="lg"
                  >
                    <Text className="text-highlight-foreground dark:text-primary-foreground">
                      {t("welcome.createAccount")}
                    </Text>
                  </Button>
                </Link>
                <Link href="/sign-in" asChild>
                  <Button
                    className="border-primary-foreground/30 bg-transparent web:hover:bg-primary-foreground/10 dark:border-border dark:bg-card dark:web:hover:bg-accent"
                    size="lg"
                    variant="outline"
                  >
                    <Text className="text-primary-foreground dark:text-foreground">
                      {t("welcome.signIn")}
                    </Text>
                  </Button>
                </Link>
              </View>
            </View>
          </View>
        </View>

        <SafeAreaView className="border-t border-border" edges={["bottom"]}>
          <View
            className={cn(
              CONTAINER,
              "flex-row flex-wrap items-center justify-between gap-x-6 gap-y-4 py-8",
            )}
            role="contentinfo"
          >
            <Brand />
            <View
              accessibilityLabel={t("welcome.footer.links")}
              className="flex-row flex-wrap gap-x-5 gap-y-2"
              role="navigation"
            >
              <Link href="/sign-in" asChild>
                <Text className="font-ui text-[13px] text-foreground web:hover:underline web:underline-offset-4">
                  {t("welcome.signIn")}
                </Text>
              </Link>
              <Link href="/sign-up" asChild>
                <Text className="font-ui text-[13px] text-foreground web:hover:underline web:underline-offset-4">
                  {t("welcome.createAccount")}
                </Text>
              </Link>
            </View>
          </View>
        </SafeAreaView>
      </ScrollView>
    </SafeAreaView>
  );
}
