import type {
  CashAccount,
  CashMovementDirection,
  RecordCashAdjustmentRequest,
} from "@pisto/contracts";
import { View } from "react-native";
import {
  FeatureBoundary,
  type FeatureBoundaryCopy,
  type FeatureRemoteState,
  requireFeatureManageAccess,
} from "@/components/feature-boundary";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { Text } from "@/components/ui/text";
import { CashOperationReview, type CashOperationReviewCopy } from "./cash-operation-review";
import { ChoiceList } from "./choice-list";
import type { CashConfirmationState } from "./state";

export type CashAdjustmentDraft = {
  accountId: string;
  direction: CashMovementDirection;
  amount: string;
  reason: string;
  localDate: string;
  localTime: string;
};

export type CashAdjustmentErrors = Partial<Record<keyof CashAdjustmentDraft, string>>;

export type CashAdjustmentCopy = FeatureBoundaryCopy &
  CashOperationReviewCopy & {
    eyebrow: string;
    title: string;
    description: string;
    reviewTitle: string;
    reviewDescription: string;
    accountUnavailableTitle: string;
    accountUnavailableDescription: string;
    createAccount: string;
    account: string;
    direction: string;
    moneyIn: string;
    moneyOut: string;
    amount: string;
    reason: string;
    date: string;
    time: string;
    review: string;
    cancel: string;
    loadMore: string;
    loadingMore: string;
  };

type CashAdjustmentScreenProps = {
  remoteState: FeatureRemoteState;
  canManage: boolean;
  accounts: CashAccount[];
  reviewAccount: CashAccount | null;
  hasMoreAccounts: boolean;
  isLoadingMoreAccounts: boolean;
  stage: "edit" | "review";
  draft: CashAdjustmentDraft;
  errors: CashAdjustmentErrors;
  command: RecordCashAdjustmentRequest | null;
  confirmation: CashConfirmationState;
  errorMessage?: string;
  effect: string;
  copy: CashAdjustmentCopy;
  formatMoney: (minorUnits: string, currency: string) => string;
  onDraftChange: (next: CashAdjustmentDraft) => void;
  onPrepareReview: () => void;
  onConfirm: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onCheckStatus: () => void;
  onRetry: () => void;
  onCreateAccount: () => void;
  onLoadMoreAccounts: () => void;
};

export function CashAdjustmentScreen({
  remoteState,
  canManage,
  accounts,
  reviewAccount,
  hasMoreAccounts,
  isLoadingMoreAccounts,
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
  onCheckStatus,
  onRetry,
  onCreateAccount,
  onLoadMoreAccounts,
}: CashAdjustmentScreenProps) {
  const authorizedState = requireFeatureManageAccess(remoteState, canManage);
  if (authorizedState.kind !== "ready") {
    return (
      <FeatureBoundary copy={copy} onRetry={onRetry} state={authorizedState}>
        {null}
      </FeatureBoundary>
    );
  }
  const activeAccounts = accounts.filter(({ status }) => status === "active");
  const accountOptions = activeAccounts.map(({ id, name }) => ({ label: name, value: id }));
  const account = command ? reviewAccount : activeAccounts.find(({ id }) => id === draft.accountId);
  const reviewing = stage === "review" && command !== null;
  if (
    stage === "review" &&
    (!command || !reviewAccount || reviewAccount.id !== command.accountId)
  ) {
    throw new Error("Cash adjustment review is missing its command or account snapshot");
  }

  return (
    <FeatureBoundary copy={copy} onRetry={onRetry} state={authorizedState}>
      <Page width="form">
        <ScreenHeader
          description={reviewing ? copy.reviewDescription : copy.description}
          eyebrow={copy.eyebrow}
          title={reviewing ? copy.reviewTitle : copy.title}
        />

        {activeAccounts.length === 0 && !reviewing ? (
          <View className="gap-3 border-y border-border py-8 ">
            <Text accessibilityRole="header" className="text-xl font-heading text-foreground">
              {copy.accountUnavailableTitle}
            </Text>
            <Text className="text-sm leading-5 text-muted-foreground">
              {copy.accountUnavailableDescription}
            </Text>
            <Button
              className="self-start"
              label={copy.createAccount}
              onPress={onCreateAccount}
              variant="default"
            />
          </View>
        ) : reviewing && account ? (
          <CashOperationReview
            copy={copy}
            effect={effect}
            errorMessage={errorMessage}
            onCheckStatus={onCheckStatus}
            onConfirm={onConfirm}
            onEdit={onEdit}
            rows={[
              { label: copy.account, value: account.name },
              {
                label: copy.direction,
                value: command.direction === "in" ? copy.moneyIn : copy.moneyOut,
              },
              {
                label: copy.amount,
                value: formatMoney(command.amountMinorUnits, command.currency),
              },
              { label: copy.reason, value: command.reason },
              { label: copy.date, value: command.occurredLocalDate },
              { label: copy.time, value: command.occurredLocalTime },
            ]}
            state={confirmation}
          />
        ) : (
          <View className="gap-7 border-y border-border py-7 ">
            <SelectField
              label={copy.account}
              onChange={(accountId) => onDraftChange({ ...draft, accountId })}
              options={accountOptions}
              value={draft.accountId}
            />
            {errors.accountId ? (
              <Text accessibilityRole="alert" className="text-xs text-destructive">
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
                variant="outline"
              />
            ) : null}
            <ChoiceList
              label={copy.direction}
              onChange={(direction) => onDraftChange({ ...draft, direction })}
              options={[
                { label: copy.moneyIn, value: "in" },
                { label: copy.moneyOut, value: "out" },
              ]}
              value={draft.direction}
            />
            <Field
              error={errors.amount}
              keyboardType="decimal-pad"
              label={copy.amount}
              onChangeText={(amount) => onDraftChange({ ...draft, amount })}
              trailing={
                account ? (
                  <Text className="font-ui text-muted-foreground">{account.currency}</Text>
                ) : undefined
              }
              value={draft.amount}
            />
            <Field
              error={errors.reason}
              label={copy.reason}
              maxLength={240}
              onChangeText={(reason) => onDraftChange({ ...draft, reason })}
              value={draft.reason}
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
              <Button label={copy.review} onPress={onPrepareReview} variant="default" />
              <Button label={copy.cancel} onPress={onCancel} variant="outline" />
            </View>
          </View>
        )}
      </Page>
    </FeatureBoundary>
  );
}
