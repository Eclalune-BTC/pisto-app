import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { Plus, RefreshCw } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";
import { formatLocalizedDateTime, formatMonthYear } from "@/i18n/format";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { api } from "@/lib/api-client";
import { formatMinorUnits } from "@/lib/money";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";

function periodLabel(periodStartLocal: string, locale: string): string {
  const [year, month] = periodStartLocal.split("-");
  if (!year || !month) return periodStartLocal;
  return formatMonthYear(new Date(Date.UTC(Number(year), Number(month) - 1, 15)), locale);
}

export default function SalesOverviewScreen() {
  const { i18n, t } = useTranslation();
  const locale = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
  const router = useRouter();
  const businesses = useQuery(businessesQueryOptions);
  const activeBusiness = getActiveBusiness(businesses.data);
  const summary = useQuery({
    enabled: Boolean(activeBusiness),
    queryFn: api.sales.previousMonthSummary,
    queryKey: ["sales", "summary", "previous-month", activeBusiness?.id],
  });

  if (businesses.fetchStatus === "paused" && !businesses.data) return <OfflineState />;

  if (businesses.isPending) {
    return (
      <View className="flex-1 items-start justify-center gap-3 px-5 sm:px-8 lg:px-10">
        <ActivityIndicator color="#237A55" size="large" />
        <Text className="text-sm font-semibold text-ink-muted dark:text-[#AAB8B0]">
          {t("sales.loading")}
        </Text>
      </View>
    );
  }

  if (businesses.isError && !businesses.data) {
    return (
      <View className="flex-1 items-start justify-center gap-4 px-5 sm:px-8 lg:px-10">
        <Text className="text-xl font-black text-ink dark:text-white">
          {t("sales.unavailableTitle")}
        </Text>
        <Text className="max-w-[460px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
          {t("sales.unavailableDescription")}
        </Text>
        <Button
          label={t("common.retry")}
          onPress={() => businesses.refetch()}
          variant="secondary"
        />
      </View>
    );
  }

  if (!activeBusiness) return <Redirect href="/business" />;

  return (
    <Page contentContainerClassName="gap-9">
      <ScreenHeader
        action={
          <Button onPress={() => router.push("/operate/sales/new")} variant="accent">
            <Plus color="#14241D" size={18} strokeWidth={2.6} />
            <ButtonText variant="accent">{t("sales.register")}</ButtonText>
          </Button>
        }
        description={t("sales.headerDescription", { business: activeBusiness.name })}
        eyebrow={t("common.operate")}
        title={t("common.sales")}
      />

      {businesses.isError && businesses.data ? <StaleNotice /> : null}

      {summary.fetchStatus === "paused" && !summary.data ? (
        <View className="min-h-56">
          <OfflineState title={t("sales.staleTitle")} />
        </View>
      ) : summary.isPending ? (
        <View className="min-h-56 items-start justify-center gap-3 border-y border-line dark:border-[#304239]">
          <ActivityIndicator color="#237A55" />
          <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
            {t("sales.calculating")}
          </Text>
        </View>
      ) : summary.isError && !summary.data ? (
        <View className="gap-4 border-l-4 border-danger bg-[#FFF1F1] p-5 dark:bg-[#3A2020]">
          <View className="gap-1">
            <Text className="font-bold text-danger dark:text-[#FFBABA]">
              {t("sales.noSummaryTitle")}
            </Text>
            <Text className="text-sm leading-5 text-ink-muted dark:text-[#C9D4CE]">
              {t("sales.noSummaryDescription")}
            </Text>
          </View>
          <Pressable
            accessibilityLabel={t("sales.recalculate")}
            className="min-h-10 flex-row items-center gap-2 self-start"
            onPress={() => summary.refetch()}
          >
            <RefreshCw color="#B94242" size={17} />
            <Text className="font-bold text-danger dark:text-[#FFBABA]">{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : summary.data ? (
        <View className="gap-6">
          {summary.isError ? <StaleNotice /> : null}
          <View className="border-y border-line dark:border-[#304239] lg:flex-row">
            <View className="gap-2 py-7 lg:w-[58%] lg:pr-10">
              <Text className="text-sm font-bold capitalize text-positive dark:text-[#8DDEAF]">
                {periodLabel(summary.data.summary.periodStartLocal, locale)}
              </Text>
              <Text className="text-[38px] font-black leading-[44px] tracking-[-1.6px] text-ink dark:text-white sm:text-[48px] sm:leading-[54px]">
                {formatMinorUnits(
                  summary.data.summary.grossMinorUnits,
                  summary.data.summary.currency,
                  summary.data.summary.currencyMinorUnitDigits,
                  locale,
                )}
              </Text>
              <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
                {t("sales.grossRevenue")}
              </Text>
            </View>

            <View className="border-t border-line dark:border-[#304239] sm:flex-row lg:min-w-0 lg:flex-1 lg:border-l lg:border-t-0 lg:pl-10">
              <View className="flex-1 gap-1 py-5 sm:border-r sm:border-line sm:pr-6 lg:py-7 dark:sm:border-[#304239]">
                <Text className="text-xs font-bold uppercase tracking-[1px] text-ink-muted dark:text-[#91A198]">
                  {t("sales.count")}
                </Text>
                <Text className="text-2xl font-black text-ink dark:text-white">
                  {summary.data.summary.saleCount}
                </Text>
              </View>
              <View className="flex-1 gap-1 border-t border-line py-5 sm:border-t-0 sm:pl-6 lg:py-7 dark:border-[#304239]">
                <Text className="text-xs font-bold uppercase tracking-[1px] text-ink-muted dark:text-[#91A198]">
                  {t("sales.average")}
                </Text>
                <Text className="text-2xl font-black text-ink dark:text-white">
                  {summary.data.summary.averageMinorUnits === null
                    ? "—"
                    : formatMinorUnits(
                        summary.data.summary.averageMinorUnits,
                        summary.data.summary.currency,
                        summary.data.summary.currencyMinorUnitDigits,
                        locale,
                      )}
                </Text>
              </View>
            </View>
          </View>

          {summary.data.summary.saleCount === "0" ? (
            <Text className="max-w-[620px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
              {t("sales.empty")}
            </Text>
          ) : null}
          <View className="gap-2 lg:flex-row lg:justify-between lg:gap-8">
            <Text className="text-xs leading-5 text-ink-muted dark:text-[#91A198]">
              {t("sales.period", {
                start: summary.data.summary.periodStartLocal,
                end: summary.data.summary.periodEndLocalExclusive,
                timeZone: summary.data.summary.timeZone,
                currency: summary.data.summary.currency,
              })}
            </Text>
            <Text className="text-xs leading-5 text-ink-muted dark:text-[#91A198] lg:text-right">
              {t("sales.calculatedAt", {
                date: formatLocalizedDateTime(
                  summary.data.summary.queriedAt,
                  locale,
                  summary.data.summary.timeZone,
                ),
              })}
            </Text>
          </View>
        </View>
      ) : null}
    </Page>
  );
}
