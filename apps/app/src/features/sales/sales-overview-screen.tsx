import type { BusinessPermission, SaleStatusFilter } from "@pisto/contracts";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link, Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/layout/page-header";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { queryHasStaleData } from "@/lib/query-state";
import { previousMonthSummaryQueryOptions, salesInfiniteOptions } from "./queries";
import { SalesRouteState } from "./route-state";
import { SalesHistory } from "./sales-history";
import { SalesSummary } from "./sales-summary";
import { parseSaleStatusFilter, readState, salesHistoryState } from "./state";

export default function SalesOverviewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  // The filter lives in the URL so returning from a sale restores the same history.
  const params = useLocalSearchParams<{ status?: string | string[] }>();
  const filter = parseSaleStatusFilter(params.status);
  const businesses = useQuery(businessesQueryOptions);
  const access = readState([businesses]);
  const business = access === "denied" ? undefined : getActiveBusiness(businesses.data);
  const can = (permission: BusinessPermission) =>
    business?.access.permissions.includes(permission) ?? false;
  const canSummarize = can("sales:summary:read");
  const canRead = can("sales:read");
  const summary = useQuery(
    previousMonthSummaryQueryOptions(canSummarize ? business?.id : undefined),
  );
  const sales = useInfiniteQuery(salesInfiniteOptions(canRead ? business?.id : undefined, filter));

  if (access === "denied" || (business && !canRead && !canSummarize)) {
    return (
      <SalesRouteState
        description={t("sales.deniedDescription")}
        kind="denied"
        title={t("sales.deniedTitle")}
        width="content"
      />
    );
  }
  if (access === "offline") return <SalesRouteState kind="offline" width="content" />;
  if (access === "loading") {
    return (
      <SalesRouteState kind="loading" label={t("sales.loading")} variant="list" width="content" />
    );
  }
  if (access === "error") {
    return (
      <SalesRouteState
        description={t("sales.unavailableDescription")}
        kind="error"
        onRetry={() => void businesses.refetch()}
        title={t("sales.unavailableTitle")}
        width="content"
      />
    );
  }
  if (!business) return <Redirect href="/business" />;

  const accessStale = queryHasStaleData(businesses);
  const history = salesHistoryState({
    accessStale,
    canCorrect: can("sales:correct"),
    canRead,
    query: sales,
  });
  const staleReads = [
    ...(accessStale ? [businesses] : []),
    ...(canSummarize && queryHasStaleData(summary) ? [summary] : []),
    ...(canRead && queryHasStaleData(sales) ? [sales] : []),
  ];
  const changeFilter = (next: SaleStatusFilter) =>
    router.setParams({ status: next === "all" ? undefined : next });

  return (
    <Page>
      <PageHeader
        actions={
          can("sales:create") ? (
            <Link asChild href="/operate/sales/new">
              <Button accessibilityRole="link">
                <Icon as={Plus} className="text-primary-foreground" size={16} />
                <Text>{t("sales.register")}</Text>
              </Button>
            </Link>
          ) : undefined
        }
        description={t("sales.headerDescription", { business: business.name })}
        title={t("common.sales")}
      />
      {staleReads.length ? (
        <StaleNotice
          loading={staleReads.some(({ isFetching }) => isFetching)}
          onRetry={() => {
            for (const read of staleReads) void read.refetch();
          }}
        />
      ) : null}
      {canSummarize ? (
        <SalesSummary
          onRetry={() => void summary.refetch()}
          read={readState([summary])}
          summary={summary.data?.summary}
        />
      ) : null}
      <SalesHistory
        canCreate={can("sales:create")}
        filter={filter}
        onCorrect={(saleId) =>
          router.push({ pathname: "/operate/sales/correct/[saleId]", params: { saleId } })
        }
        onFilterChange={changeFilter}
        onLoadMore={() => void sales.fetchNextPage()}
        onRetry={() => void sales.refetch()}
        state={history}
        timeZone={business.timeZone}
      />
    </Page>
  );
}
