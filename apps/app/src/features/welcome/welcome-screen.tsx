import { Link } from "expo-router";
import Head from "expo-router/head";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type LayoutChangeEvent, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppearanceControl } from "@/components/appearance-control";
import { Brand } from "@/components/brand";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { ProductShowcase } from "./product-showcase";

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
    const target = sectionViews.current[section];
    if (!scroll.current || y === undefined || !target) return;
    scroll.current.scrollTo({ y, animated: false });
    if (Platform.OS === "web") target.focus();
  };
  const sectionProps = (id: Section) => ({
    nativeID: id,
    accessibilityLabel: t(`welcome.sectionLinks.${id}`),
    tabIndex: -1 as const,
    ref: (node: View | null) => {
      sectionViews.current[id] = node;
    },
    onLayout: ({ nativeEvent }: LayoutChangeEvent) => {
      const y = nativeEvent.layout.y;
      setOffsets((current) => (current[id] === y ? current : { ...current, [id]: y }));
    },
  });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      {Platform.OS === "web" ? (
        <Head>
          <title>{t("welcome.pageTitle")}</title>
          <meta name="description" content={t("welcome.description")} />
        </Head>
      ) : null}
      <View className="border-b border-border bg-background" role="banner">
        <View className="mx-auto w-full max-w-[1200px] flex-row items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <Brand />
          <View
            accessibilityLabel={t("welcome.navigation")}
            className="hidden flex-row gap-2 lg:flex"
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
          <View className="min-w-0 flex-row items-center gap-1 sm:gap-3">
            <Link href="/sign-in" asChild>
              <Button
                className="px-2 sm:px-4"
                label={t("welcome.signIn")}
                size="sm"
                variant="ghost"
              />
            </Link>
            <Link href="/sign-up" className="hidden sm:flex" asChild>
              <Button label={t("welcome.createAccount")} size="sm" variant="default" />
            </Link>
            <AppearanceControl compact />
          </View>
        </View>
      </View>

      <ScrollView
        ref={scroll}
        contentContainerClassName="flex-grow"
        keyboardShouldPersistTaps="handled"
      >
        <View role="main">
          <View className="bg-background">
            <View className="mx-auto w-full max-w-[1200px] items-center gap-6 px-5 pb-14 pt-12 sm:px-8 sm:pb-16 sm:pt-20 lg:pt-24">
              <Text className="font-ui text-center text-sm text-muted-foreground">
                {t("welcome.audience")}
              </Text>
              <Heading className="max-w-[900px] text-center font-heading text-[40px] leading-[48px] tracking-[-0.5px] text-foreground sm:text-[60px] sm:leading-[68px] lg:text-[72px] lg:leading-[80px]">
                {t("welcome.title")}
              </Heading>
              <Text className="max-w-[650px] text-center text-lg leading-8 text-muted-foreground">
                {t("welcome.description")}
              </Text>
              <View className="flex-row flex-wrap justify-center gap-3 pt-2">
                <Link href="/sign-up" asChild>
                  <Button label={t("welcome.createAccount")} size="lg" variant="default" />
                </Link>
                <Button
                  label={t("welcome.explore")}
                  disabled={offsets.product === undefined}
                  onPress={() => openSection("product")}
                  size="lg"
                  variant="outline"
                />
              </View>
              <Text className="max-w-[500px] text-center text-sm leading-6 text-muted-foreground">
                {t("welcome.availability")}
              </Text>
            </View>
          </View>

          <View {...sectionProps("product")} className="bg-background">
            <View className="mx-auto w-full max-w-[1200px] gap-8 px-5 py-14 sm:px-8 sm:py-20">
              <View className="items-center gap-3">
                <Heading
                  className="max-w-[760px] text-center text-foreground"
                  level={2}
                  size="marketing"
                >
                  {t("welcome.product.title")}
                </Heading>
                <Text className="max-w-[660px] text-center text-base leading-7 text-muted-foreground">
                  {t("welcome.product.description")}
                </Text>
              </View>
              <ProductShowcase />
            </View>
          </View>

          <View {...sectionProps("workflow")} className="border-y border-border bg-muted">
            <View className="mx-auto w-full max-w-[1200px] gap-10 px-5 py-14 sm:px-8 sm:py-20">
              <View className="gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
                <Heading className="max-w-[520px] text-foreground" level={2} size="marketing">
                  {t("welcome.workflow.title")}
                </Heading>
                <Text className="max-w-[390px] text-base leading-7 text-muted-foreground">
                  {t("welcome.workflow.description")}
                </Text>
              </View>
              <View className="gap-8 md:flex-row md:gap-10">
                {steps.map((step, index) => (
                  <View key={step} className="min-w-0 gap-4 md:flex-1">
                    <Text className="font-heading text-3xl text-foreground dark:text-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </Text>
                    <View className="gap-2 border-t border-border pt-5">
                      <Heading
                        className="font-heading text-xl text-foreground"
                        level={3}
                        size="section"
                      >
                        {t(`welcome.workflow.${step}.title`)}
                      </Heading>
                      <Text className="text-base leading-7 text-muted-foreground">
                        {t(`welcome.workflow.${step}.description`)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View {...sectionProps("questions")} className="bg-background">
            <View className="mx-auto w-full max-w-[1200px] gap-8 px-5 py-14 sm:px-8 sm:py-20 lg:flex-row lg:gap-16">
              <View className="gap-3 lg:w-[32%]">
                <Heading className="text-foreground" level={2} size="marketing">
                  {t("welcome.questions.title")}
                </Heading>
                <Text className="text-base leading-7 text-muted-foreground">
                  {t("welcome.questions.description")}
                </Text>
              </View>
              <Accordion className="min-w-0 lg:flex-1" type="single" collapsible>
                {questions.map((question) => (
                  <AccordionItem key={question} value={question} className="border-border">
                    <AccordionTrigger>
                      <Text className="min-w-0 flex-1 font-ui text-base leading-6 text-foreground">
                        {t(`welcome.questions.${question}.question`)}
                      </Text>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Text className="text-base leading-7 text-muted-foreground">
                        {t(`welcome.questions.${question}.answer`)}
                      </Text>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </View>
          </View>

          <View className="bg-background px-5 pb-14 sm:px-8 sm:pb-20">
            <View className="mx-auto w-full max-w-[1136px] gap-6 rounded-2xl bg-foreground px-6 py-10 sm:flex-row sm:items-center sm:justify-between sm:gap-12 sm:p-12">
              <View className="min-w-0 gap-3 sm:flex-1">
                <Heading className="text-background" level={2} size="marketing">
                  {t("welcome.closing.title")}
                </Heading>
                <Text className="max-w-[540px] text-base leading-7 text-background">
                  {t("welcome.closing.description")}
                </Text>
              </View>
              <Link href="/sign-up" asChild>
                <Button
                  className="self-start bg-background sm:self-center"
                  size="lg"
                  variant="ghost"
                >
                  <Text className="font-ui text-base text-foreground">
                    {t("welcome.createAccount")}
                  </Text>
                </Button>
              </Link>
            </View>
          </View>
        </View>

        <SafeAreaView className="border-t border-border bg-background" edges={["bottom"]}>
          <View
            className="mx-auto w-full max-w-[1200px] gap-6 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8"
            role="contentinfo"
          >
            <View className="gap-3">
              <Brand />
              <Text className="text-sm leading-6 text-muted-foreground">{t("welcome.footer")}</Text>
            </View>
            <AppearanceControl />
          </View>
        </SafeAreaView>
      </ScrollView>
    </SafeAreaView>
  );
}
