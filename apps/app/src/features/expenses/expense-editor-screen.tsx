import type { CashAccount, ExpenseCategory, PostExpenseRequest } from "@pisto/contracts";
import { Link } from "expo-router";
import { Landmark } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { PageHeader } from "@/components/layout/page-header";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { Text } from "@/components/ui/text";
import { formatLocalMoment } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import type { MutationPhase } from "@/lib/mutation-phase";
import { AccountBalanceHint } from "../cash/account-balance-hint";
import { CashOperationReview } from "../cash/cash-operation-review";
import { balanceAfter } from "../cash/drafts";
import { FieldError } from "../cash/field-error";
import { FormSection } from "../cash/form-section";
import { type CursorPage, LoadMoreButton } from "../cash/load-more-button";
import { LocalDateTimeFields } from "../cash/local-date-time-fields";
import { MutedValue } from "../cash/review-values";
import { expenseCategoryLabels, expenseCategoryOptions } from "./copy";
import type { ExpenseDraftValues } from "./drafts";

export type ExpenseDraft = ExpenseDraftValues;

export type ExpenseDraftErrors = Partial<Record<keyof ExpenseDraft, string>>;

type ExpenseEditorScreenProps = {
  accounts: CashAccount[];
  accountsPage: CursorPage;
  canConfirm: boolean;
  /** Prepared command; when present the screen shows its review. */
  command: PostExpenseRequest | null;
  draft: ExpenseDraft;
  errorMessage?: string;
  errors: ExpenseDraftErrors;
  formatMoney: (minorUnits: string, currency: string) => string;
  onCancel: () => void;
  onConfirm: () => void;
  onDraftChange: (next: ExpenseDraft) => void;
  onEdit: () => void;
  onPrepareReview: () => void;
  phase: MutationPhase;
  /** The paying account as it was reviewed; a later refetch cannot change what is confirmed. */
  reviewAccount: CashAccount | null;
};

export function ExpenseEditorScreen({
  accounts,
  accountsPage,
  canConfirm,
  command,
  draft,
  errorMessage,
  errors,
  formatMoney,
  onCancel,
  onConfirm,
  onDraftChange,
  onEdit,
  onPrepareReview,
  phase,
  reviewAccount,
}: ExpenseEditorScreenProps) {
  const { i18n, t } = useTranslation();

  if (command) {
    if (!reviewAccount || reviewAccount.id !== command.accountId) {
      throw new Error("An expense review requires its reviewed paying account");
    }
    return (
      <Page width="form">
        <PageHeader
          description={t("expenses.editor.reviewDescription")}
          title={t("expenses.editor.reviewTitle")}
        />
        <CashOperationReview
          confirmLabel={t("expenses.editor.confirm")}
          disabled={!canConfirm}
          effect={t("expenses.editor.effect")}
          errorMessage={errorMessage}
          items={[
            {
              label: t("cash.fields.amount"),
              numeric: true,
              value: formatMoney(command.amountMinorUnits, command.currency),
            },
            { label: t("expenses.editor.account"), value: reviewAccount.name },
            {
              label: t("cash.balanceAfter", { account: reviewAccount.name }),
              numeric: true,
              value: formatMoney(
                balanceAfter(reviewAccount, `-${command.amountMinorUnits}`),
                command.currency,
              ),
            },
            {
              label: t("expenses.editor.category"),
              value: expenseCategoryLabels(t)[command.category],
            },
            { label: t("expenses.editor.description"), value: command.description },
            {
              label: t("expenses.editor.payee"),
              value: command.payee ?? <MutedValue>{t("expenses.detail.noPayee")}</MutedValue>,
            },
            {
              label: t("cash.fields.occurredAt"),
              numeric: true,
              value: formatLocalMoment(
                command.occurredLocalDate,
                command.occurredLocalTime,
                requireSupportedLocale(i18n.resolvedLanguage),
              ),
            },
          ]}
          onConfirm={onConfirm}
          onEdit={onEdit}
          phase={phase}
          title={t("expenses.editor.reviewTitle")}
        />
      </Page>
    );
  }

  const activeAccounts = accounts.filter(({ status }) => status === "active");
  const paying = activeAccounts.find(({ id }) => id === draft.accountId);
  const currency = paying?.currency;
  return (
    <Page width="form">
      <PageHeader
        description={t("expenses.editor.pageDescription")}
        title={t("expenses.editor.title")}
      />
      {activeAccounts.length === 0 ? (
        <EmptyState
          action={
            <Link asChild href="/operate/cash/accounts/new">
              <Button accessibilityRole="link" size="sm">
                <Text>{t("cash.overview.newAccount")}</Text>
              </Button>
            </Link>
          }
          description={t("expenses.editor.noAccountsDescription")}
          icon={Landmark}
          title={t("expenses.editor.noAccountsTitle")}
        />
      ) : (
        <>
          <FormSection title={t("expenses.editor.paymentSection")}>
            <View className="gap-2">
              <SelectField
                label={t("expenses.editor.account")}
                onChange={(accountId) => onDraftChange({ ...draft, accountId })}
                options={activeAccounts.map(({ id, name }) => ({ label: name, value: id }))}
                value={draft.accountId || null}
              />
              <AccountBalanceHint account={paying} />
              <FieldError message={errors.accountId} />
              <LoadMoreButton
                className="self-start"
                label={t("cash.fields.loadMoreAccounts")}
                page={accountsPage}
              />
            </View>
            <Field
              error={errors.amount}
              keyboardType="decimal-pad"
              label={t("cash.fields.amount")}
              onChangeText={(amount) => onDraftChange({ ...draft, amount })}
              trailing={
                currency ? (
                  <Text className="font-ui text-sm text-muted-foreground">{currency}</Text>
                ) : undefined
              }
              value={draft.amount}
            />
          </FormSection>
          <FormSection title={t("expenses.editor.detailSection")}>
            <SelectField<ExpenseCategory>
              label={t("expenses.editor.category")}
              onChange={(category) => onDraftChange({ ...draft, category })}
              options={expenseCategoryOptions(t)}
              value={draft.category}
            />
            <Field
              error={errors.description}
              label={t("expenses.editor.description")}
              maxLength={240}
              onChangeText={(description) => onDraftChange({ ...draft, description })}
              value={draft.description}
            />
            <Field
              error={errors.payee}
              label={t("expenses.editor.payeeOptional")}
              maxLength={120}
              onChangeText={(payee) => onDraftChange({ ...draft, payee })}
              value={draft.payee}
            />
          </FormSection>
          <FormSection title={t("cash.fields.occurredAt")}>
            <LocalDateTimeFields
              date={draft.localDate}
              dateError={errors.localDate}
              onDateChange={(localDate) => onDraftChange({ ...draft, localDate })}
              onTimeChange={(localTime) => onDraftChange({ ...draft, localTime })}
              time={draft.localTime}
              timeError={errors.localTime}
            />
          </FormSection>
          <View className="flex-row flex-wrap justify-end gap-2">
            <Button label={t("common.cancel")} onPress={onCancel} variant="outline" />
            <Button label={t("expenses.editor.review")} onPress={onPrepareReview} />
          </View>
        </>
      )}
    </Page>
  );
}
