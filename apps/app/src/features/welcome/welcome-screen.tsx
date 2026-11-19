import { Link } from "expo-router";
import Head from "expo-router/head";
import { ArrowDown } from "lucide-react-native";
import { type ReactNode, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppearanceControl } from "@/components/appearance-control";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { SectionHeading, Statement } from "./fragments";
import { HeaderMenu } from "./header-menu";
import { HowItWorks } from "./how-it-works";
import { ModulePreviews } from "./module-previews";
import { PhonePreview, ProductPreview } from "./product-preview";
import { RolesAndTrust } from "./roles-section";

/** The one content width every band of the page shares. */
const CONTAINER = "mx-auto w-full max-w-[1240px] px-5 sm:px-8";

/** The space above and below a band's content: every band keeps the same rhythm. */
const BAND = "py-16 sm:py-20 lg:py-24";

const SECTIONS = ["how", "modules", "roles"] as const;
type SectionId = (typeof SECTIONS)[number];

const LINK_TEXT = "font-sans text-sm text-muted-foreground web:group-hover:text-foreground";

/** A link to a section of this page: it scrolls instead of navigating, on every platform. */
function SectionLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Button
      accessibilityRole="link"
      className="min-h-0 justify-start rounded-none px-0 py-0 active:bg-transparent web:hover:bg-transparent"
      onPress={onPress}
      variant="ghost"
    >
      <Text className={LINK_TEXT}>{label}</Text>
    </Button>
  );
}

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef<Partial<Record<SectionId, number>>>({});
  const [scrolled, setScrolled] = useState(false);
  const year = useMemo(() => new Date().getFullYear(), []);

  const scrollTo = (section: SectionId) =>
    scroll.current?.scrollTo({ y: offsets.current[section] ?? 0, animated: true });
  const sectionLabels: Record<SectionId, string> = {
    how: t("welcome.how.title"),
    modules: t("welcome.nav.modules"),
    roles: t("welcome.nav.roles"),
  };
  const sectionLinks = SECTIONS.map((section) => (
    <SectionLink key={section} label={sectionLabels[section]} onPress={() => scrollTo(section)} />
  ));

  const section = (id: SectionId, children: ReactNode) => (
    <View
      className="border-t border-border"
      onLayout={(event) => {
        offsets.current[id] = event.nativeEvent.layout.y;
      }}
    >
      <View className={cn(CONTAINER, BAND)}>{children}</View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "left", "right"]}>
      {Platform.OS === "web" ? (
        <Head>
          <title>{t("welcome.pageTitle")}</title>
          <meta name="description" content={t("welcome.description")} />
        </Head>
      ) : null}
      <View
        className={cn(
          "z-10 border-b bg-background web:bg-background/85 web:backdrop-blur-md",
          scrolled ? "border-border" : "border-transparent",
        )}
        role="banner"
      >
        <View className={cn(CONTAINER, "h-16 flex-row items-center justify-between gap-4")}>
          <View className="flex-row items-center gap-8 lg:gap-10">
            <Brand />
            <View
              accessibilityLabel={t("welcome.nav.label")}
              className="hidden flex-row items-center gap-5 md:flex lg:gap-7"
              role="navigation"
            >
              {sectionLinks}
            </View>
          </View>
          <View className="hidden min-w-0 flex-row items-center gap-2 md:flex">
            <AppearanceControl compact />
            <Link href="/sign-in" asChild>
              <Button className="px-3" label={t("welcome.signIn")} size="sm" variant="ghost" />
            </Link>
            <Link href="/sign-up" asChild>
              <Button label={t("welcome.createAccount")} size="sm" />
            </Link>
          </View>
          {/* Below the width that fits the links, one action stays and the rest folds into a menu. */}
          <View className="flex-row items-center gap-1 md:hidden">
            <Link href="/sign-up" asChild>
              <Button label={t("welcome.createAccount")} size="sm" />
            </Link>
            <HeaderMenu
              sections={SECTIONS.map((id) => ({
                label: sectionLabels[id],
                onPress: () => scrollTo(id),
              }))}
            />
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerClassName="flex-grow"
        keyboardShouldPersistTaps="handled"
        onScroll={(event) => setScrolled(event.nativeEvent.contentOffset.y > 4)}
        ref={scroll}
        scrollEventThrottle={48}
      >
        <View className="flex-1" role="main">
          {/*
            The page stays on the neutral surface: the type states the job and the product is the
            picture. Colour comes only from the product inside the stage.
          */}
          <View className={cn(CONTAINER, "gap-9 pb-10 pt-12 sm:pb-12 sm:pt-20 lg:pt-24")}>
            <View className="gap-6">
              <Heading className="max-w-[940px] font-ui xl:text-display-xl" size="display">
                {t("welcome.title")}
              </Heading>
              <Text className="max-w-[560px] text-lg text-muted-foreground web:text-pretty sm:text-xl sm:leading-8">
                {t("welcome.description")}
              </Text>
            </View>
            <View className="flex-row flex-wrap items-center gap-x-7 gap-y-4">
              <Link href="/sign-up" asChild>
                <Button label={t("welcome.createAccount")} size="lg" />
              </Link>
              <Button
                accessibilityRole="link"
                className="min-h-0 gap-1.5 rounded-none px-0 py-0 active:bg-transparent web:hover:bg-transparent"
                onPress={() => scrollTo("how")}
                variant="ghost"
              >
                <Text className="font-ui text-base text-foreground web:group-hover:underline web:underline-offset-4">
                  {t("welcome.how.title")}
                </Text>
                <Icon as={ArrowDown} className="text-foreground" size={16} />
              </Button>
            </View>
          </View>

          {/*
            The stage: the home in the app's own frame, and on the widest screens the same home at
            phone width over its corner. Both run past the stage's lower edge instead of being
            shrunk; each height puts that edge in the space under a block, never through a line of
            text. Below the width of the window, the phone-sized home is shown whole instead.
          */}
          <View className={CONTAINER}>
            <View className="overflow-hidden rounded-2xl border border-border bg-muted p-2 md:h-[644px] md:px-8 md:pb-0 md:pt-8 lg:h-[784px] lg:px-14 lg:pt-14 xl:h-[840px]">
              <PhonePreview className="w-full max-w-[420px] self-center md:hidden" frame="closed" />
              <View className="hidden md:flex">
                <ProductPreview />
              </View>
              {/*
                The phone starts level with the window's money card, beside the rows the window
                ends short for it. Its shadow lifts it off the window; nothing else on the page
                has one.
              */}
              <PhonePreview className="absolute bottom-0 right-6 top-[331px] hidden w-[340px] shadow-xl shadow-black/10 xl:flex" />
            </View>
            <Text className="pt-3 text-xs text-muted-foreground">
              {t("welcome.preview.example")}
            </Text>
          </View>

          <View className="h-16 sm:h-20 lg:h-24" />

          {section(
            "how",
            <HowItWorks
              heading={
                <SectionHeading
                  description={t("welcome.how.description")}
                  title={t("welcome.how.title")}
                />
              }
            />,
          )}

          {section(
            "modules",
            <View className="gap-12 lg:gap-16">
              <Statement
                continuation={t("welcome.modules.description")}
                title={t("welcome.modules.title")}
              />
              <ModulePreviews />
            </View>,
          )}

          {section(
            "roles",
            <RolesAndTrust
              heading={
                <SectionHeading
                  description={t("welcome.roles.description")}
                  title={t("welcome.roles.title")}
                />
              }
            />,
          )}

          {/* The page ends as it began: a statement and one action on the neutral surface. */}
          <View className="border-t border-border">
            <View className={cn(CONTAINER, BAND, "gap-10")}>
              <Statement
                continuation={t("welcome.cta.description")}
                size="display"
                title={t("welcome.cta.title")}
              />
              <View className="flex-row">
                <Link href="/sign-up" asChild>
                  <Button label={t("welcome.createAccount")} size="lg" />
                </Link>
              </View>
            </View>
          </View>
        </View>

        <SafeAreaView className="border-t border-border" edges={["bottom"]}>
          <View className={cn(CONTAINER, "gap-10 pb-8 pt-12")} role="contentinfo">
            <View className="flex-row flex-wrap justify-between gap-x-16 gap-y-10">
              <View className="max-w-[300px] shrink gap-3">
                <Brand />
                <Text className="text-sm text-muted-foreground">{t("auth.footer")}</Text>
              </View>
              <View className="flex-row flex-wrap gap-x-16 gap-y-8">
                <View
                  accessibilityLabel={t("welcome.nav.label")}
                  className="items-start gap-3"
                  role="navigation"
                >
                  <Text className="font-ui text-sm">{t("welcome.footer.product")}</Text>
                  {sectionLinks}
                </View>
                <View
                  accessibilityLabel={t("welcome.footer.links")}
                  className="items-start gap-3"
                  role="navigation"
                >
                  <Text className="font-ui text-sm">{t("welcome.footer.account")}</Text>
                  <Link href="/sign-in" asChild>
                    <Text className="text-sm text-muted-foreground web:hover:text-foreground">
                      {t("welcome.signIn")}
                    </Text>
                  </Link>
                  <Link href="/sign-up" asChild>
                    <Text className="text-sm text-muted-foreground web:hover:text-foreground">
                      {t("welcome.createAccount")}
                    </Text>
                  </Link>
                </View>
              </View>
            </View>
            <Text className="border-t border-border pt-6 text-xs text-muted-foreground">
              {t("welcome.footer.rights", { year })}
            </Text>
          </View>
        </SafeAreaView>
      </ScrollView>
    </SafeAreaView>
  );
}
