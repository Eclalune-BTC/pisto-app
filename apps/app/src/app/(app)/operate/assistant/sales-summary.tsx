import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/layout/page-header";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { RouteState } from "@/components/route-state";
import { Text } from "@/components/ui/text";
import { previousMonthSummaryQueryOptions } from "@/features/sales/queries";
import { SalesSummary } from "@/features/sales/sales-summary";
import { readState } from "@/features/sales/state";
import { formatLocalizedDate } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { queryHasStaleData } from "@/lib/query-state";

export default function AssistantSalesSummaryRoute() {
  const { t, i18n } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const businesses = useQuery(businessesQueryOptions);
  const access = readState([businesses]);
  const business = getActiveBusiness(businesses.data);
  const permitted =
    business?.access.permissions.includes("assistant:use") &&
    business.access.permissions.includes("sales:summary:read");
  const result = useQuery(
    previousMonthSummaryQueryOptions(access === "ready" && permitted ? business?.id : undefined),
  );
  if (access === "denied" || (business && !permitted))
    return (
      <RouteState
        kind="denied"
        title={t("sales.summary.deniedTitle")}
        description={t("sales.summary.deniedDescription")}
      />
    );
  if (access === "offline" || access === "loading" || access === "error")
    return <RouteState kind={access} onRetry={() => void businesses.refetch()} />;
  if (!business) return <Redirect href="/business" />;
  const read = readState([result]);
  const summary = read === "ready" ? result.data?.summary : undefined;
  return (
    <Page>
      <PageHeader title={t("assistant.questions.sales")} />
      {read === "ready" && (queryHasStaleData(result) || queryHasStaleData(businesses)) ? (
        <StaleNotice
          onRetry={() => {
            void businesses.refetch();
            void result.refetch();
          }}
        />
      ) : null}
      <SalesSummary onRetry={() => void result.refetch()} read={read} summary={summary} />
      {summary ? (
        <>
          <Text className="text-sm text-muted-foreground">
            {t("assistant.questions.period", {
              start: formatLocalizedDate(summary.periodStartUtc, locale, summary.timeZone),
              end: formatLocalizedDate(
                new Date(Date.parse(summary.periodEndUtcExclusive) - 1),
                locale,
                summary.timeZone,
              ),
              zone: summary.timeZone,
              currency: summary.currency,
            })}
          </Text>
          {summary.saleCount === "0" ? <Text>{t("assistant.questions.empty")}</Text> : null}
          <Text>{t("assistant.questions.gross")}</Text>
        </>
      ) : null}
    </Page>
  );
}
