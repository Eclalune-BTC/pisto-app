import { useQuery } from "@tanstack/react-query";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { LogOut, TriangleAlert } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { AppearanceControl } from "@/components/appearance-control";
import { DescriptionList } from "@/components/layout/description-list";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsSection } from "@/components/layout/settings-section";
import { Page } from "@/components/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import { BusinessFactsCard, UsersCard } from "@/features/business/business-settings";
import { useSignOut } from "@/hooks/use-sign-out";
import { formatLocalizedDate } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { hasDeniedRead } from "@/lib/query-state";
import { firstParam } from "@/lib/route-params";

const TABS = ["business", "appearance", "account"] as const;
type SettingsTab = (typeof TABS)[number];

/**
 * Label and description on the left, the controls on the right; stacked on narrow screens. The
 * controls carry their own outline, so the sections are separated by space alone.
 */
function FactsSkeleton({ label, rows }: { label: string; rows: number }) {
  return (
    <View
      accessibilityLabel={label}
      aria-busy
      className="overflow-hidden rounded-lg border border-border bg-card"
    >
      <Text className="sr-only">{label}</Text>
      {Array.from({ length: rows }, (_, index) => (
        <View
          className={cn(
            "flex-row items-center gap-6 px-4 py-3.5",
            index > 0 && "border-t border-border",
          )}
          // biome-ignore lint/suspicious/noArrayIndexKey: Placeholder rows have no identity.
          key={index}
        >
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-40" />
        </View>
      ))}
    </View>
  );
}

function RetryAlert({
  description,
  onRetry,
  retrying,
}: {
  description: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Alert
      action={
        <Button
          label={t("common.retry")}
          loading={retrying}
          onPress={onRetry}
          size="sm"
          variant="outline"
        />
      }
      icon={TriangleAlert}
    >
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}

/** "Dólar estadounidense (USD)" where the engine can name currencies; the code alone otherwise. */
function currencyLabel(code: string, locale: string): string {
  if (typeof Intl.DisplayNames !== "function") return code;
  const name = new Intl.DisplayNames(locale, { type: "currency" }).of(code);
  if (!name || name === code) return code;
  return `${name.charAt(0).toLocaleUpperCase(locale)}${name.slice(1)} (${code})`;
}

/** "El Salvador (GMT-6)": the zone's place name and its current offset, not the raw zone ID. */
function timeZoneLabel(timeZone: string, locale: string): string {
  const place = timeZone.slice(timeZone.lastIndexOf("/") + 1).replace(/_/g, " ");
  const offset = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "short" })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value;
  return offset ? `${place} (${offset})` : place;
}

function BusinessTab({ locale }: { locale: string }) {
  const { t } = useTranslation();
  const businesses = useQuery(businessesQueryOptions);
  // A rejected read hides the cached business as well.
  if (businesses.data === undefined || hasDeniedRead([businesses])) {
    return businesses.isPending && businesses.fetchStatus !== "paused" ? (
      <FactsSkeleton label={t("settings.loadingBusiness")} rows={4} />
    ) : (
      <RetryAlert
        description={t("settings.businessUnavailable")}
        onRetry={() => void businesses.refetch()}
        retrying={businesses.isFetching}
      />
    );
  }
  const business = getActiveBusiness(businesses.data);
  if (!business) {
    return (
      <View className="items-start gap-3">
        <Text className="text-sm leading-5 text-muted-foreground">{t("settings.noBusiness")}</Text>
        <Link asChild href="/business">
          <Button accessibilityRole="link" size="sm" variant="outline">
            <Text>{t("settings.setUpBusiness")}</Text>
          </Button>
        </Link>
      </View>
    );
  }
  return (
    <View className="min-w-0 gap-3">
      <View className="min-w-0 flex-row flex-wrap items-start gap-4">
        <View className="min-w-0 shrink grow basis-[320px] lg:max-w-[440px]">
          <BusinessFactsCard
            business={business}
            currency={currencyLabel(business.currency, locale)}
            timeZone={timeZoneLabel(business.timeZone, locale)}
          />
        </View>
        <View className="min-w-0 shrink grow basis-[420px]">
          <UsersCard business={business} />
        </View>
      </View>
      {businesses.data.items.length > 1 ? (
        <Text className="text-[13px] leading-5 text-muted-foreground">
          {t("settings.businessSwitchHint")}
        </Text>
      ) : null}
    </View>
  );
}

