import type { ExpenseCategory, ExpensePeriodSummary } from "@pisto/contracts";
import { Text, View } from "react-native";

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
      <View className="gap-6 border-y border-line py-7 dark:border-[#304239] lg:flex-row">
        <View className="gap-2 lg:w-[52%] lg:pr-10">
          <Text className="text-sm font-bold text-positive dark:text-[#8DDEAF]">
            {periodTotalLabel}
          </Text>
          <Text className="text-[38px] font-black leading-[44px] tracking-[-1.4px] text-ink dark:text-white sm:text-[46px] sm:leading-[52px]">
            {formatMoney(
              summary.totalMinorUnits,
              summary.currency,
              summary.currencyMinorUnitDigits,
            )}
          </Text>
          <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
            {recordedExpensesLabel} · {summary.expenseCount}
          </Text>
        </View>
        <View className="min-w-0 flex-1 gap-3 border-t border-line pt-5 dark:border-[#304239] lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          <Text className="font-bold text-ink dark:text-white">{categoryBreakdownLabel}</Text>
          {summary.categories.length === 0 ? (
            <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">{noCategoryData}</Text>
          ) : (
            summary.categories.map((category) => (
              <View
                className="flex-row items-baseline justify-between gap-4"
                key={category.category}
              >
                <Text className="min-w-0 flex-1 text-sm text-ink-muted dark:text-[#AAB8B0]">
                  {categoryLabels[category.category]}
                </Text>
                <Text className="font-bold text-ink dark:text-white">
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
      <Text className="max-w-[720px] text-xs leading-5 text-ink-muted dark:text-[#91A198]">
        {expensesNotProfit}
      </Text>
    </View>
  );
}
