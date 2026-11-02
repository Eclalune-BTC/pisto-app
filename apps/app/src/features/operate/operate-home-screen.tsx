import type { BusinessPermission, MoneyTrendRange, Sale } from "@pisto/contracts";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { type Href, Link, Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeftRight, ReceiptText, TriangleAlert } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { RouteState } from "@/components/route-state";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { AssistantComposer } from "@/features/assistant/assistant-composer";
import { MovementRow, movementFormat } from "@/features/movements/movement-row";
import {
  debtorsQueryOptions,
  moneyTrendQueryOptions,
  movementsInfiniteOptions,
} from "@/features/movements/queries";
import { payablesSummaryQueryOptions } from "@/features/purchases/queries";
import { receivablesSummaryQueryOptions } from "@/features/receivables/queries";
import { salesInfiniteOptions } from "@/features/sales/queries";
import { SaleStatusBadge, saleAmount } from "@/features/sales/sale-facts";
import { formatLocalDateFull, formatLocalizedDateTime } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { currentLocalDateTime } from "@/lib/money";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { hasDeniedRead, queryHasStaleData } from "@/lib/query-state";
import { useMeasuredWidth } from "@/lib/use-measured-width";
import { DebtorsCard } from "./debtors-card";
import { MONEY_TREND_RANGES, MoneyCard } from "./money-card";
import { PayablesCard } from "./payables-card";

const RECENT_SALES = 6;
const TODAY_MOVEMENTS = 6;
/** Below this content width the home stacks into one column with the lime hero card. */
const TWO_COLUMN_MIN_WIDTH = 860;

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

function parseRange(value: string | string[] | undefined): MoneyTrendRange {
  const range = Array.isArray(value) ? value[0] : value;
  return MONEY_TREND_RANGES.find((option) => option === range) ?? "30d";
}