export default function SettingsScreen() {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const requested = firstParam(useLocalSearchParams<{ tab?: string | string[] }>().tab);
  const tab: SettingsTab = TABS.find((candidate) => candidate === requested) ?? "business";
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const profile = useQuery({ queryFn: api.me, queryKey: ["account", "me"] });
  const signOut = useSignOut();
  // These are the account's current authentication facts, so a profile that could not be
  // refreshed is reported as unconfirmed instead of being shown from cache.
  const profileUnavailable = profile.isError || profile.fetchStatus === "paused";
  const current = profileUnavailable ? undefined : profile.data;
  const checking = profile.isPending && !profileUnavailable;

  let profileFacts: ReactNode;
  if (current) {
    profileFacts = (
      <DescriptionList
        items={[
          {
            label: t("settings.name"),
            value: current.user.name || (
              <Text className="text-sm leading-5 text-muted-foreground">
                {t("settings.noName")}
              </Text>
            ),
          },
          {
            label: t("settings.email"),
            value: (
              <View className="min-w-0 flex-row flex-wrap items-center gap-2">
                <Text className="min-w-0 shrink text-sm leading-5">{current.user.email}</Text>
                {current.user.emailVerified ? (
                  <StatusBadge label={t("settings.verifiedEmail")} tone="settled" />
                ) : (
                  <StatusBadge label={t("settings.unverifiedEmail")} tone="attention" />
                )}
              </View>
            ),
          },
        ]}
      />
    );
  } else if (checking) {
    profileFacts = <FactsSkeleton label={t("settings.loadingAccount")} rows={2} />;
  } else {
    profileFacts = (
      <RetryAlert
        description={t("settings.profileUnavailable")}
        onRetry={() => void profile.refetch()}
        retrying={profile.isFetching}
      />
    );
  }

  return (
    <Page>
      <PageHeader description={t("settings.description")} title={t("settings.title")} />

      <Tabs
        onValueChange={(next) => router.setParams({ tab: next === "business" ? undefined : next })}
        value={tab}
      >
        <TabsList>
          {TABS.map((value) => (
            <TabsTrigger key={value} value={value}>
              <Text>{t(`settings.tabs.${value}`)}</Text>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent className="pt-3" value="business">
          <BusinessTab locale={locale} />
        </TabsContent>
        <TabsContent className="pt-3" value="appearance">
          <SettingsSection
            description={t("settings.appearanceDescription")}
            title={t("settings.appearance")}
          >
            <AppearanceControl />
          </SettingsSection>
        </TabsContent>
        <TabsContent className="gap-8 pt-3" value="account">
          <SettingsSection
            description={t("settings.profileDescription")}
            title={t("settings.profile")}
          >
            {profileFacts}
          </SettingsSection>

          <SettingsSection
            description={t("settings.sessionDescription")}
            title={t("settings.session")}
          >
            <DescriptionList
              items={[
                {
                  label: t("common.status"),
                  value: current ? (
                    <StatusBadge label={t("settings.active")} tone="normal" />
                  ) : checking ? (
                    <StatusBadge label={t("settings.checking")} tone="normal" />
                  ) : (
                    <StatusBadge label={t("settings.unconfirmed")} tone="attention" />
                  ),
                },
                ...(current
                  ? [
                      {
                        label: t("settings.expires"),
                        numeric: true,
                        value: formatLocalizedDate(current.session.expiresAt, locale),
                      },
                    ]
                  : []),
              ]}
            />
            {/* The user menu holds the everyday sign-out; here it is a deliberate, secondary action. */}
            <View className="items-start gap-2">
              <Button
                className="border-destructive/40 active:bg-destructive-surface web:hover:bg-destructive-surface"
                loading={signOut.isPending}
                onPress={() => void signOut.signOut()}
                variant="outline"
              >
                <Icon as={LogOut} className="text-destructive" size={16} />
                <Text className="text-destructive">{t("common.signOut")}</Text>
              </Button>
              {signOut.error ? (
                <Text accessibilityRole="alert" className="text-sm leading-5 text-destructive">
                  {signOut.error}
                </Text>
              ) : null}
            </View>
          </SettingsSection>
        </TabsContent>
      </Tabs>
    </Page>
  );
}
