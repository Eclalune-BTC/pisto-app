import type { ExpensePeriodSummary } from "@pisto/contracts";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { formatLocalDate, formatMonthYear } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { formatMinorUnits } from "@/lib/money";
import { expenseCategoryLabels } from "./copy";
import { byAmount } from "./expense-summary";

type SummaryQuery = {
  data: { summary: ExpensePeriodSummary } | undefined;
  isError: boolean;
  isPending: boolean;
  refetch: () => unknown;
};

/** This month's posted expenses by category, beside the form so a new one can be weighed. */
export function MonthExpensesPanel({ query }: { query: SummaryQuery }) {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const summary = query.data?.summary;
  const title = summary
    ? t("expenses.monthPanel.title", { month: formatMonthYear(summary.periodStartLocal, locale) })
    : t("expenses.monthPanel.fallbackTitle");
  const money = (minorUnits: string) =>
    summary
      ? formatMinorUnits(minorUnits, summary.currency, summary.currencyMinorUnitDigits, locale)
      : "";
  return (
    <View
      accessibilityLabel={title}
      className="min-w-0 gap-3 rounded-xl border border-border bg-card p-4"
      role="region"
    >
      <View className="gap-0.5">
        <Heading level={2} size="section">
          {title}
        </Heading>
        {summary ? (
          <Text className="text-xs leading-4 text-muted-foreground tabular-nums">
            {t("expenses.summary.range", {
              end: formatLocalDate(summary.periodEndLocalInclusive, locale),
              start: formatLocalDate(summary.periodStartLocal, locale),
            })}
          </Text>
        ) : null}
      </View>
      {summary ? (
        summary.categories.length === 0 ? (
          <Text className="text-[13px] leading-5 text-muted-foreground">
            {t("expenses.monthPanel.empty")}
          </Text>
        ) : (
          <View>
            {byAmount(summary.categories).map((category) => (
              <View
                className="flex-row items-center justify-between gap-3 border-b border-border py-2"
                key={category.category}
              >
                <Text className="min-w-0 shrink text-[13px] text-muted-foreground">
                  {expenseCategoryLabels(t)[category.category]}
                </Text>
                <Text className="text-[13px] tabular-nums">{money(category.amountMinorUnits)}</Text>
              </View>
            ))}
            <View className="flex-row items-center justify-between gap-3 pt-2.5">
              <Text className="font-heading text-[13px]">{t("expenses.monthPanel.total")}</Text>
              <Text className="font-heading text-[13px] tabular-nums">
                {money(summary.totalMinorUnits)}
              </Text>
            </View>
          </View>
        )
      ) : query.isError ? (
        <View className="items-start gap-2">
          <Text className="text-[13px] leading-5 text-muted-foreground">
            {t("expenses.summary.unavailable")}
          </Text>
          <Button
            label={t("common.retry")}
            onPress={() => void query.refetch()}
            size="sm"
            variant="outline"
          />
        </View>
      ) : (
        <View accessibilityLabel={t("expenses.summary.loading")} aria-busy className="gap-3">
          {[0, 1, 2].map((index) => (
            <View className="flex-row justify-between" key={index}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-14" />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
