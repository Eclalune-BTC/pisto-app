import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { CreditCard, LockKeyhole, LogOut, ShieldCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { AppearanceControl } from "@/components/appearance-control";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { useSignOut } from "@/hooks/use-sign-out";
import { formatLocalizedDate } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { api } from "@/lib/api-client";

export default function SettingsScreen() {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const router = useRouter();
  const profile = useQuery({ queryFn: api.me, queryKey: ["account", "me"] });
  const profileUnavailable = profile.isError || profile.fetchStatus === "paused";
  const currentProfile = profileUnavailable ? undefined : profile.data;
  const user = currentProfile?.user;
  const checkingProfile = profile.isPending && !profileUnavailable;
  const signOutAction = useSignOut();

  return (
    <Page>
      <ScreenHeader
        description={t("settings.description")}
        eyebrow={t("settings.eyebrow")}
        title={t("settings.title")}
      />

      <View className="gap-9 lg:flex-row lg:items-start lg:gap-12">
        <View className="gap-8 lg:w-[38%]">
          {user ? (
            <View className="gap-5 border-y border-line py-6 dark:border-[#304239] sm:flex-row sm:items-center">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-accent">
                <Text className="text-xl font-black text-ink">
                  {user.name.slice(0, 1).toUpperCase() || "P"}
                </Text>
              </View>
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-xl font-black text-foreground">
                  {user.name || t("common.pistoAccount")}
                </Text>
                <Text className="text-sm text-muted-foreground">{user.email}</Text>
              </View>
              <Badge tone={user.emailVerified ? "positive" : "warning"}>
                {user.emailVerified ? t("settings.verifiedEmail") : t("settings.unverifiedEmail")}
              </Badge>
            </View>
          ) : checkingProfile ? (
            <Text accessibilityLiveRegion="polite" className="py-6 text-muted-foreground">
              {t("settings.loadingAccount")}
            </Text>
          ) : (
            <View className="gap-3">
              <Alert>{t("settings.profileUnavailable")}</Alert>
              <Button
                label={t("common.retry")}
                loading={profile.isFetching}
                onPress={() => profile.refetch()}
                variant="secondary"
              />
            </View>
          )}

          <View className="gap-5">
            <View className="gap-0.5">
              <Heading level={2} size="section">
                {t("settings.appearance")}
              </Heading>
              <Text className="text-sm text-muted-foreground">
                {t("settings.appearanceDescription")}
              </Text>
            </View>
            <AppearanceControl />
          </View>
        </View>

        <View className="min-w-0 flex-1 gap-8">
          <View className="gap-6 border-y border-line py-6 dark:border-[#304239]">
            <View className="flex-row items-start gap-3">
              <ShieldCheck color="#237A55" size={23} />
              <View className="min-w-0 flex-1 gap-1">
                <Heading level={2} size="section">
                  {t("settings.security")}
                </Heading>
                <Text className="text-sm leading-5 text-muted-foreground">
                  {t("settings.securityDescription")}
                </Text>
              </View>
            </View>
            <View className="gap-3 border-t border-line pt-5 dark:border-[#304239] sm:flex-row sm:items-center">
              <View className="flex-row items-center gap-3 sm:min-w-0 sm:flex-1">
                <LockKeyhole color="#617168" size={20} />
                <View className="min-w-0 flex-1">
                  <Text className="font-bold text-foreground">{t("settings.currentSession")}</Text>
                  <Text className="text-sm text-muted-foreground">
                    {currentProfile
                      ? t("settings.expires", {
                          date: formatLocalizedDate(currentProfile.session.expiresAt, locale),
                        })
                      : checkingProfile
                        ? t("settings.checkingSession")
                        : t("session.checkFailedDescription")}
                  </Text>
                </View>
              </View>
              <Badge tone={currentProfile ? "positive" : checkingProfile ? "neutral" : "warning"}>
                {checkingProfile
                  ? t("settings.checking")
                  : currentProfile
                    ? t("settings.active")
                    : t("settings.unconfirmed")}
              </Badge>
            </View>

            <View className="gap-4 border-t border-line pt-5 dark:border-[#304239] sm:flex-row sm:items-start">
              <View className="flex-row items-start gap-3 sm:min-w-0 sm:flex-1">
                <CreditCard color="#617168" size={20} />
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="font-bold text-foreground">{t("settings.billing")}</Text>
                  <Text className="text-sm leading-5 text-muted-foreground">
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
              <Heading level={2} size="section">
                {t("common.signOut")}
              </Heading>
              <Text className="text-sm text-muted-foreground">
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
