import { Link } from "expo-router";
import Head from "expo-router/head";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppearanceControl } from "@/components/appearance-control";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { OPERATE_GROUPS, OPERATE_MODULES } from "@/features/operate/navigation";
import { RecordExample } from "./record-example";

type Section = "product" | "workflow" | "questions";
const sections: readonly Section[] = ["product", "workflow", "questions"];
const steps = ["setup", "record", "understand"] as const;
const questions = ["sales", "accounting", "assistant", "devices"] as const;

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const scroll = useRef<ScrollView>(null);
  const sectionViews = useRef<Partial<Record<Section, View | null>>>({});
  const [offsets, setOffsets] = useState<Partial<Record<Section, number>>>({});

  const openSection = (section: Section) => {
    const y = offsets[section];
    if (!scroll.current || y === undefined) throw new Error("Public section layout is not ready");
    scroll.current.scrollTo({ y, animated: false });
    if (Platform.OS === "web") sectionViews.current[section]?.focus();
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      {Platform.OS === "web" ? (
        <Head>
          <title>{t("welcome.pageTitle")}</title>
          <meta name="description" content={t("welcome.description")} />
        </Head>
      ) : null}
      <View className="border-b border-border" role="banner">
        <View className="mx-auto w-full max-w-[1200px] gap-3 px-5 py-3 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <View className="min-w-0 flex-row flex-wrap items-center justify-between gap-6 lg:max-w-[36%]">
            <Brand />
            <AppearanceControl compact />
          </View>
          <View
            accessibilityLabel={t("welcome.navigation")}
            className="hidden flex-row lg:flex"
            role="navigation"
          >
            {sections.map((section) => (
              <Button
                disabled={offsets[section] === undefined}
                key={section}
                label={t(`welcome.sectionLinks.${section}`)}
                onPress={() => openSection(section)}
                size="sm"
                variant="ghost"
              />
            ))}
          </View>
          <View className="flex-row justify-between gap-3 lg:justify-end">
            <Link href="/sign-in" asChild>
              <Button label={t("welcome.signIn")} size="sm" variant="ghost" />
            </Link>
            <Link href="/sign-up" asChild>
              <Button label={t("welcome.createAccount")} size="sm" />
            </Link>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scroll}
        contentContainerClassName="flex-grow"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mx-auto w-full max-w-[1200px] px-5 sm:px-8" role="main">
          <View className="gap-10 py-12 sm:py-16 lg:flex-row lg:items-center lg:gap-16 lg:py-20">
            <View className="min-w-0 flex-1 gap-6">
              <Text className="web:font-sans text-sm font-medium text-link">
                {t("welcome.eyebrow")}
              </Text>
              <Heading size="welcome">{t("welcome.title")}</Heading>
              <Text className="web:font-sans max-w-[520px] text-lg leading-8 text-muted-foreground">
                {t("welcome.description")}
              </Text>
              <View className="gap-3 sm:flex-row sm:flex-wrap">
                <Link href="/sign-up" asChild>
                  <Button label={t("welcome.setupBusiness")} size="lg" />
                </Link>
                <Button
                  disabled={offsets.product === undefined}
                  label={t("welcome.explore")}
                  onPress={() => openSection("product")}
                  size="lg"
                  variant="secondary"
                />
              </View>
              <Text className="web:font-sans text-sm text-muted-foreground">
                {t("welcome.audience")}
              </Text>
            </View>
            <View className="min-w-0 flex-1 lg:max-w-[460px]">
              <RecordExample />
            </View>
          </View>

          <View
            accessibilityLabel={t("welcome.sectionLinks.product")}
            className="border-t border-border py-12 sm:py-16"
            nativeID="product"
            onLayout={({ nativeEvent }) =>
              setOffsets((current) => ({ ...current, product: nativeEvent.layout.y }))
            }
            ref={(value) => {
              sectionViews.current.product = value;
            }}
            tabIndex={-1}
          >
            <View className="gap-5 pb-10 lg:flex-row lg:items-end lg:justify-between">
              <View className="gap-3 lg:max-w-[540px]">
                <Text className="web:font-sans text-xs font-semibold uppercase tracking-[1.3px] text-muted-foreground">
                  {t("welcome.product.eyebrow")}
                </Text>
                <Heading
                  className="text-[30px] leading-9 sm:text-[36px] sm:leading-[44px]"
                  level={2}
                  size="section"
                >
                  {t("welcome.product.title")}
                </Heading>
              </View>
              <Text className="web:font-sans max-w-[390px] text-base leading-7 text-muted-foreground">
                {t("welcome.product.description")}
              </Text>
            </View>
            {OPERATE_GROUPS.map(({ id }) => (
              <View className="gap-5 border-t border-border py-7 sm:flex-row sm:gap-10" key={id}>
                <View className="gap-2 sm:w-[38%]">
                  <Text className="web:font-sans text-xs font-medium text-link">
                    {OPERATE_MODULES.filter((module) => module.group === id)
                      .map((module) => t(module.labelKey))
                      .join(" · ")}
                  </Text>
                  <Heading className="text-[23px] leading-8" level={3} size="section">
                    {t(`welcome.product.${id}.title`)}
                  </Heading>
                </View>
                <View className="min-w-0 flex-1 gap-3">
                  <Text className="web:font-sans text-base leading-7 text-foreground">
                    {t(`welcome.product.${id}.description`)}
                  </Text>
                  <Text className="web:font-sans text-sm leading-6 text-muted-foreground">
                    {t(`welcome.product.${id}.detail`)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <View
            accessibilityLabel={t("welcome.sectionLinks.workflow")}
            className="gap-9 border-t border-border py-12 sm:py-16"
            nativeID="workflow"
            onLayout={({ nativeEvent }) =>
              setOffsets((current) => ({ ...current, workflow: nativeEvent.layout.y }))
            }
            ref={(value) => {
              sectionViews.current.workflow = value;
            }}
            tabIndex={-1}
          >
            <View className="gap-3">
              <Text className="web:font-sans text-xs font-semibold uppercase tracking-[1.3px] text-muted-foreground">
                {t("welcome.workflow.eyebrow")}
              </Text>
              <Heading
                className="text-[30px] leading-9 sm:text-[36px] sm:leading-[44px]"
                level={2}
                size="section"
              >
                {t("welcome.workflow.title")}
              </Heading>
            </View>
            <View className="gap-8 lg:flex-row lg:gap-10">
              {steps.map((step) => (
                <View className="min-w-0 flex-1 gap-3" key={step}>
                  <Heading level={3} size="section">
                    {t(`welcome.workflow.${step}.title`)}
                  </Heading>
                  <Text className="web:font-sans text-base leading-7 text-muted-foreground">
                    {t(`welcome.workflow.${step}.description`)}
                  </Text>
                </View>
              ))}
            </View>
            <View className="gap-4 rounded-lg bg-muted p-6 sm:p-8 lg:flex-row lg:gap-10">
              <Heading className="lg:w-[34%]" level={3} size="section">
                {t("welcome.workflow.controlTitle")}
              </Heading>
              <Text className="web:font-sans min-w-0 flex-1 text-base leading-7 text-foreground">
                {t("welcome.workflow.controlDescription")}
              </Text>
            </View>
          </View>

          <View
            accessibilityLabel={t("welcome.sectionLinks.questions")}
            className="gap-8 border-t border-border py-12 sm:py-16 lg:flex-row lg:gap-16"
            nativeID="questions"
            onLayout={({ nativeEvent }) =>
              setOffsets((current) => ({ ...current, questions: nativeEvent.layout.y }))
            }
            ref={(value) => {
              sectionViews.current.questions = value;
            }}
            tabIndex={-1}
          >
            <View className="gap-3 lg:w-[35%]">
              <Text className="web:font-sans text-xs font-semibold uppercase tracking-[1.3px] text-muted-foreground">
                {t("welcome.questions.eyebrow")}
              </Text>
              <Heading
                className="text-[30px] leading-9 sm:text-[36px] sm:leading-[44px]"
                level={2}
                size="section"
              >
                {t("welcome.questions.title")}
              </Heading>
            </View>
            <View className="min-w-0 flex-1 gap-7">
              {questions.map((question) => (
                <View className="gap-3 border-b border-border pb-7" key={question}>
                  <Heading level={3} size="section">
                    {t(`welcome.questions.${question}.question`)}
                  </Heading>
                  <Text className="web:font-sans text-base leading-7 text-muted-foreground">
                    {t(`welcome.questions.${question}.answer`)}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View className="gap-7 border-y border-border py-12 sm:py-16 lg:flex-row lg:items-center lg:justify-between">
            <View className="min-w-0 flex-1 gap-3">
              <Heading className="text-[30px] leading-9" level={2} size="section">
                {t("welcome.closing.title")}
              </Heading>
              <Text className="web:font-sans text-base leading-7 text-muted-foreground">
                {t("welcome.closing.description")}
              </Text>
            </View>
            <View className="gap-3 sm:flex-row">
              <Link href="/sign-up" asChild>
                <Button label={t("welcome.createAccount")} size="lg" />
              </Link>
              <Link href="/sign-in" asChild>
                <Button label={t("welcome.closing.account")} size="lg" variant="ghost" />
              </Link>
            </View>
          </View>
        </View>
        <SafeAreaView edges={["bottom"]}>
          <View
            className="mx-auto w-full max-w-[1200px] flex-row flex-wrap items-center justify-between gap-4 px-5 py-8 sm:px-8"
            role="contentinfo"
          >
            <Brand />
            <Text className="web:font-sans text-sm text-muted-foreground">
              {t("welcome.footer")}
            </Text>
          </View>
        </SafeAreaView>
      </ScrollView>
    </SafeAreaView>
  );
}
