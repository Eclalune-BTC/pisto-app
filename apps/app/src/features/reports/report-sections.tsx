import type { OperatingReport } from "@pisto/contracts";
import { type Href, Link } from "expo-router";
import { ArrowRight, CalendarX2 } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Section } from "@/components/layout/section";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Stat, StatGroup } from "@/components/layout/stat-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Text } from "@/components/ui/text";
import { formatLocalDate, formatLocalizedDateTime } from "@/i18n/format";
import { formatMinorUnits } from "@/lib/money";
import { cashAccountKindLabels, cashAccountStatusLabels } from "../cash/copy";
import { expenseCategoryLabels } from "../expenses/copy";
import {
  type ExpenseCategoryShare,
  expenseCategoryShares,
  formatCount,
  formatShare,
  hasPeriodActivity,
} from "./report-figures";

/** Modules the role can open from the report; a figure without access stays plain text. */
export type ReportLinks = { cashAccounts: boolean; inventory: boolean; receivables: boolean };

type ReportProps = { locale: string; report: OperatingReport };

type CashAccountFacts = OperatingReport["cash"]["accounts"][number];

function useReportFormat({ locale, report }: ReportProps) {
  const { currency, currencyMinorUnitDigits } = report;
  return useMemo(
    () => ({
      /** Values for a plural key: `count` picks the form and `value` is the exact text. */
      count: (value: string) => ({ count: Number(value), value: formatCount(value, locale) }),
      money: (minorUnits: string) =>
        formatMinorUnits(minorUnits, currency, currencyMinorUnitDigits, locale),
    }),
    [currency, currencyMinorUnitDigits, locale],
  );
}

function ModuleLink({ href, label }: { href: Href; label: string }) {
  return (
    <Link asChild href={href}>
      <Button accessibilityRole="link" className="gap-1 px-1" size="sm" variant="ghost">
        <Text className="text-[13px]">{label}</Text>
        <Icon as={ArrowRight} className="text-foreground" size={14} />
      </Button>
    </Link>
  );
}

function PeriodSummary({ locale, report }: ReportProps) {
  const { t } = useTranslation();
  const format = useReportFormat({ locale, report });
  return (
    <Section
      description={t("reports.period.description", {
        end: formatLocalDate(report.period.endLocalDateInclusive, locale),
        start: formatLocalDate(report.period.startLocalDate, locale),
      })}
      title={t("reports.period.title")}
    >
      <StatGroup>
        <Stat
          detail={t("reports.period.saleCount", format.count(report.sales.saleCount))}
          label={t("reports.period.sales")}
          value={format.money(report.sales.grossMinorUnits)}
        />
        <Stat
          detail={t("reports.period.expenseCount", format.count(report.expenses.expenseCount))}
          label={t("reports.period.expenses")}
          value={format.money(report.expenses.totalMinorUnits)}
        />
        <Stat
          detail={t("reports.period.cashFlow", {
            inflow: format.money(report.cash.inflowMinorUnits),
            outflow: format.money(report.cash.outflowMinorUnits),
          })}
          label={t("reports.period.netCash")}
          value={format.money(report.cash.netMovementMinorUnits)}
        />
      </StatGroup>
      {/* Zeros from a successful read are real figures, not an achievement. */}
      {hasPeriodActivity(report) ? null : (
        <Alert icon={CalendarX2} role="note" variant="default">
          <AlertDescription>{t("reports.period.noActivity")}</AlertDescription>
        </Alert>
      )}
      {/* The three figures come from different records, so the page says why they do not add up. */}
      <Text className="max-w-3xl text-xs leading-4 text-muted-foreground">
        {t("reports.period.cashScope")}
      </Text>
    </Section>
  );
}

