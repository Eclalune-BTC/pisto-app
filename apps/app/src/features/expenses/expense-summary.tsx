import type { ExpenseCategory, ExpensePeriodSummary } from "@pisto/contracts";
import { View } from "react-native";
import { Text } from "@/components/ui/text";

type ExpenseSummaryProps = {
  summary: ExpensePeriodSummary;
  periodTotalLabel: string;
  recordedExpensesLabel: string;
  categoryBreakdownLabel: string;
  expensesNotProfit: string;
  noCategoryData: string;
  categoryLabels: Record<ExpenseCategory, string>;
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
};

export function ExpenseSummary({
  summary,
  periodTotalLabel,
  recordedExpensesLabel,
  categoryBreakdownLabel,
  expensesNotProfit,
  noCategoryData,
  categoryLabels,
  formatMoney,
}: ExpenseSummaryProps) {
  return (
    <View className="gap-3">
      <View className="gap-6 border-y border-border py-7 lg:flex-row">
        <View className="min-w-0 gap-2 lg:w-[52%] lg:pr-10">
          <Text className="font-ui text-sm text-muted-foreground">{periodTotalLabel}</Text>
          <Text className="min-w-0 text-[32px] font-heading leading-[44px] text-foreground sm:text-[46px] sm:leading-[52px]">
            {formatMoney(
              summary.totalMinorUnits,
              summary.currency,
              summary.currencyMinorUnitDigits,
            )}
          </Text>
          <Text className="font-sans text-sm text-muted-foreground">
            {summary.periodStartLocal} / {summary.periodEndLocalInclusive}
          </Text>
          <Text className="font-sans text-sm text-muted-foreground">
            {recordedExpensesLabel}: {summary.expenseCount}
          </Text>
        </View>
        <View className="min-w-0 flex-1 gap-3 border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          <Text className="font-ui text-foreground">{categoryBreakdownLabel}</Text>
          {summary.categories.length === 0 ? (
            <Text className="font-sans text-sm text-muted-foreground">{noCategoryData}</Text>
          ) : (
            summary.categories.map((category) => (
              <View
                className="flex-row flex-wrap items-baseline justify-between gap-4"
                key={category.category}
              >
                <Text className="font-sans min-w-0 flex-1 text-sm text-muted-foreground">
                  {categoryLabels[category.category]}
                </Text>
                <Text className="font-ui text-foreground">
                  {formatMoney(
                    category.amountMinorUnits,
                    summary.currency,
                    summary.currencyMinorUnitDigits,
                  )}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
      <Text className="font-sans max-w-[720px] text-xs leading-5 text-muted-foreground">
        {expensesNotProfit}
      </Text>
    </View>
  );
}
