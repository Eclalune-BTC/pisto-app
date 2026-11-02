import type { BusinessPermission, OperatingReport, Sale } from "@pisto/contracts";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { type Href, Link, Redirect } from "expo-router";
import { Plus, ReceiptText, TriangleAlert } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Stat, StatGroup } from "@/components/layout/stat-group";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { RouteState } from "@/components/route-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { currentBusinessMonthRange } from "@/features/reports/date-range";
import { operatingReportQueryOptions } from "@/features/reports/queries";
import { salesInfiniteOptions } from "@/features/sales/queries";
import { SaleStatusBadge, saleAmount } from "@/features/sales/sale-facts";
import { formatLocalDate, formatLocalizedDateTime, formatMonthYear } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { formatMinorUnits } from "@/lib/money";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { hasDeniedRead, queryHasStaleData } from "@/lib/query-state";

const RECENT_SALES = 6;

function ReportStats({ locale, report }: { locale: string; report: OperatingReport }) {
  const { t } = useTranslation();
  const money = (minorUnits: string) =>
    formatMinorUnits(minorUnits, report.currency, report.currencyMinorUnitDigits, locale);
  const overdue = report.receivables.overdueMinorUnits !== "0";
  return (
    <StatGroup>
      <Stat
        detail={t("operate.home.saleCount", { count: Number(report.sales.saleCount) })}
        label={t("operate.home.sales")}
        value={money(report.sales.grossMinorUnits)}
      />
      <Stat
        detail={t("operate.home.expenseCount", { count: Number(report.expenses.expenseCount) })}
        label={t("operate.home.expenses")}
        value={money(report.expenses.totalMinorUnits)}
      />
      <Stat
        detail={t("operate.home.cashFlow", {
          inflow: money(report.cash.inflowMinorUnits),
          outflow: money(report.cash.outflowMinorUnits),
        })}
        label={t("operate.home.netCash")}
        value={money(report.cash.netMovementMinorUnits)}
      />
      <Stat
        detail={
          overdue ? (
            <Text className="text-xs leading-4 text-warning-foreground">
              {t("operate.home.overdue", { amount: money(report.receivables.overdueMinorUnits) })}
            </Text>
          ) : (
            t("operate.home.openReceivables", {
              count: Number(report.receivables.openReceivableCount),
            })
          )
        }
        label={t("operate.home.receivables")}
        value={money(report.receivables.outstandingMinorUnits)}
      />
    </StatGroup>
  );
}

export default function OperateHomeScreen() {
  const { t, i18n } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const businesses = useQuery(businessesQueryOptions);
  const denied = hasDeniedRead([businesses]);
  const active = denied ? undefined : getActiveBusiness(businesses.data);
  const can = (permission: BusinessPermission) =>
    active?.access.permissions.includes(permission) ?? false;
  const range = active ? currentBusinessMonthRange(active.timeZone) : undefined;
  const report = useQuery(
    operatingReportQueryOptions(can("reports:read") ? active?.id : undefined, {
      startLocalDate: range?.startLocalDate ?? "",
      endLocalDate: range?.endLocalDate ?? "",
    }),
  );
  const sales = useInfiniteQuery(
    salesInfiniteOptions(can("sales:read") ? active?.id : undefined, "all"),
  );

  const saleColumns = useMemo<DataTableColumn<Sale>[]>(
    () => [
      {
        id: "description",
        header: t("dataTable.columns.description"),
        meta: { primary: true },
        cell: ({ row: { original } }) => (
          <Text className="text-[13px]" numberOfLines={1}>
            {original.description ?? t("common.noDescription")}
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
  if (!active || !range) return <Redirect href="/business" />;

  const operating = report.data?.report;
  const recentSales = sales.data?.pages[0]?.items.slice(0, RECENT_SALES) ?? [];
  const lowStock =
    can("inventory:read") && operating ? Number(operating.inventory.lowStockProductCount) : 0;
  const hasAnyRead = can("reports:read") || can("sales:read");

  return (
    <Page>
      <PageHeader
        actions={
          <>
            {can("expenses:manage") ? (
              <Link asChild href="/operate/expenses/new">
                <Button accessibilityRole="link" variant="outline">
                  <Text>{t("operate.home.newExpense")}</Text>
                </Button>
              </Link>
            ) : null}
            {can("sales:create") ? (
              <Link asChild href="/operate/sales/new">
                <Button accessibilityRole="link">
                  <Icon as={Plus} className="text-primary-foreground" size={16} />
                  <Text>{t("sales.register")}</Text>
                </Button>
              </Link>
            ) : null}
          </>
        }
        description={t("operate.home.description", {
          month: formatMonthYear(range.endLocalDate, locale),
          currency: active.currency,
        })}
        title={t("operate.home.title")}
      />

      {queryHasStaleData(businesses) ? <StaleNotice onRetry={() => businesses.refetch()} /> : null}

      {!hasAnyRead ? (
        <StatePanel
          description={t("operate.noAccessDescription")}
          icon={TriangleAlert}
          level={2}
          title={t("operate.noAccessTitle")}
        />
      ) : null}

      {can("reports:read") ? (
        <View className="gap-2">
          {operating ? (
            <ReportStats locale={locale} report={operating} />
          ) : report.isError ? (
            <StatePanel
              action={
                <Button
                  label={t("common.retry")}
                  onPress={() => report.refetch()}
                  size="sm"
                  variant="outline"
                />
              }
              description={t("operate.home.reportUnavailable")}
              icon={TriangleAlert}
              level={2}
              title={t("operate.home.reportUnavailableTitle")}
            />
          ) : (
            <View className="flex-row flex-wrap gap-px overflow-hidden rounded-lg border border-border bg-border">
              {[0, 1, 2, 3].map((index) => (
                <View
                  className="min-w-[150px] flex-1 basis-[180px] gap-2 bg-card px-4 py-3"
                  key={index}
                >
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-28" />
                  <Skeleton className="h-3 w-24" />
                </View>
              ))}
            </View>
          )}
          {operating ? (
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <Text className="text-xs text-muted-foreground">
                {t("operate.home.period", {
                  start: formatLocalDate(operating.period.startLocalDate, locale),
                  end: formatLocalDate(operating.period.endLocalDateInclusive, locale),
                  position: formatLocalDate(operating.positionAsOfLocalDate, locale),
                })}
              </Text>
              <Link asChild href="/operate/reports">
                <Button accessibilityRole="link" className="gap-1 px-1" size="sm" variant="ghost">
                  <Text className="text-[13px] text-link">{t("operate.home.fullReport")}</Text>
                </Button>
              </Link>
            </View>
          ) : null}
        </View>
      ) : null}

      {lowStock > 0 ? (
        <Alert
          action={
            <Link asChild href="/operate/inventory">
              <Button accessibilityRole="link" size="sm" variant="outline">
                <Text>{t("operate.home.viewInventory")}</Text>
              </Button>
            </Link>
          }
          icon={TriangleAlert}
          role="note"
          variant="warning"
        >
          <AlertDescription>{t("operate.home.lowStock", { count: lowStock })}</AlertDescription>
        </Alert>
      ) : null}

      {can("sales:read") ? (
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
      ) : null}
    </Page>
  );
}