function PositionSummary({ links, locale, report }: ReportProps & { links: ReportLinks }) {
  const { t } = useTranslation();
  const format = useReportFormat({ locale, report });
  const { receivables, inventory } = report;
  return (
    <Section
      actions={
        links.receivables || links.inventory ? (
          <>
            {links.receivables ? (
              <ModuleLink
                href="/operate/receivables"
                label={t("reports.position.viewReceivables")}
              />
            ) : null}
            {links.inventory ? (
              <ModuleLink href="/operate/inventory" label={t("reports.position.viewInventory")} />
            ) : null}
          </>
        ) : undefined
      }
      description={t("reports.position.scope")}
      title={t("reports.position.asOf", {
        date: formatLocalDate(report.positionAsOfLocalDate, locale),
      })}
    >
      <StatGroup>
        <Stat
          detail={t("reports.position.openCount", format.count(receivables.openReceivableCount))}
          label={t("reports.position.receivables")}
          value={format.money(receivables.outstandingMinorUnits)}
        />
        <Stat
          detail={t(
            "reports.position.overdueCount",
            format.count(receivables.overdueReceivableCount),
          )}
          label={t("reports.position.overdue")}
          tone={receivables.overdueMinorUnits === "0" ? "default" : "warning"}
          value={format.money(receivables.overdueMinorUnits)}
        />
        <Stat
          detail={t("reports.position.trackedCount", format.count(inventory.trackedProductCount))}
          label={t("reports.position.lowStock")}
          tone={inventory.lowStockProductCount === "0" ? "default" : "warning"}
          value={formatCount(inventory.lowStockProductCount, locale)}
        />
      </StatGroup>
    </Section>
  );
}

function ShareBar({ category, locale }: { category: ExpenseCategoryShare; locale: string }) {
  return (
    <View className="min-w-36 flex-row items-center justify-end gap-2">
      <View aria-hidden className="h-1.5 w-20 overflow-hidden rounded-xs bg-muted">
        <View className="h-full bg-chart-1" style={{ width: `${category.shareTenths / 10}%` }} />
      </View>
      {/* A fixed width keeps the decimal points of every row in one column; "100.0%" fits it. */}
      <Text
        className="w-14 shrink-0 text-right text-[13px] text-muted-foreground tabular-nums"
        numberOfLines={1}
      >
        {formatShare(category, locale)}
      </Text>
    </View>
  );
}

function ExpenseBreakdown({ locale, report }: ReportProps) {
  const { t } = useTranslation();
  const format = useReportFormat({ locale, report });
  const columns = useMemo<DataTableColumn<ExpenseCategoryShare>[]>(() => {
    const labels = expenseCategoryLabels(t);
    return [
      {
        id: "category",
        header: t("dataTable.columns.category"),
        meta: { primary: true },
        cell: ({ row: { original } }) => (
          <Text className="text-[13px]">{labels[original.category]}</Text>
        ),
      },
      {
        id: "count",
        header: t("reports.expenses.count"),
        meta: { align: "end", width: 104 },
        cell: ({ row: { original } }) => (
          <Text className="text-[13px] text-muted-foreground tabular-nums">
            {formatCount(original.expenseCount, locale)}
          </Text>
        ),
      },
      {
        id: "share",
        header: t("reports.expenses.share"),
        meta: { align: "end", width: 184 },
        cell: ({ row: { original } }) => <ShareBar category={original} locale={locale} />,
      },
      {
        id: "amount",
        header: t("dataTable.columns.amount"),
        meta: { align: "end", figure: true, width: 152 },
        cell: ({ row: { original } }) => (
          <Text className="font-ui text-[13px] tabular-nums">
            {format.money(original.totalMinorUnits)}
          </Text>
        ),
      },
    ];
  }, [format, locale, t]);
  return (
    <Section description={t("reports.expenses.description")} title={t("reports.expenses.title")}>
      <DataTable
        caption={t("reports.expenses.title")}
        columns={columns}
        data={expenseCategoryShares(report.expenses)}
        empty={
          <Text className="text-[13px] text-muted-foreground">{t("reports.expenses.empty")}</Text>
        }
        getRowId={(category) => category.category}
      />
    </Section>
  );
}

