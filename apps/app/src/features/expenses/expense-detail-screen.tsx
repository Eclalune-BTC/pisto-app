import type { Expense } from "@pisto/contracts";
import { useTranslation } from "react-i18next";
import { type DescriptionItem, DescriptionList } from "@/components/layout/description-list";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { CashAccountName } from "../cash/cash-account-name";
import { expenseCategoryLabels, expenseStatusLabels } from "./copy";

type ExpenseDetailScreenProps = {
  businessId: string;
  /** Voiding needs expense and cash management on fresh data. */
  canVoid: boolean;
  expense: Expense;
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
  formatTimestamp: (timestamp: string, timeZone: string) => string;
  isStale: boolean;
  onRetry: () => void;
  onVoid: () => void;
};

export function ExpenseDetailScreen({
  businessId,
  canVoid,
  expense,
  formatMoney,
  formatTimestamp,
  isStale,
  onRetry,
  onVoid,
}: ExpenseDetailScreenProps) {
  const { t } = useTranslation();
  const voided = expense.status === "voided";
  const items: DescriptionItem[] = [
    {
      label: t("expenses.detail.amount"),
      numeric: true,
      value: formatMoney(
        expense.amountMinorUnits,
        expense.currency,
        expense.currencyMinorUnitDigits,
      ),
    },
    { label: t("expenses.detail.category"), value: expenseCategoryLabels(t)[expense.category] },
    {
      label: t("expenses.detail.account"),
      value: (
        <CashAccountName
          accountId={expense.accountId}
          businessId={businessId}
          className="text-sm"
          linked
        />
      ),
    },
    {
      label: t("expenses.detail.occurredAt"),
      numeric: true,
      value: formatTimestamp(expense.occurredAt, expense.timeZone),
    },
    { label: t("expenses.detail.payee"), value: expense.payee ?? t("expenses.detail.noPayee") },
  ];
  if (expense.voidedAt) {
    items.push({
      label: t("expenses.detail.voidedAt"),
      numeric: true,
      value: formatTimestamp(expense.voidedAt, expense.timeZone),
    });
  }
  if (expense.voidReason) {
    items.push({ label: t("expenses.detail.voidReason"), value: expense.voidReason });
  }

  return (
    <Page width="form">
      <PageHeader
        actions={
          canVoid && !voided ? (
            <Button label={t("expenses.void.action")} onPress={onVoid} variant="outline" />
          ) : undefined
        }
        adornment={
          <Badge variant={voided ? "outline" : "secondary"}>
            <Text>{expenseStatusLabels(t)[expense.status]}</Text>
          </Badge>
        }
        description={voided ? t("expenses.detail.voidedDescription") : undefined}
        title={expense.description}
      />
      {isStale ? <StaleNotice onRetry={onRetry} /> : null}
      <Section title={t("expenses.detail.detailsTitle")}>
        <DescriptionList items={items} />
      </Section>
    </Page>
  );
}
