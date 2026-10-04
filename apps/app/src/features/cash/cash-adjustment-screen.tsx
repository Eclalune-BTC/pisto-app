import type { CashAccount, RecordCashAdjustmentRequest } from "@pisto/contracts";
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
import { requireSupportedLocale } from "@/i18n/locale";
import type { MutationPhase } from "@/lib/mutation-phase";
import { AccountBalanceHint } from "./account-balance-hint";
import { CashOperationReview } from "./cash-operation-review";
import { ChoiceList } from "./choice-list";
import type { AdjustmentDraftValues } from "./drafts";
import { FieldError } from "./field-error";
import { FormSection } from "./form-section";
import { formatLocalOccurrence } from "./format";
import { type CursorPage, LoadMoreButton } from "./load-more-button";
import { LocalDateTimeFields } from "./local-date-time-fields";

export type CashAdjustmentDraft = AdjustmentDraftValues;

export type CashAdjustmentErrors = Partial<Record<keyof CashAdjustmentDraft, string>>;

type CashAdjustmentScreenProps = {
  accounts: CashAccount[];
  accountsPage: CursorPage;
  canConfirm: boolean;
  /** Prepared command; when present the screen shows its review. */
  command: RecordCashAdjustmentRequest | null;
  draft: CashAdjustmentDraft;
  errorMessage?: string;
  errors: CashAdjustmentErrors;
  formatMoney: (minorUnits: string, currency: string) => string;
  onCancel: () => void;
  onConfirm: () => void;
  onDraftChange: (next: CashAdjustmentDraft) => void;
  onEdit: () => void;
  onPrepareReview: () => void;
  phase: MutationPhase;
  /** The account as it was reviewed; a later refetch cannot change what is being confirmed. */
  reviewAccount: CashAccount | null;
};

export function CashAdjustmentScreen({
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
}: CashAdjustmentScreenProps) {
  const { i18n, t } = useTranslation();
  const directions = [
    { label: t("cash.adjustment.moneyIn"), value: "in" },
    { label: t("cash.adjustment.moneyOut"), value: "out" },
  ] as const;

  if (command) {
    if (!reviewAccount || reviewAccount.id !== command.accountId) {
      throw new Error("A cash adjustment review requires its reviewed account");
    }
    return (
      <Page width="form">
        <PageHeader
          description={t("cash.adjustment.reviewDescription")}
          title={t("cash.adjustment.reviewTitle")}
        />
        <CashOperationReview
          confirmLabel={t("cash.adjustment.confirm")}
          disabled={!canConfirm}
          effect={t("cash.adjustment.effect")}
          errorMessage={errorMessage}
          items={[
            { label: t("cash.fields.account"), value: reviewAccount.name },
            {
              label: t("cash.adjustment.direction"),
              value: command.direction === "in" ? directions[0].label : directions[1].label,
            },
            {
              label: t("cash.fields.amount"),
              numeric: true,
              value: formatMoney(command.amountMinorUnits, command.currency),
            },
            { label: t("cash.fields.reason"), value: command.reason },
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
          title={t("cash.adjustment.reviewTitle")}
        />
      </Page>
    );
  }

  const activeAccounts = accounts.filter(({ status }) => status === "active");
  const selected = activeAccounts.find(({ id }) => id === draft.accountId);
  return (
    <Page width="form">
      <PageHeader
        description={t("cash.adjustment.description")}
        title={t("cash.adjustment.title")}
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
          description={t("cash.adjustment.noAccountsDescription")}
          icon={Landmark}
          title={t("cash.adjustment.noAccountsTitle")}
        />
      ) : (
        <>
          <FormSection title={t("cash.adjustment.detailsSection")}>
            <View className="gap-2">
              <SelectField
                label={t("cash.fields.account")}
                onChange={(accountId) => onDraftChange({ ...draft, accountId })}
                options={activeAccounts.map(({ id, name }) => ({ label: name, value: id }))}
                value={draft.accountId || null}
              />
              <AccountBalanceHint account={selected} />
              <FieldError message={errors.accountId} />
              <LoadMoreButton
                className="self-start"
                label={t("cash.fields.loadMoreAccounts")}
                page={accountsPage}
              />
            </View>
            <ChoiceList
              label={t("cash.adjustment.direction")}
              onChange={(direction) => onDraftChange({ ...draft, direction })}
              options={directions}
              value={draft.direction}
            />
            <Field
              error={errors.amount}
              keyboardType="decimal-pad"
              label={t("cash.fields.amount")}
              onChangeText={(amount) => onDraftChange({ ...draft, amount })}
              trailing={
                selected ? (
                  <Text className="font-ui text-sm text-muted-foreground">{selected.currency}</Text>
                ) : undefined
              }
              value={draft.amount}
            />
            <Field
              error={errors.reason}
              label={t("cash.fields.reason")}
              maxLength={240}
              onChangeText={(reason) => onDraftChange({ ...draft, reason })}
              value={draft.reason}
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
            <Button label={t("cash.adjustment.review")} onPress={onPrepareReview} />
          </View>
        </>
      )}
    </Page>
  );
}
