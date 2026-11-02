import type { CashAccount, ExpenseCategory, PostExpenseRequest } from "@pisto/contracts";
import { Link } from "expo-router";
import { Landmark } from "lucide-react-native";
import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { CommandReview } from "@/components/command-review";
import { FormActions } from "@/components/layout/form-actions";
import { MutedValue } from "@/components/layout/review-values";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Heading } from "@/components/ui/heading";
import { type CursorPage, LoadMoreButton } from "@/components/ui/load-more-button";
import { MomentFields } from "@/components/ui/moment-fields";
import { SelectField } from "@/components/ui/select-field";
import { Text } from "@/components/ui/text";
import { useFieldMarker } from "@/features/assistant/draft-slots";
import { formatLocalMoment } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import type { MutationPhase } from "@/lib/mutation-phase";
import { AccountBalanceHint } from "../cash/account-balance-hint";
import { balanceAfter } from "../cash/drafts";
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

/** The form surface: one card whose actions close it, like the prototype's expense form. */
function FormCard({ children }: PropsWithChildren) {
  return (
    <View className="min-w-0 gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      {children}
    </View>
  );
}

/** Two fields side by side on wide cards, stacked on phones. */
function FieldRow({ children }: PropsWithChildren) {
  return <View className="min-w-0 flex-row flex-wrap gap-x-3 gap-y-4">{children}</View>;
}

function FieldCell({ children, wide = false }: PropsWithChildren<{ wide?: boolean }>) {
  return (
    <View
      className={wide ? "min-w-0 shrink grow basis-[300px]" : "min-w-0 shrink grow basis-[200px]"}
    >
      {children}
    </View>
  );
}

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
  const categoryMarker = useFieldMarker("category");
  const amountMarker = useFieldMarker("amount");
  const accountMarker = useFieldMarker("account");

  if (command) {
    if (!reviewAccount || reviewAccount.id !== command.accountId) {
      throw new Error("An expense review requires its reviewed paying account");
    }
    return (
      <FormCard>
        <View className="gap-0.5">
          <Heading level={2} size="section">
            {t("expenses.editor.reviewTitle")}
          </Heading>
          <Text className="text-[13px] leading-5 text-muted-foreground">
            {t("expenses.editor.reviewDescription")}
          </Text>
        </View>
        <CommandReview
          confirmLabel={t("expenses.editor.confirm")}
          disabled={!canConfirm}
          note={t("expenses.editor.effect")}
          errorMessage={errorMessage}
          items={[
            { label: t("expenses.editor.description"), value: command.description },
            {
              label: t("expenses.editor.category"),
              value: expenseCategoryLabels(t)[command.category],
            },
            {
              label: t("expenses.editor.amount"),
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
      </FormCard>
    );
  }

  const activeAccounts = accounts.filter(({ status }) => status === "active");
  const paying = activeAccounts.find(({ id }) => id === draft.accountId);
  const currency = paying?.currency;
  if (activeAccounts.length === 0) {
    return (
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
    );
  }
  return (
    <FormCard>
      <Field
        error={errors.description}
        label={t("expenses.editor.description")}
        maxLength={240}
        onChangeText={(description) => onDraftChange({ ...draft, description })}
        placeholder={t("expenses.editor.descriptionPlaceholder")}
        value={draft.description}
      />
      <FieldRow>
        <FieldCell>
          <SelectField<ExpenseCategory>
            label={t("expenses.editor.category")}
            marker={categoryMarker}
            onChange={(category) => onDraftChange({ ...draft, category })}
            options={expenseCategoryOptions(t)}
            value={draft.category}
          />
        </FieldCell>
        <FieldCell wide>
          <MomentFields
            date={draft.localDate}
            dateError={errors.localDate}
            onDateChange={(localDate) => onDraftChange({ ...draft, localDate })}
            onTimeChange={(localTime) => onDraftChange({ ...draft, localTime })}
            time={draft.localTime}
            timeError={errors.localTime}
          />
        </FieldCell>
      </FieldRow>
      <FieldRow>
        <FieldCell>
          <Field
            error={errors.amount}
            keyboardType="decimal-pad"
            label={t("expenses.editor.amount")}
            marker={amountMarker}
            onChangeText={(amount) => onDraftChange({ ...draft, amount })}
            placeholder="0.00"
            trailing={
              currency ? (
                <Text className="font-ui text-sm text-muted-foreground">{currency}</Text>
              ) : undefined
            }
            value={draft.amount}
          />
        </FieldCell>
        <FieldCell>
          <View className="gap-1.5">
            <SelectField
              error={errors.accountId}
              label={t("expenses.editor.account")}
              marker={accountMarker}
              onChange={(accountId) => onDraftChange({ ...draft, accountId })}
              options={activeAccounts.map(({ id, name }) => ({ label: name, value: id }))}
              value={draft.accountId || null}
            />
            <AccountBalanceHint account={paying} />
            <LoadMoreButton
              className="self-start"
              label={t("cash.fields.loadMoreAccounts")}
              page={accountsPage}
            />
          </View>
        </FieldCell>
      </FieldRow>
      <Field
        error={errors.payee}
        label={t("expenses.editor.payeeOptional")}
        maxLength={120}
        onChangeText={(payee) => onDraftChange({ ...draft, payee })}
        placeholder={t("expenses.editor.payeePlaceholder")}
        value={draft.payee}
      />
      <View className="-mx-4 border-t border-border px-4 pt-3 sm:-mx-5 sm:px-5">
        <FormActions
          onCancel={onCancel}
          onSubmit={onPrepareReview}
          submitLabel={t("expenses.editor.review")}
        />
      </View>
    </FormCard>
  );
}
