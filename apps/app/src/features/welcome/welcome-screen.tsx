import { Link } from "expo-router";
import Head from "expo-router/head";
import { ArrowDownRight, ArrowUpRight, Play } from "lucide-react-native";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppearanceControl } from "@/components/appearance-control";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import coffeeCounter from "../../../assets/welcome/coffee-counter.jpg";
import { DictationExample } from "./dictation-example";
import { SectionHeading } from "./fragments";
import { HeaderMenu } from "./header-menu";
import { HowItWorks } from "./how-it-works";
import { ModulePreviews } from "./module-previews";
import { RolesAndTrust } from "./roles-section";

/** The one content width every band of the page shares. */
const CONTAINER = "mx-auto w-full max-w-[1240px] px-5 sm:px-8";

/** The space above and below a band's content: every band keeps the same rhythm. */
const BAND = "py-12 sm:py-16 lg:py-20";

const SECTIONS = ["how", "modules", "roles"] as const;
type SectionId = (typeof SECTIONS)[number];

const LINK_TEXT = "font-sans text-sm text-muted-foreground web:group-hover:text-foreground";

function focusHashHeading() {
  const section = SECTIONS.find((id) => window.location.hash === `#${id}`);
  if (!section) return;
  const heading = document.getElementById(section);
  heading?.focus({ preventScroll: true });
  heading?.scrollIntoView({ block: "start" });
}

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef<Partial<Record<SectionId, number>>>({});
  const [play, setPlay] = useState(0);
  const sampleOffset = useRef(0);
  const [scrolled, setScrolled] = useState(false);
  const year = useMemo(() => new Date().getFullYear(), []);

  useEffect(() => {
    // Expo Router may remount the page when the browser moves between two fragments.
    if (Platform.OS !== "web" || !window.location.hash) return;
    const frame = requestAnimationFrame(focusHashHeading);
    return () => cancelAnimationFrame(frame);
  }, []);

  const scrollTo = (section: SectionId) => {
    if (Platform.OS === "web") {
      window.location.hash = section;
      focusHashHeading();
      return;
    }
    scroll.current?.scrollTo({ y: offsets.current[section] ?? 0, animated: true });
  };
  const sectionLink = (id: SectionId) =>
    Platform.OS === "web" ? { href: `#${id}` } : { onPress: () => scrollTo(id) };
  const sectionLabels: Record<SectionId, string> = {
    how: t("welcome.how.title"),
    modules: t("welcome.nav.modules"),
    roles: t("welcome.nav.roles"),
  };
  const sectionLinks = SECTIONS.map((section) => (
    <Button
      {...sectionLink(section)}
      accessibilityRole="link"
      className="min-h-0 justify-start rounded-none px-0 py-0 active:bg-transparent web:hover:bg-transparent"
      key={section}
      variant="ghost"
    >
      <Text className={LINK_TEXT}>{sectionLabels[section]}</Text>
    </Button>
  ));

  const section = (id: SectionId, children: ReactNode) => (
    <View
      aria-labelledby={id}
      className="border-t border-border"
      onLayout={(event) => {
        offsets.current[id] = event.nativeEvent.layout.y;
      }}
      role="region"
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
          <View className="relative overflow-hidden bg-brand">
            <View className={CONTAINER}>
              <View className="items-start gap-5 py-8 sm:gap-6 sm:py-12 lg:min-h-[384px] lg:w-[47%] lg:justify-center lg:py-14 xl:min-h-[446px]">
                <Heading
                  className="pisto-headline-in font-heading text-display leading-[46px] tracking-[-2px] text-white sm:text-display-xl sm:leading-[66px] xl:text-display-xxl xl:leading-[80px]"
                  size="display"
                >
                  {t("welcome.title")}
                </Heading>
                <Text className="pisto-caption-in max-w-[385px] text-base leading-6 text-white/85 sm:text-lg">
                  {t("welcome.description")}
                </Text>
                <View className="flex-row flex-wrap items-center gap-x-5 gap-y-2">
                  <Link href="/sign-up" asChild>
                    <Button
                      accessibilityRole="link"
                      className="bg-highlight web:hover:bg-highlight-strong"
                      size="lg"
                    >
                      <Text className="font-ui text-base text-highlight-foreground">
                        {t("welcome.createAccount")}
                      </Text>
                      <Icon as={ArrowUpRight} className="text-highlight-foreground" size={17} />
                    </Button>
                  </Link>
                  <Button
                    {...sectionLink("how")}
                    accessibilityRole="link"
                    className="gap-1.5 px-0 active:bg-transparent web:hover:bg-transparent"
                    variant="ghost"
                  >
                    <Text className="font-ui text-dense text-white web:group-hover:underline">
                      {t("welcome.howLink")}
                    </Text>
                    <Icon as={ArrowDownRight} className="text-white" size={16} />
                  </Button>
                </View>
              </View>
            </View>
            <View className="relative h-[172px] w-full overflow-hidden sm:h-[238px] lg:absolute lg:inset-y-0 lg:right-0 lg:h-full lg:w-1/2">
              <Image
                accessible={false}
                className="pisto-photo-in"
                resizeMode="cover"
                source={coffeeCounter}
                style={{ width: "100%", height: "100%" }}
              />
              <View className="absolute bottom-4 left-5 sm:bottom-6 sm:left-8">
                <Button
                  className="min-h-10 flex-row gap-2 bg-background px-4 web:hover:bg-muted"
                  onPress={() => {
                    setPlay((n) => n + 1);
                    if (Platform.OS === "web") {
                      requestAnimationFrame(() => {
                        const sample = document.getElementById("example-sale");
                        sample?.focus({ preventScroll: true });
                        sample?.scrollIntoView({ block: "nearest" });
                      });
                    } else {
                      scroll.current?.scrollTo({ y: sampleOffset.current, animated: true });
                    }
                  }}
                  size="sm"
                >
                  <Icon as={Play} className="text-foreground" size={14} />
                  <Text className="font-ui text-sm text-foreground">
                    {t("welcome.example.play")}
                  </Text>
                </Button>
              </View>
            </View>
          </View>
          <View
            className={cn(CONTAINER, "py-6 sm:py-8 lg:py-9")}
            onLayout={(e) => {
              sampleOffset.current = e.nativeEvent.layout.y;
            }}
          >
            <DictationExample key={play} showSource={play > 0} />
          </View>
          {section("how", <HowItWorks />)}

          {section(
            "modules",
            <View className="gap-7 lg:gap-9">
              <SectionHeading
                description={t("welcome.modules.description")}
                id="modules"
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
                  id="roles"
                  title={t("welcome.roles.title")}
                />
              }
            />,
          )}

          <View className="border-t border-border">
            <View
              className={cn(
                CONTAINER,
                BAND,
                "items-start gap-5 md:flex-row md:items-center md:justify-between",
              )}
            >
              <Heading level={2} size="display">
                {t("welcome.cta.title")}
              </Heading>
              <Link href="/sign-up" asChild>
                <Button label={t("welcome.createAccount")} size="lg" />
              </Link>
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
