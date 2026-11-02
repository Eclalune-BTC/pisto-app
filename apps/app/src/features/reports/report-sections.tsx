import type { CashFlowReport, OperatingReport } from "@pisto/contracts";
import { TriangleAlert } from "lucide-react-native";
import { type PropsWithChildren, type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useWindowDimensions, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { formatLocalDate, formatLocalizedDateTime, formatMonthYear } from "@/i18n/format";
import { cn } from "@/lib/cn";
import { formatMinorUnits } from "@/lib/money";
import { expenseCategoryLabels } from "../expenses/copy";
import { CashFlowChart } from "./cash-flow-chart";
import {
  cashFlowMonthLabel,
  expenseCategoryShares,
  formatCount,
  formatShare,
  formatTenthsPercent,
  hasPeriodActivity,
  resultOfSales,
} from "./report-figures";

type Money = (minorUnits: string) => string;

function useMoney(currency: string, digits: number, locale: string): Money {
  return useMemo(
    () => (minorUnits: string) => formatMinorUnits(minorUnits, currency, digits, locale),
    [currency, digits, locale],
  );
}

/** A report region: one card with a titled header, like the prototype's report panels. */
function ReportCard({
  actions,
  children,
  description,
  title,
}: PropsWithChildren<{ actions?: ReactNode; description: string; title: string }>) {
  return (
    <View
      accessibilityLabel={title}
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-card"
      role="region"
    >
      <View className="flex-row flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3.5 sm:px-5">
        <View className="min-w-0 shrink gap-0.5">
          <Heading level={2} size="section">
            {title}
          </Heading>
          <Text className="text-xs leading-4 text-muted-foreground">{description}</Text>
        </View>
        {actions}
      </View>
      {children}
    </View>
  );
}

function StatementRow({
  detail,
  emphasis = false,
  indent = false,
  label,
  value,
}: {
  detail?: string;
  emphasis?: boolean;
  indent?: boolean;
  label: string;
  value: string;
}) {
  return (
    <View
      className={cn(
        "flex-row items-center justify-between gap-4 px-4 py-2.5 sm:px-5",
        indent && "py-1.5 pl-7 sm:pl-8",
      )}
    >
      <View className="min-w-0 shrink">
        <Text
          className={cn(
            "text-[13px] leading-5",
            emphasis ? "font-heading" : indent && "text-muted-foreground",
          )}
        >
          {label}
        </Text>
        {detail ? (
          <Text className="text-xs leading-4 text-muted-foreground tabular-nums">{detail}</Text>
        ) : null}
      </View>
      <Text
        className={cn("text-[13px] tabular-nums", emphasis && "font-heading")}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

/** What the month sold against what it spent. Pisto does not record the cost of each sale yet. */
export function IncomeStatement({ locale, report }: { locale: string; report: OperatingReport }) {
  const { t } = useTranslation();
  const money = useMoney(report.currency, report.currencyMinorUnitDigits, locale);
  const labels = expenseCategoryLabels(t);
  const result = resultOfSales(report);
  const negative = (minorUnits: string) =>
    minorUnits === "0" ? money("0") : money(`-${minorUnits}`);
  return (
    <ReportCard
      description={t("reports.statement.period", {
        end: formatLocalDate(report.period.endLocalDateInclusive, locale),
        start: formatLocalDate(report.period.startLocalDate, locale),
      })}
      title={t("reports.statement.title")}
    >
      <StatementRow
        detail={t("reports.period.saleCount", {
          count: Number(report.sales.saleCount),
          value: formatCount(report.sales.saleCount, locale),
        })}
        emphasis
        label={t("reports.statement.sales")}
        value={money(report.sales.grossMinorUnits)}
      />
      <View className="border-t border-border pt-1.5 pb-1">
        <Text className="px-4 pb-1 text-xs leading-4 text-muted-foreground sm:px-5">
          {t("reports.statement.operatingExpenses")}
        </Text>
        {report.expenses.categories.length === 0 ? (
          <Text className="px-4 py-1.5 pl-7 text-[13px] text-muted-foreground sm:pl-8">
            {t("reports.expenses.empty")}
          </Text>
        ) : (
          expenseCategoryShares(report.expenses).map((category) => (
            <StatementRow
              indent
              key={category.category}
              label={`${labels[category.category]} · ${formatShare(category, locale)}`}
              value={negative(category.totalMinorUnits)}
            />
          ))
        )}
      </View>
      <View className="border-t border-border">
        <StatementRow
          emphasis
          label={t("reports.statement.totalExpenses")}
          value={negative(report.expenses.totalMinorUnits)}
        />
      </View>
      <View className="flex-row items-center justify-between gap-4 border-t-2 border-foreground px-4 py-3.5 sm:px-5">
        <View className="min-w-0 shrink gap-0.5">
          <Text className="font-heading text-sm leading-5">{t("reports.statement.result")}</Text>
          {result.shareTenths !== null ? (
            <Text className="text-xs leading-4 text-muted-foreground tabular-nums">
              {t("reports.statement.resultShare", {
                share: formatTenthsPercent(result.shareTenths, locale),
              })}
            </Text>
          ) : null}
        </View>
        <Text
          className={cn(
            "font-heading text-2xl leading-8 tracking-[-0.5px] tabular-nums",
            result.sign > 0 && "text-positive",
            result.sign < 0 && "text-destructive",
          )}
          numberOfLines={1}
        >
          {money(result.minorUnits)}
        </Text>
      </View>
      <View className="gap-1 border-t border-border px-4 py-3 sm:px-5">
        {/* Zeros from a successful read are real figures, not an achievement. */}
        {hasPeriodActivity(report) ? null : (
          <Text className="text-xs leading-4 text-foreground" role="note">
            {t("reports.statement.noActivity")}
          </Text>
        )}
        <Text className="text-xs leading-4 text-muted-foreground">
          {t("reports.statement.scope")}
        </Text>
      </View>
    </ReportCard>
  );
}

type CashFlowQuery = {
  data: { report: CashFlowReport } | undefined;
  isError: boolean;
  isFetching: boolean;
  refetch: () => unknown;
};

function Legend() {
  const { t } = useTranslation();
  return (
    <View aria-hidden className="flex-row items-center gap-3">
      <View className="flex-row items-center gap-1.5">
        <View className="size-2 rounded-xs bg-primary" />
        <Text className="text-xs text-muted-foreground">{t("reports.cashFlow.inflow")}</Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <View className="size-2 rounded-xs bg-muted-foreground/35" />
        <Text className="text-xs text-muted-foreground">{t("reports.cashFlow.outflow")}</Text>
      </View>
    </View>
  );
}

/** Money in and out by month, as bars and as the exact table the bars are drawn from. */
export function CashFlow({ locale, query }: { locale: string; query: CashFlowQuery }) {
  const { t } = useTranslation();
  const report = query.data?.report;
  if (!report) {
    return (
      <ReportCard
        description={t("reports.cashFlow.loadingDescription")}
        title={t("reports.cashFlow.title")}
      >
        {query.isError ? (
          <View className="p-4">
            <StatePanel
              action={
                <Button
                  label={t("common.retry")}
                  loading={query.isFetching}
                  onPress={() => void query.refetch()}
                  size="sm"
                  variant="outline"
                />
              }
              description={t("reports.cashFlow.unavailableDescription")}
              icon={TriangleAlert}
              level={3}
              title={t("reports.cashFlow.unavailableTitle")}
              tone="destructive"
            />
          </View>
        ) : (
          <View accessibilityLabel={t("reports.loading")} aria-busy className="gap-3 p-4 sm:p-5">
            <Skeleton className="h-36 w-full" />
            {[0, 1, 2].map((index) => (
              <Skeleton className="h-3 w-full" key={index} />
            ))}
          </View>
        )}
      </ReportCard>
    );
  }
  return <CashFlowContent locale={locale} report={report} />;
}

function CashFlowContent({ locale, report }: { locale: string; report: CashFlowReport }) {
  const { t } = useTranslation();
  const money = useMoney(report.currency, report.currencyMinorUnitDigits, locale);
  // Phones keep the month, what came in and the closing balance; the rest is in the chart.
  const wide = useWindowDimensions().width >= 640;
  const first = report.months[0];
  const last = report.months.at(-1);
  if (!first || !last) throw new Error("A cash flow report has at least one month");
  const columns = wide
    ? (["month", "inflow", "outflow", "net", "closing"] as const)
    : (["month", "inflow", "closing"] as const);
  const signed = (minorUnits: string) =>
    minorUnits.startsWith("-") || minorUnits === "0" ? money(minorUnits) : `+${money(minorUnits)}`;
  return (
    <ReportCard
      actions={<Legend />}
      description={t("reports.cashFlow.range", {
        end: formatMonthYear(`${last.month}-01`, locale),
        start: formatMonthYear(`${first.month}-01`, locale),
      })}
      title={t("reports.cashFlow.title")}
    >
      <View className="px-4 pt-4 sm:px-5">
        <CashFlowChart locale={locale} months={report.months} />
      </View>
      <View accessibilityLabel={t("reports.cashFlow.tableLabel")} className="mt-2" role="table">
        <View
          className="flex-row gap-3 border-y border-border bg-muted/60 px-4 py-2 sm:px-5"
          role="row"
        >
          {columns.map((column) => (
            <Text
              className={cn(
                "text-xs leading-4 text-muted-foreground",
                column === "month" ? "flex-[1.3]" : "flex-1 text-right",
              )}
              key={column}
              role="columnheader"
            >
              {t(`reports.cashFlow.columns.${column}`)}
            </Text>
          ))}
        </View>
        {report.months.map((month, index) => (
          <View
            className={cn(
              "flex-row items-center gap-3 px-4 py-2.5 sm:px-5",
              index > 0 && "border-t border-border",
            )}
            key={month.month}
            role="row"
          >
            <Text className="flex-[1.3] text-[13px]" role="cell">
              {cashFlowMonthLabel(month.month, report.asOfLocalDate, locale, t)}
            </Text>
            <Text className="flex-1 text-right text-[13px] tabular-nums" role="cell">
              {money(month.inflowMinorUnits)}
            </Text>
            {wide ? (
              <>
                <Text
                  className="flex-1 text-right text-[13px] text-muted-foreground tabular-nums"
                  role="cell"
                >
                  {month.outflowMinorUnits === "0"
                    ? money("0")
                    : money(`-${month.outflowMinorUnits}`)}
                </Text>
                <Text className="flex-1 text-right text-[13px] tabular-nums" role="cell">
                  {signed(month.netMinorUnits)}
                </Text>
              </>
            ) : null}
            <Text className="flex-1 text-right font-ui text-[13px] tabular-nums" role="cell">
              {money(month.closingBalanceMinorUnits)}
            </Text>
          </View>
        ))}
      </View>
      <Text className="border-t border-border px-4 py-3 text-xs leading-4 text-muted-foreground sm:px-5">
        {t("reports.cashFlow.scope")}
      </Text>
    </ReportCard>
  );
}

export function ReportFootnote({ report, locale }: { locale: string; report: OperatingReport }) {
  const { t } = useTranslation();
  return (
    <Text className="text-xs leading-4 text-muted-foreground tabular-nums">
      {t("reports.queriedAt", {
        date: formatLocalizedDateTime(report.queriedAt, locale, report.period.timeZone),
      })}
    </Text>
  );
}

/** Shaped like the two report cards so the page does not jump when the figures arrive. */
export function ReportSkeleton() {
  const { t } = useTranslation();
  return (
    <View
      accessibilityLabel={t("reports.loading")}
      aria-busy
      className="min-w-0 flex-row flex-wrap items-start gap-4"
    >
      {[0, 1].map((card) => (
        <View
          className="min-w-0 grow basis-[340px] gap-3 rounded-xl border border-border bg-card p-5"
          key={card}
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
          {[0, 1, 2, 3, 4].map((row) => (
            <View className="flex-row justify-between" key={row}>
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-16" />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