export default function OperateHomeScreen() {
  const { t, i18n } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const router = useRouter();
  const params = useLocalSearchParams<{ range?: string }>();
  const range = parseRange(params.range);
  const layout = useMeasuredWidth();
  const businesses = useQuery(businessesQueryOptions);
  const denied = hasDeniedRead([businesses]);
  const active = denied ? undefined : getActiveBusiness(businesses.data);
  const can = (permission: BusinessPermission) =>
    active?.access.permissions.includes(permission) ?? false;
  const today = active ? currentLocalDateTime(active.timeZone).date : undefined;
  const cashId = can("cash:read") ? active?.id : undefined;
  const receivablesId = can("receivables:read") ? active?.id : undefined;
  const trend = useQuery(moneyTrendQueryOptions(cashId, range));
  const todayMovements = useInfiniteQuery(
    movementsInfiniteOptions(
      cashId,
      today ? { startLocalDate: today, endLocalDate: today, kind: "all" } : undefined,
      TODAY_MOVEMENTS,
    ),
  );
  const summary = useQuery({
    ...receivablesSummaryQueryOptions(receivablesId),
    select: (data) => data.summary,
  });
  const debtors = useQuery(debtorsQueryOptions(receivablesId));
  const payablesId = can("purchases:read") ? active?.id : undefined;
  const payables = useQuery(payablesSummaryQueryOptions(payablesId));
  const sales = useInfiniteQuery(
    salesInfiniteOptions(can("sales:read") && !can("cash:read") ? active?.id : undefined, "all"),
  );

  const saleColumns = useMemo<DataTableColumn<Sale>[]>(
    () => [
      {
        id: "description",
        header: t("dataTable.columns.description"),
        meta: { primary: true },
        cell: ({ row: { original } }) => (
          <Text className="text-[13px]" numberOfLines={1}>
            {original.entryMode === "itemized"
              ? (original.customer?.name ?? t("sales.itemized.counterSale"))
              : (original.description ?? t("common.noDescription"))}
          </Text>
        ),
      },
      {
        id: "date",
        header: t("dataTable.columns.date"),
        cell: ({ row: { original } }) => (
          <Text className="text-[13px] text-muted-foreground tabular-nums">
            {formatLocalizedDateTime(original.occurredAt, locale, original.timeZone)}
          </Text>
        ),
      },
      {
        id: "status",
        header: t("dataTable.columns.status"),
        cell: ({ row: { original } }) => <SaleStatusBadge status={original.status} />,
      },
      {
        id: "amount",
        header: t("dataTable.columns.amount"),
        meta: { align: "end" },
        cell: ({ row: { original } }) => (
          <Text
            className={cn(
              "font-ui text-[13px] tabular-nums",
              original.status === "voided" && "text-muted-foreground line-through",
            )}
          >
            {saleAmount(original, locale)}
          </Text>
        ),
      },
    ],
    [locale, t],
  );

  if (denied) return <RouteState kind="denied" />;
  if (businesses.fetchStatus === "paused" && !businesses.data) {
    return (
      <Page>
        <OfflineState />
      </Page>
    );
  }
  if (businesses.isPending) {
    return (
      <Page>
        <ContentSkeleton label={t("operate.loading")} variant="detail" />
      </Page>
    );
  }
  if (businesses.isError && !businesses.data) {
    return (
      <Page>
        <StatePanel
          action={
            <Button
              label={t("common.retry")}
              onPress={() => businesses.refetch()}
              size="sm"
              variant="outline"
            />
          }
          description={t("operate.unavailableDescription")}
          icon={TriangleAlert}
          level={1}
          title={t("operate.unavailableTitle")}
          tone="destructive"
        />
      </Page>
    );
  }
  if (!active || !today) return <Redirect href="/business" />;

  const twoColumns = layout.width >= TWO_COLUMN_MIN_WIDTH;
  const format = movementFormat(active.currency, active.currencyMinorUnitDigits, locale);
  if (!format) throw new Error("The active business has no currency.");
  const hasAnyRead = can("cash:read") || can("sales:read") || can("receivables:read");
  const movementItems = todayMovements.data?.pages[0]?.items ?? [];
  const recentSales = sales.data?.pages[0]?.items.slice(0, RECENT_SALES) ?? [];

  const moneyCard = can("cash:read") ? (
    <MoneyCard
      canManageCash={can("cash:manage")}
      compact={!twoColumns}
      locale={locale}
      onRangeChange={(next) => router.setParams({ range: next === "30d" ? undefined : next })}
      range={range}
      receivables={receivablesId ? summary : undefined}
      trend={trend}
    />
  ) : null;

  const todayCard = can("cash:read") ? (
    <View
      accessibilityLabel={t("operate.home.today.title")}
      className="overflow-hidden rounded-xl border border-border bg-card"
      role="region"
    >
      <View className="flex-row items-center justify-between gap-2 px-4 pb-1 pt-3.5">
        <Text accessibilityRole="header" aria-level={2} className="font-heading text-[15px]">
          {t("operate.home.today.title")}
        </Text>
        <Link asChild href={{ pathname: "/operate/movements", params: { range: "today" } }}>
          <Button accessibilityRole="link" className="h-7 px-1.5" size="sm" variant="ghost">
            <Text className="text-xs text-muted-foreground">{t("operate.home.today.all")}</Text>
          </Button>
        </Link>
      </View>
      {todayMovements.isPending ? (
        <View aria-hidden className="gap-2 p-4">
          {[0, 1, 2].map((index) => (
            <Skeleton className="h-10" key={index} />
          ))}
        </View>
      ) : todayMovements.isError && !todayMovements.data ? (
        <View className="items-start gap-2 px-4 pb-4 pt-2">
          <Text className="text-[13px]">{t("operate.home.today.unavailableTitle")}</Text>
          <Text className="text-xs text-muted-foreground">
            {t("operate.home.today.unavailable")}
          </Text>
          <Button
            label={t("common.retry")}
            onPress={() => void todayMovements.refetch()}
            size="sm"
            variant="outline"
          />
        </View>
      ) : movementItems.length === 0 ? (
        <View className="items-start gap-1 px-4 pb-4 pt-2">
          <Text className="font-ui text-[13px]">{t("operate.home.today.emptyTitle")}</Text>
          <Text className="text-xs leading-4 text-muted-foreground">
            {t("operate.home.today.emptyDescription")}
          </Text>
        </View>
      ) : (
        <View role="list">
          {movementItems.map((movement, index) => (
            <View
              className={cn(index > 0 && "border-t border-border")}
              key={`${movement.kind}:${movement.recordId}`}
            >
              <MovementRow format={format} movement={movement} showAccount={twoColumns} />
            </View>
          ))}
        </View>
      )}
    </View>
  ) : null;

  const debtorsCard = receivablesId ? (
    <DebtorsCard
      canOpenCustomers={can("customers:read")}
      debtors={debtors}
      locale={locale}
      summary={summary}
    />
  ) : null;

  const payablesCard = payablesId ? <PayablesCard locale={locale} summary={payables} /> : null;

  // Sellers cannot read cash, so their home lists the sales they can see instead.
  const salesSection =
    can("sales:read") && !can("cash:read") ? (
      <Section
        actions={
          recentSales.length ? (
            <Link asChild href="/operate/sales">
              <Button accessibilityRole="link" className="gap-1 px-1" size="sm" variant="ghost">
                <Text className="text-[13px] text-link">{t("operate.home.allSales")}</Text>
              </Button>
            </Link>
          ) : undefined
        }
        title={t("operate.home.recentSales")}
      >
        {sales.isPending ? (
          <ContentSkeleton variant="section" />
        ) : sales.isError && !sales.data ? (
          <StatePanel
            action={
              <Button
                label={t("common.retry")}
                onPress={() => sales.refetch()}
                size="sm"
                variant="outline"
              />
            }
            description={t("operate.home.salesUnavailable")}
            icon={TriangleAlert}
            level={3}
            title={t("operate.home.salesUnavailableTitle")}
          />
        ) : (
          <DataTable
            caption={t("operate.home.recentSales")}
            columns={saleColumns}
            data={recentSales}
            empty={
              <EmptyState
                action={
                  can("sales:create") ? (
                    <Link asChild href="/operate/sales/new">
                      <Button accessibilityRole="link" size="sm">
                        <Text>{t("sales.register")}</Text>
                      </Button>
                    </Link>
                  ) : undefined
                }
                description={t("operate.home.noSalesDescription")}
                icon={ReceiptText}
                title={t("operate.home.noSalesTitle")}
              />
            }
            getRowHref={(sale): Href => ({
              pathname: "/operate/sales/[saleId]",
              params: { saleId: sale.id },
            })}
            getRowId={(sale) => sale.id}
          />
        )}
      </Section>
    ) : null;

  return (
    <Page>
      <PageHeader
        description={capitalize(formatLocalDateFull(today, locale))}
        title={t("operate.home.title")}
      />

      {queryHasStaleData(businesses) ? <StaleNotice onRetry={() => businesses.refetch()} /> : null}

      {!hasAnyRead ? (
        <StatePanel
          description={t("operate.noAccessDescription")}
          icon={ArrowLeftRight}
          level={2}
          title={t("operate.noAccessTitle")}
        />
      ) : null}

      <View
        className={cn("min-w-0 gap-4", twoColumns && "flex-row items-start")}
        onLayout={layout.onLayout}
      >
        <View className="min-w-0 flex-1 gap-4">
          {moneyCard}
          {twoColumns ? null : <AssistantComposer />}
          {twoColumns ? null : debtorsCard}
          {twoColumns ? null : payablesCard}
          {todayCard}
          {salesSection}
        </View>
        {twoColumns ? (
          <View className="w-[320px] shrink-0 gap-4">
            <AssistantComposer />
            {debtorsCard}
            {payablesCard}
          </View>
        ) : null}
      </View>
    </Page>
  );
}
