import type { ExpenseCategory, PostExpenseRequest } from "@pisto/contracts";
import { Text, View } from "react-native";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ChoiceList, type ChoiceOption } from "../cash/choice-list";
import {
  FeatureBoundary,
  type FeatureBoundaryCopy,
  type FeatureRemoteState,
  requireFeatureManageAccess,
} from "../cash/feature-boundary";
import type { CashConfirmationState } from "../cash/state";
import { ExpenseReview } from "./expense-review";

export type ExpenseDraft = {
  accountId: string;
  category: ExpenseCategory;
  amount: string;
  description: string;
  payee: string;
  localDate: string;
  localTime: string;
};

export type ExpenseDraftErrors = Partial<Record<keyof ExpenseDraft, string>>;

type AccountOption = { id: string; name: string };

export type ExpenseEditorCopy = FeatureBoundaryCopy & {
  eyebrow: string;
  newTitle: string;
  newDescription: string;
  reviewTitle: string;
  reviewDescription: string;
  accountsEmptyTitle: string;
  accountsEmptyDescription: string;
  createAccount: string;
  account: string;
  category: string;
  amount: string;
  description: string;
  payee: string;
  payeeOptional: string;
  date: string;
  time: string;
  review: string;
  confirm: string;
  edit: string;
  failedTitle: string;
  uncertainTitle: string;
  uncertainDescription: string;
  checkStatus: string;
  currency: string;
  noPayee: string;
  loadMore: string;
  loadingMore: string;
};

type ExpenseEditorScreenProps = {
  remoteState: FeatureRemoteState;
  canManage: boolean;
  stage: "edit" | "review";
  draft: ExpenseDraft;
  errors: ExpenseDraftErrors;
  accounts: AccountOption[];
  categoryOptions: readonly ChoiceOption<ExpenseCategory>[];
  currency: string;
  command: PostExpenseRequest | null;
  confirmation: CashConfirmationState;
  errorMessage?: string;
  hasMoreAccounts: boolean;
  isLoadingMoreAccounts: boolean;
  effect: string;
  copy: ExpenseEditorCopy;
  formatMoney: (minorUnits: string, currency: string) => string;
  onDraftChange: (next: ExpenseDraft) => void;
  onPrepareReview: () => void;
  onConfirm: () => void;
  onEdit: () => void;
  onCheckStatus: () => void;
  onCreateAccount: () => void;
  onRetry: () => void;
  onLoadMoreAccounts: () => void;
};

export function ExpenseEditorScreen({
  remoteState,
  canManage,
  stage,
  draft,
  errors,
  accounts,
  categoryOptions,
  currency,
  command,
  confirmation,
  errorMessage,
  hasMoreAccounts,
  isLoadingMoreAccounts,
  effect,
  copy,
  formatMoney,
  onDraftChange,
  onPrepareReview,
  onConfirm,
  onEdit,
  onCheckStatus,
  onCreateAccount,
  onRetry,
  onLoadMoreAccounts,
}: ExpenseEditorScreenProps) {
  const authorizedState = requireFeatureManageAccess(remoteState, canManage);
  const accountOptions = accounts.map(({ id, name }) => ({ value: id, label: name }));
  const selectedAccount = accounts.find(({ id }) => id === command?.accountId);
  const selectedCategory = categoryOptions.find(({ value }) => value === command?.category);

  return (
    <FeatureBoundary copy={copy} onRetry={onRetry} state={authorizedState}>
      <Page width="form">
        <ScreenHeader
          description={stage === "review" ? copy.reviewDescription : copy.newDescription}
          eyebrow={copy.eyebrow}
          title={stage === "review" ? copy.reviewTitle : copy.newTitle}
        />

        {accounts.length === 0 ? (
          <View className="gap-3 border-y border-line py-8 dark:border-[#304239]">
            <Text
              accessibilityRole="header"
              className="text-xl font-black text-ink dark:text-white"
            >
              {copy.accountsEmptyTitle}
            </Text>
            <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
              {copy.accountsEmptyDescription}
            </Text>
            <Button
              className="self-start"
              label={copy.createAccount}
              onPress={onCreateAccount}
              variant="accent"
            />
          </View>
        ) : stage === "review" && command && selectedAccount && selectedCategory ? (
          <ExpenseReview
            accountName={selectedAccount.name}
            categoryLabel={selectedCategory.label}
            command={command}
            copy={copy}
            effect={effect}
            errorMessage={errorMessage}
            formatMoney={formatMoney}
            onCheckStatus={onCheckStatus}
            onConfirm={onConfirm}
            onEdit={onEdit}
            state={confirmation}
          />
        ) : (
          <View className="gap-7 border-y border-line py-7 dark:border-[#304239]">
            <ChoiceList
              label={copy.account}
              onChange={(accountId) => onDraftChange({ ...draft, accountId })}
              options={accountOptions}
              value={draft.accountId}
            />
            {errors.accountId ? (
              <Text accessibilityRole="alert" className="text-xs text-danger">
                {errors.accountId}
              </Text>
            ) : null}
            {hasMoreAccounts ? (
              <Button
                className="self-start"
                label={isLoadingMoreAccounts ? copy.loadingMore : copy.loadMore}
                loading={isLoadingMoreAccounts}
                onPress={onLoadMoreAccounts}
                size="sm"
                variant="secondary"
              />
            ) : null}
            <ChoiceList
              label={copy.category}
              onChange={(category) => onDraftChange({ ...draft, category })}
              options={categoryOptions}
              value={draft.category}
            />
            <Field
              error={errors.amount}
              keyboardType="decimal-pad"
              label={copy.amount}
              onChangeText={(amount) => onDraftChange({ ...draft, amount })}
              trailing={<Text className="font-bold text-ink-muted">{currency}</Text>}
              value={draft.amount}
            />
            <Field
              error={errors.description}
              label={copy.description}
              maxLength={240}
              onChangeText={(description) => onDraftChange({ ...draft, description })}
              value={draft.description}
            />
            <Field
              error={errors.payee}
              label={copy.payeeOptional}
              maxLength={120}
              onChangeText={(payee) => onDraftChange({ ...draft, payee })}
              value={draft.payee}
            />
            <View className="gap-5 sm:flex-row">
              <View className="flex-1">
                <Field
                  error={errors.localDate}
                  label={copy.date}
                  onChangeText={(localDate) => onDraftChange({ ...draft, localDate })}
                  value={draft.localDate}
                />
              </View>
              <View className="flex-1">
                <Field
                  error={errors.localTime}
                  label={copy.time}
                  onChangeText={(localTime) => onDraftChange({ ...draft, localTime })}
                  value={draft.localTime}
                />
              </View>
            </View>
            <Button
              className="self-start"
              label={copy.review}
              onPress={onPrepareReview}
              variant="accent"
            />
          </View>
        )}
      </Page>
    </FeatureBoundary>
  );
}
