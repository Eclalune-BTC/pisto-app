import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  CreditCard,
  Laptop,
  LockKeyhole,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Uniwind, useUniwind } from "uniwind";

import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonText } from "@/components/ui/button";
import { useSignOut } from "@/hooks/use-sign-out";
import { formatLocalizedDate } from "@/i18n/format";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

type ThemeChoice = "light" | "dark" | "system";

const themeChoices = [
  { icon: Sun, labelKey: "settings.themes.light", value: "light" },
  { icon: Moon, labelKey: "settings.themes.dark", value: "dark" },
  { icon: Laptop, labelKey: "settings.themes.system", value: "system" },
] as const;

export default function SettingsScreen() {
  const { i18n, t } = useTranslation();
  const locale = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
  const router = useRouter();
  const { data: authSession } = authClient.useSession();
  const profile = useQuery({ queryFn: api.me, queryKey: ["account", "me"] });
  const { hasAdaptiveThemes, theme } = useUniwind();
  const activeTheme: ThemeChoice = hasAdaptiveThemes
    ? "system"
    : theme === "dark"
      ? "dark"
      : "light";
  const user = profile.data?.user ?? authSession?.user;
  const signOutAction = useSignOut();

  const selectTheme = (choice: ThemeChoice) => {
    Uniwind.setTheme(choice);
  };

  return (
    <Page>
      <ScreenHeader
        description={t("settings.description")}
        eyebrow={t("settings.eyebrow")}
        title={t("settings.title")}
      />

      <View className="gap-9 lg:flex-row lg:items-start lg:gap-12">
        <View className="gap-8 lg:w-[38%]">
          <View className="gap-5 border-y border-line py-6 dark:border-[#304239] sm:flex-row sm:items-center">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-accent">
              <Text className="text-xl font-black text-ink">
                {user?.name?.slice(0, 1).toUpperCase() || "P"}
              </Text>
            </View>
            <View className="min-w-0 flex-1 gap-1">
              <Text className="text-xl font-black text-ink dark:text-white">
                {user?.name || t("common.pistoAccount")}
              </Text>
              <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
                {user?.email || t("settings.loadingAccount")}
              </Text>
            </View>
            <Badge tone={user?.emailVerified ? "positive" : "warning"}>
              {user?.emailVerified ? t("settings.verifiedEmail") : t("settings.unverifiedEmail")}
            </Badge>
          </View>

          <View className="gap-5">
            <View className="gap-0.5">
              <Text className="text-lg font-bold text-ink dark:text-white">
                {t("settings.appearance")}
              </Text>
              <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
                {t("settings.appearanceDescription")}
              </Text>
            </View>
            <View className="flex-row border border-line bg-[#EFF3EF] p-1 dark:border-[#304239] dark:bg-[#14241D]">
              {themeChoices.map((choice) => {
                const Icon = choice.icon;
                const selected = activeTheme === choice.value;
                return (
                  <Button
                    key={choice.value}
                    accessibilityState={{ selected }}
                    className={cn(
                      "min-h-12 flex-1 gap-1 rounded-lg px-2",
                      selected ? "bg-white dark:bg-[#2A4036]" : "bg-transparent",
                    )}
                    onPress={() => selectTheme(choice.value)}
                    variant="ghost"
                  >
                    <Icon color={selected ? "#237A55" : "#7B8A82"} size={17} />
                    <Text
                      className={cn(
                        "text-xs font-bold",
                        selected ? "text-ink dark:text-white" : "text-[#7B8A82]",
                      )}
                    >
                      {t(choice.labelKey)}
                    </Text>
                  </Button>
                );
              })}
            </View>
          </View>
        </View>

        <View className="min-w-0 flex-1 gap-8">
          <View className="gap-6 border-y border-line py-6 dark:border-[#304239]">
            <View className="flex-row items-start gap-3">
              <ShieldCheck color="#237A55" size={23} />
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-lg font-bold text-ink dark:text-white">
                  {t("settings.security")}
                </Text>
                <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
                  {t("settings.securityDescription")}
                </Text>
              </View>
            </View>
            <View className="gap-3 border-t border-line pt-5 dark:border-[#304239] sm:flex-row sm:items-center">
              <View className="flex-row items-center gap-3 sm:min-w-0 sm:flex-1">
                <LockKeyhole color="#617168" size={20} />
                <View className="min-w-0 flex-1">
                  <Text className="font-bold text-ink dark:text-white">
                    {t("settings.currentSession")}
                  </Text>
                  <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
                    {profile.data?.session.expiresAt
                      ? t("settings.expires", {
                          date: formatLocalizedDate(profile.data.session.expiresAt, locale),
                        })
                      : t("settings.checkingSession")}
                  </Text>
                </View>
              </View>
              <Badge tone={profile.isError ? "warning" : "positive"}>
                {profile.isPending
                  ? t("settings.checking")
                  : profile.isError
                    ? t("settings.unconfirmed")
                    : t("settings.active")}
              </Badge>
            </View>

            <View className="gap-4 border-t border-line pt-5 dark:border-[#304239] sm:flex-row sm:items-start">
              <View className="flex-row items-start gap-3 sm:min-w-0 sm:flex-1">
                <CreditCard color="#617168" size={20} />
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="font-bold text-ink dark:text-white">
                    {t("settings.billing")}
                  </Text>
                  <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
                    {t("settings.billingDescription")}
                  </Text>
                </View>
              </View>
              <Button
                className="self-start"
                label={t("settings.view")}
                onPress={() => router.push("/billing")}
                size="sm"
                variant="secondary"
              />
            </View>
          </View>

          <View className="gap-4 border-t border-[#F0CDCD] pt-6 dark:border-[#603939]">
            <View className="gap-1">
              <Text className="text-lg font-bold text-ink dark:text-white">
                {t("common.signOut")}
              </Text>
              <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
                {t("settings.signOutDescription")}
              </Text>
            </View>
            {signOutAction.error ? (
              <Text className="text-sm leading-5 text-danger dark:text-[#FFBABA]">
                {signOutAction.error}
              </Text>
            ) : null}
            <Button
              className="self-start"
              loading={signOutAction.isPending}
              onPress={signOutAction.signOut}
              variant="danger"
            >
              <LogOut color="#FFFFFF" size={17} />
              <ButtonText variant="danger">{t("common.signOut")}</ButtonText>
            </Button>
          </View>
        </View>
      </View>
    </Page>
  );
}
