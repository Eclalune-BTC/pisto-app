import type { Expense } from "@pisto/contracts";
import { Ban } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { type DescriptionItem, DescriptionList } from "@/components/layout/description-list";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Stat, StatGroup } from "@/components/layout/stat-group";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { CashAccountName } from "../cash/cash-account-name";
import { HeaderActions } from "../cash/header-actions";
import { MutedValue } from "../cash/review-values";
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
    {
      label: t("expenses.detail.payee"),
      value: expense.payee ?? <MutedValue>{t("expenses.detail.noPayee")}</MutedValue>,
    },
    {
      label: t("expenses.detail.recordedAt"),
      numeric: true,
      value: formatTimestamp(expense.createdAt, expense.timeZone),
    },
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
    <Page>
      <PageHeader
        actions={
          canVoid && !voided ? (
            <HeaderActions
              menuLabel={t("expenses.detail.moreActions")}
              overflow={[
                {
                  destructive: true,
                  icon: Ban,
                  label: t("expenses.void.action"),
                  onPress: onVoid,
                },
              ]}
            />
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
      <StatGroup>
        <Stat
          label={t("expenses.detail.amount")}
          value={formatMoney(
            expense.amountMinorUnits,
            expense.currency,
            expense.currencyMinorUnitDigits,
          )}
        />
      </StatGroup>
      <Section title={t("expenses.detail.detailsTitle")}>
        <DescriptionList items={items} />
      </Section>
    </Page>
  );
}
