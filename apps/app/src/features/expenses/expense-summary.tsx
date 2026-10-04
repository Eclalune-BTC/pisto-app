import type { ExpensePeriodSummary } from "@pisto/contracts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Stat, StatGroup } from "@/components/layout/stat-group";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Heading } from "@/components/ui/heading";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { formatLocalDate } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { formatMinorUnits } from "@/lib/money";
import { expenseCategoryLabels } from "./copy";

type CategoryTotal = ExpensePeriodSummary["categories"][number];

/** The breakdown is complete for the period, so ordering it by exact amount hides nothing. */
function byAmount(categories: CategoryTotal[]): CategoryTotal[] {
  return [...categories].sort((a, b) => {
    const left = BigInt(a.amountMinorUnits);
    const right = BigInt(b.amountMinorUnits);
    return left === right ? 0 : left < right ? 1 : -1;
  });
}

/** Exact totals of posted expenses; they are never presented as profit or total cost. */
export function ExpenseSummary({ summary }: { summary: ExpensePeriodSummary }) {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const money = (minorUnits: string) =>
    formatMinorUnits(minorUnits, summary.currency, summary.currencyMinorUnitDigits, locale);
  const counts = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const columns = useMemo<DataTableColumn<CategoryTotal>[]>(() => {
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
        header: t("expenses.summary.expenseCount"),
        cell: ({ row: { original } }) => (
          <Text className="text-[13px] text-muted-foreground tabular-nums">
            {counts.format(Number(original.expenseCount))}
          </Text>
        ),
      },
      {
        id: "amount",
        header: t("dataTable.columns.amount"),
        meta: { align: "end" },
        cell: ({ row: { original } }) => (
          <Text className="font-ui text-[13px] tabular-nums">
            {formatMinorUnits(
              original.amountMinorUnits,
              summary.currency,
              summary.currencyMinorUnitDigits,
              locale,
            )}
          </Text>
        ),
      },
    ];
  }, [counts, locale, summary.currency, summary.currencyMinorUnitDigits, t]);

  return (
    <View className="min-w-0 gap-3">
      <StatGroup>
        <Stat
          detail={t("expenses.summary.range", {
            end: formatLocalDate(summary.periodEndLocalInclusive, locale),
            start: formatLocalDate(summary.periodStartLocal, locale),
          })}
          label={t("expenses.summary.total")}
          value={money(summary.totalMinorUnits)}
        />
        <Stat
          detail={t("expenses.summary.countDetail")}
          label={t("expenses.summary.expenseCount")}
          value={counts.format(Number(summary.expenseCount))}
        />
      </StatGroup>
      {summary.categories.length > 0 ? (
        <View className="min-w-0 gap-2">
          <Heading level={3} size="section">
            {t("expenses.summary.byCategory")}
          </Heading>
          <DataTable
            caption={t("expenses.summary.byCategory")}
            columns={columns}
            data={byAmount(summary.categories)}
            getRowId={(category) => category.category}
          />
        </View>
      ) : (
        <Text className="text-[13px] text-muted-foreground">
          {t("expenses.summary.noExpenses")}
        </Text>
      )}
      <Text className="text-xs leading-5 text-muted-foreground">
        {t("expenses.summary.notProfit")}
      </Text>
    </View>
  );
}

export function ExpenseSummarySkeleton() {
  const { t } = useTranslation();
  return (
    <View accessibilityLabel={t("expenses.summary.loading")} aria-busy>
      <StatGroup>
        {[0, 1].map((index) => (
          <View className="min-w-[150px] flex-1 basis-[180px] gap-2 bg-card px-4 py-3" key={index}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3 w-28" />
          </View>
        ))}
      </StatGroup>
    </View>
  );
}
