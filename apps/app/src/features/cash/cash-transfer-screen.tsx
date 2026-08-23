import { Text, View } from "react-native";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type {
  CashAccount,
  TransferCashRequest,
} from "../../../../../packages/contracts/src/cash.ts";
import { CashOperationReview, type CashOperationReviewCopy } from "./cash-operation-review";
import { ChoiceList } from "./choice-list";
import {
  FeatureBoundary,
  type FeatureBoundaryCopy,
  type FeatureRemoteState,
  requireFeatureManageAccess,
} from "./feature-boundary";
import type { CashConfirmationState } from "./state";

export type CashTransferDraft = {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  note: string;
  localDate: string;
  localTime: string;
};

export type CashTransferErrors = Partial<Record<keyof CashTransferDraft, string>>;

export type CashTransferCopy = FeatureBoundaryCopy &
  CashOperationReviewCopy & {
    eyebrow: string;
    title: string;
    description: string;
    reviewTitle: string;
    reviewDescription: string;
    accountsUnavailableTitle: string;
    accountsUnavailableDescription: string;
    createAccount: string;
    fromAccount: string;
    toAccount: string;
    amount: string;
    noteOptional: string;
    noNote: string;
    date: string;
    time: string;
    review: string;
    cancel: string;
  };

type CashTransferScreenProps = {
  remoteState: FeatureRemoteState;
  canManage: boolean;
  accounts: CashAccount[];
  stage: "edit" | "review";
  draft: CashTransferDraft;
  errors: CashTransferErrors;
  command: TransferCashRequest | null;
  confirmation: CashConfirmationState;
  errorMessage?: string;
  effect: string;
  copy: CashTransferCopy;
  formatMoney: (minorUnits: string, currency: string) => string;
  onDraftChange: (next: CashTransferDraft) => void;
  onPrepareReview: () => void;
  onConfirm: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onCreateAccount: () => void;
  onCheckStatus: () => void;
  onRetry: () => void;
};

export function CashTransferScreen({
  remoteState,
  canManage,
  accounts,
  stage,
  draft,
  errors,
  command,
  confirmation,
  errorMessage,
  effect,
  copy,
  formatMoney,
  onDraftChange,
  onPrepareReview,
  onConfirm,
  onEdit,
  onCancel,
  onCreateAccount,
  onCheckStatus,
  onRetry,
}: CashTransferScreenProps) {
  const authorizedState = requireFeatureManageAccess(remoteState, canManage);
  const activeAccounts = accounts.filter(({ status }) => status === "active");
  const options = activeAccounts.map(({ id, name }) => ({ label: name, value: id }));
  const fromAccount = activeAccounts.find(({ id }) => id === command?.fromAccountId);
  const toAccount = activeAccounts.find(({ id }) => id === command?.toAccountId);
  const reviewing =
    stage === "review" && command !== null && fromAccount !== undefined && toAccount !== undefined;
  const draftCurrency =
    activeAccounts.find(({ id }) => id === draft.fromAccountId)?.currency ??
    activeAccounts[0]?.currency;

  return (
    <FeatureBoundary copy={copy} onRetry={onRetry} state={authorizedState}>
      <Page width="form">
        <ScreenHeader
          description={reviewing ? copy.reviewDescription : copy.description}
          eyebrow={copy.eyebrow}
          title={reviewing ? copy.reviewTitle : copy.title}
        />

        {activeAccounts.length < 2 ? (
          <View className="gap-3 border-y border-line py-8 dark:border-[#304239]">
            <Text
              accessibilityRole="header"
              className="text-xl font-black text-ink dark:text-white"
            >
              {copy.accountsUnavailableTitle}
            </Text>
            <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
              {copy.accountsUnavailableDescription}
            </Text>
            <Button
              className="self-start"
              label={copy.createAccount}
              onPress={onCreateAccount}
              variant="accent"
            />
          </View>
        ) : reviewing ? (
          <CashOperationReview
            copy={copy}
            effect={effect}
            errorMessage={errorMessage}
            onCheckStatus={onCheckStatus}
            onConfirm={onConfirm}
            onEdit={onEdit}
            rows={[
              { label: copy.fromAccount, value: fromAccount.name },
              { label: copy.toAccount, value: toAccount.name },
              {
                label: copy.amount,
                value: formatMoney(command.amountMinorUnits, command.currency),
              },
              { label: copy.date, value: command.occurredLocalDate },
              { label: copy.time, value: command.occurredLocalTime },
              { label: copy.noteOptional, value: command.note ?? copy.noNote },
            ]}
            state={confirmation}
          />
        ) : (
          <View className="gap-7 border-y border-line py-7 dark:border-[#304239]">
            <ChoiceList
              label={copy.fromAccount}
              onChange={(fromAccountId) => onDraftChange({ ...draft, fromAccountId })}
              options={options}
              value={draft.fromAccountId}
            />
            {errors.fromAccountId ? (
              <Text accessibilityRole="alert" className="text-xs text-danger">
                {errors.fromAccountId}
              </Text>
            ) : null}
            <ChoiceList
              label={copy.toAccount}
              onChange={(toAccountId) => onDraftChange({ ...draft, toAccountId })}
              options={options}
              value={draft.toAccountId}
            />
            {errors.toAccountId ? (
              <Text accessibilityRole="alert" className="text-xs text-danger">
                {errors.toAccountId}
              </Text>
            ) : null}
            <Field
              error={errors.amount}
              keyboardType="decimal-pad"
              label={copy.amount}
              onChangeText={(amount) => onDraftChange({ ...draft, amount })}
              trailing={
                draftCurrency ? (
                  <Text className="font-bold text-ink-muted">{draftCurrency}</Text>
                ) : undefined
              }
              value={draft.amount}
            />
            <Field
              error={errors.note}
              label={copy.noteOptional}
              maxLength={240}
              onChangeText={(note) => onDraftChange({ ...draft, note })}
              value={draft.note}
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
            <View className="gap-3 sm:flex-row">
              <Button label={copy.review} onPress={onPrepareReview} variant="accent" />
              <Button label={copy.cancel} onPress={onCancel} variant="secondary" />
            </View>
          </View>
        )}
      </Page>
    </FeatureBoundary>
  );
}
