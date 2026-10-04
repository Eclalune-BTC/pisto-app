import type { CashAccount, TransferCashRequest } from "@pisto/contracts";
import { Link } from "expo-router";
import { ArrowLeftRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { PageHeader } from "@/components/layout/page-header";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { Text } from "@/components/ui/text";
import { requireSupportedLocale } from "@/i18n/locale";
import type { MutationPhase } from "@/lib/mutation-phase";
import { AccountBalanceHint } from "./account-balance-hint";
import { CashOperationReview } from "./cash-operation-review";
import type { TransferDraftValues } from "./drafts";
import { FieldError } from "./field-error";
import { FormSection } from "./form-section";
import { formatLocalOccurrence } from "./format";
import { type CursorPage, LoadMoreButton } from "./load-more-button";
import { LocalDateTimeFields } from "./local-date-time-fields";
import { MutedValue } from "./review-values";

export type CashTransferDraft = TransferDraftValues;

export type CashTransferErrors = Partial<Record<keyof CashTransferDraft, string>>;

type CashTransferScreenProps = {
  accounts: CashAccount[];
  accountsPage: CursorPage;
  canConfirm: boolean;
  /** Prepared command; when present the screen shows its review. */
  command: TransferCashRequest | null;
  draft: CashTransferDraft;
  errorMessage?: string;
  errors: CashTransferErrors;
  formatMoney: (minorUnits: string, currency: string) => string;
  onCancel: () => void;
  onConfirm: () => void;
  onDraftChange: (next: CashTransferDraft) => void;
  onEdit: () => void;
  onPrepareReview: () => void;
  phase: MutationPhase;
  /** Both accounts as they were reviewed; a later refetch cannot change what is confirmed. */
  reviewAccounts: CashAccount[];
};

export function CashTransferScreen({
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
  reviewAccounts,
}: CashTransferScreenProps) {
  const { i18n, t } = useTranslation();

  if (command) {
    const from = reviewAccounts.find(({ id }) => id === command.fromAccountId);
    const to = reviewAccounts.find(({ id }) => id === command.toAccountId);
    if (!from || !to) throw new Error("A cash transfer review requires both reviewed accounts");
    return (
      <Page width="form">
        <PageHeader
          description={t("cash.transfer.reviewDescription")}
          title={t("cash.transfer.reviewTitle")}
        />
        <CashOperationReview
          confirmLabel={t("cash.transfer.confirm")}
          disabled={!canConfirm}
          effect={t("cash.transfer.effect")}
          errorMessage={errorMessage}
          items={[
            { label: t("cash.transfer.fromAccount"), value: from.name },
            { label: t("cash.transfer.toAccount"), value: to.name },
            {
              label: t("cash.fields.amount"),
              numeric: true,
              value: formatMoney(command.amountMinorUnits, command.currency),
            },
            {
              label: t("cash.transfer.note"),
              value: command.note ?? <MutedValue>{t("cash.transfer.noNote")}</MutedValue>,
            },
            {
              label: t("cash.fields.occurredAt"),
              numeric: true,
              value: formatLocalOccurrence(
                command.occurredLocalDate,
                command.occurredLocalTime,
                requireSupportedLocale(i18n.resolvedLanguage),
              ),
            },
          ]}
          onConfirm={onConfirm}
          onEdit={onEdit}
          phase={phase}
          title={t("cash.transfer.reviewTitle")}
        />
      </Page>
    );
  }

  const activeAccounts = accounts.filter(({ status }) => status === "active");
  const options = activeAccounts.map(({ id, name }) => ({ label: name, value: id }));
  const fromAccount = activeAccounts.find(({ id }) => id === draft.fromAccountId);
  const toAccount = activeAccounts.find(({ id }) => id === draft.toAccountId);
  const currency = fromAccount?.currency;
  return (
    <Page width="form">
      <PageHeader description={t("cash.transfer.description")} title={t("cash.transfer.title")} />
      {activeAccounts.length < 2 ? (
        <EmptyState
          action={
            <Link asChild href="/operate/cash/accounts/new">
              <Button accessibilityRole="link" size="sm">
                <Text>{t("cash.overview.newAccount")}</Text>
              </Button>
            </Link>
          }
          description={t("cash.transfer.noAccountsDescription")}
          icon={ArrowLeftRight}
          title={t("cash.transfer.noAccountsTitle")}
        />
      ) : (
        <>
          <FormSection title={t("cash.transfer.accountsSection")}>
            <View className="gap-2">
              <SelectField
                label={t("cash.transfer.fromAccount")}
                onChange={(fromAccountId) => onDraftChange({ ...draft, fromAccountId })}
                options={options}
                value={draft.fromAccountId || null}
              />
              <AccountBalanceHint account={fromAccount} />
              <FieldError message={errors.fromAccountId} />
            </View>
            <View className="gap-2">
              <SelectField
                label={t("cash.transfer.toAccount")}
                onChange={(toAccountId) => onDraftChange({ ...draft, toAccountId })}
                options={options}
                value={draft.toAccountId || null}
              />
              <AccountBalanceHint account={toAccount} />
              <FieldError message={errors.toAccountId} />
            </View>
            <LoadMoreButton
              className="self-start"
              label={t("cash.fields.loadMoreAccounts")}
              page={accountsPage}
            />
          </FormSection>
          <FormSection title={t("cash.transfer.amountSection")}>
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
            <Field
              error={errors.note}
              label={t("cash.transfer.noteOptional")}
              maxLength={240}
              onChangeText={(note) => onDraftChange({ ...draft, note })}
              value={draft.note}
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
            <Button label={t("cash.transfer.review")} onPress={onPrepareReview} />
          </View>
        </>
      )}
    </Page>
  );
}
