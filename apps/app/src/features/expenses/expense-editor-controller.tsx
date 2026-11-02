import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { PageHeader } from "@/components/layout/page-header";
import { Page } from "@/components/page";
import { currentLocalDateTime } from "@/lib/money";
import { expenseSummaryQueryOptions } from "../cash/queries";
import { useCashAccess } from "../cash/use-cash-access";
import { ExpenseForm } from "./expense-form";
import { expenseHref } from "./expense-history";
import { MonthExpensesPanel } from "./month-expenses-panel";

export function ExpenseEditorController() {
  const router = useRouter();
  const { t } = useTranslation();
  const { business, businesses, canRead } = useCashAccess("expenses");
  const today = business ? currentLocalDateTime(business.timeZone).date : "";
  const monthStart = today ? `${today.slice(0, 8)}01` : "";
  const monthSummary = useQuery(
    expenseSummaryQueryOptions(canRead ? business?.id : undefined, monthStart, today),
  );

  if (businesses.data && !business) return <Redirect href="/business" />;

  return (
    <Page>
      <PageHeader
        description={t("expenses.editor.pageDescription")}
        title={t("expenses.editor.title")}
      />
      <View className="min-w-0 flex-row flex-wrap items-start gap-4">
        <View className="min-w-0 max-w-[640px] shrink grow basis-[420px]">
          <ExpenseForm
            entrySource="manual"
            onCancel={() => router.replace("/operate/expenses")}
            onSaved={(expenseId) => router.replace(expenseHref(expenseId))}
          />
        </View>
        {canRead ? (
          <View className="hidden min-w-0 w-[300px] lg:flex">
            <MonthExpensesPanel query={monthSummary} />
          </View>
        ) : null}
      </View>
    </Page>
  );
}