function CashBreakdown({ links, locale, report }: ReportProps & { links: ReportLinks }) {
  const { t } = useTranslation();
  const format = useReportFormat({ locale, report });
  const columns = useMemo<DataTableColumn<CashAccountFacts>[]>(() => {
    const kinds = cashAccountKindLabels(t);
    const statuses = cashAccountStatusLabels(t);
    const amount = (value: string, emphasis = false) => (
      <Text className={emphasis ? "font-ui text-[13px] tabular-nums" : "text-[13px] tabular-nums"}>
        {format.money(value)}
      </Text>
    );
    return [
      {
        id: "account",
        header: t("dataTable.columns.account"),
        meta: { primary: true },
        cell: ({ row: { original } }) => (
          <View className="min-w-0 flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <Text className="text-[13px]">{original.accountName}</Text>
            {original.accountStatus === "archived" ? (
              <StatusBadge label={statuses.archived} tone="exception" />
            ) : null}
          </View>
        ),
      },
      {
        id: "kind",
        header: t("reports.cash.kind"),
        // On a phone the account name is enough to tell the rows apart.
        meta: { hideOnCompact: true, width: 140 },
        cell: ({ row: { original } }) => (
          <Text className="text-[13px] text-muted-foreground">{kinds[original.accountKind]}</Text>
        ),
      },
      {
        id: "inflow",
        header: t("reports.cash.inflow"),
        meta: { align: "end", width: 136 },
        cell: ({ row: { original } }) => amount(original.inflowMinorUnits),
      },
      {
        id: "outflow",
        header: t("reports.cash.outflow"),
        meta: { align: "end", width: 136 },
        cell: ({ row: { original } }) => amount(original.outflowMinorUnits),
      },
      {
        id: "net",
        header: t("reports.cash.net"),
        meta: { align: "end", figure: true, width: 136 },
        cell: ({ row: { original } }) => amount(original.netMovementMinorUnits, true),
      },
    ];
  }, [format, t]);
  return (
    <Section description={t("reports.cash.description")} title={t("reports.cash.title")}>
      <DataTable
        caption={t("reports.cash.title")}
        columns={columns}
        data={report.cash.accounts}
        empty={<Text className="text-[13px] text-muted-foreground">{t("reports.cash.empty")}</Text>}
        getRowHref={
          links.cashAccounts
            ? (account): Href => ({
                pathname: "/operate/cash/accounts/[accountId]",
                params: { accountId: account.accountId },
              })
            : undefined
        }
        getRowId={(account) => account.accountId}
      />
    </Section>
  );
}

export function ReportSections({ links, locale, report }: ReportProps & { links: ReportLinks }) {
  const { t } = useTranslation();
  return (
    <View className="min-w-0 gap-8">
      <PeriodSummary locale={locale} report={report} />
      <PositionSummary links={links} locale={locale} report={report} />
      <ExpenseBreakdown locale={locale} report={report} />
      <CashBreakdown links={links} locale={locale} report={report} />
      <Text className="text-xs leading-4 text-muted-foreground tabular-nums">
        {t("reports.queriedAt", {
          date: formatLocalizedDateTime(report.queriedAt, locale, report.period.timeZone),
        })}
      </Text>
    </View>
  );
}

function StatGroupSkeleton() {
  return (
    <View className="gap-3">
      <View className="gap-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-72 max-w-full" />
      </View>
      <StatGroup>
        {[0, 1, 2].map((index) => (
          <View className="min-w-[140px] flex-1 basis-[140px] gap-2 bg-card px-4 py-3" key={index}>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-24" />
          </View>
        ))}
      </StatGroup>
    </View>
  );
}

/** Shaped like the report so the page does not jump when the figures arrive. */
export function ReportSkeleton() {
  const { t } = useTranslation();
  return (
    <View className="min-w-0 gap-8">
      <View aria-hidden className="gap-8">
        <StatGroupSkeleton />
        <StatGroupSkeleton />
      </View>
      <ContentSkeleton label={t("reports.loading")} variant="section" />
    </View>
  );
}
