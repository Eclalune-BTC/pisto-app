import { Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import type { Expense, ExpenseCategory } from "../../../../../packages/contracts/src/cash.ts";

type ExpenseHistoryProps = {
  expenses: Expense[];
  canManage: boolean;
  postedLabel: string;
  voidedLabel: string;
  voidActionLabel: string;
  categoryLabels: Record<ExpenseCategory, string>;
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
  onOpenExpense: (expenseId: string) => void;
  onVoidExpense: (expenseId: string) => void;
};

export function ExpenseHistory({
  expenses,
  canManage,
  postedLabel,
  voidedLabel,
  voidActionLabel,
  categoryLabels,
  formatMoney,
  onOpenExpense,
  onVoidExpense,
}: ExpenseHistoryProps) {
  return (
    <View className="border-y border-line dark:border-[#304239]">
      {expenses.map((expense) => (
        <View
          className="gap-3 border-b border-line py-4 last:border-b-0 dark:border-[#304239] sm:flex-row sm:items-center sm:justify-between"
          key={expense.id}
        >
          <Button
            accessibilityLabel={`${expense.description}, ${formatMoney(expense.amountMinorUnits, expense.currency, expense.currencyMinorUnitDigits)}`}
            className="min-h-10 min-w-0 flex-1 items-start justify-start px-0"
            onPress={() => onOpenExpense(expense.id)}
            variant="ghost"
          >
            <View className="min-w-0 flex-1 gap-1">
              <Text className="font-bold text-ink dark:text-white">{expense.description}</Text>
              <Text className="text-xs text-ink-muted dark:text-[#91A198]">
                {categoryLabels[expense.category]} · {expense.occurredLocalDate} ·{" "}
                {expense.status === "posted" ? postedLabel : voidedLabel}
              </Text>
            </View>
          </Button>
          <View className="items-start gap-2 sm:items-end">
            <Text className="font-black text-ink dark:text-white">
              {formatMoney(
                expense.amountMinorUnits,
                expense.currency,
                expense.currencyMinorUnitDigits,
              )}
            </Text>
            {canManage && expense.status === "posted" ? (
              <Button
                label={voidActionLabel}
                onPress={() => onVoidExpense(expense.id)}
                size="sm"
                variant="danger"
              />
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}
