import type { ExpensePeriodSummary } from "@pisto/contracts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Section } from "@/components/layout/section";
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

function useSummaryFormat(summary: ExpensePeriodSummary) {
  const { i18n } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const counts = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  return {
    count: (value: string) => counts.format(Number(value)),
    locale,
    money: (minorUnits: string) =>
      formatMinorUnits(minorUnits, summary.currency, summary.currencyMinorUnitDigits, locale),
  };
}

/** Exact totals of posted expenses; they are never presented as profit or total cost. */
export function ExpenseSummary({ summary }: { summary: ExpensePeriodSummary }) {
  const { t } = useTranslation();
  const format = useSummaryFormat(summary);
  return (
    <View className="min-w-0 gap-2">
      <StatGroup>
        <Stat
          detail={t("expenses.summary.range", {
            end: formatLocalDate(summary.periodEndLocalInclusive, format.locale),
            start: formatLocalDate(summary.periodStartLocal, format.locale),
          })}
          label={t("expenses.summary.total")}
          value={format.money(summary.totalMinorUnits)}
        />
        <Stat
          detail={t("expenses.summary.countDetail")}
          label={t("expenses.summary.expenseCount")}
          value={format.count(summary.expenseCount)}
        />
      </StatGroup>
      <Text className="text-xs leading-5 text-muted-foreground">
        {t("expenses.summary.notProfit")}
      </Text>
    </View>
  );
}

/** The period total by category, largest first. */
export function ExpenseCategoryBreakdown({
  level,
  summary,
}: {
  /** A section of its own on phones, part of the period summary elsewhere. */
  level: 2 | 3;
  summary: ExpensePeriodSummary;
}) {
  const { t } = useTranslation();
  const format = useSummaryFormat(summary);
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
        // Not end-aligned: compact rows take the first end-aligned column as the row's figure.
        cell: ({ row: { original } }) => (
          <Text className="text-[13px] text-muted-foreground tabular-nums">
            {format.count(original.expenseCount)}
          </Text>
        ),
      },
      {
        id: "amount",
        header: t("dataTable.columns.amount"),
        meta: { align: "end" },
        cell: ({ row: { original } }) => (
          <Text className="font-ui text-[13px] tabular-nums">
            {format.money(original.amountMinorUnits)}
          </Text>
        ),
      },
    ];
  }, [format, t]);
  const content =
    summary.categories.length > 0 ? (
      <DataTable
        caption={t("expenses.summary.byCategory")}
        columns={columns}
        data={byAmount(summary.categories)}
        getRowId={(category) => category.category}
      />
    ) : (
      <Text className="text-[13px] text-muted-foreground">{t("expenses.summary.noExpenses")}</Text>
    );
  if (level === 2) return <Section title={t("expenses.summary.byCategory")}>{content}</Section>;
  return (
    <View className="min-w-0 gap-2">
      <Heading level={3} size="section">
        {t("expenses.summary.byCategory")}
      </Heading>
      {content}
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
