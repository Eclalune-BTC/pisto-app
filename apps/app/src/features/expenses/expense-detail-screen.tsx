import type { Expense, ExpenseCategory, VoidExpenseRequest } from "@pisto/contracts";
import { Text, View } from "react-native";
import { DetailList } from "@/components/detail-list";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { CashOperationReview, type CashOperationReviewCopy } from "../cash/cash-operation-review";
import {
  FeatureBoundary,
  type FeatureBoundaryCopy,
  type FeatureRemoteState,
} from "../cash/feature-boundary";
import { cashOperationPresentation } from "../cash/operation-state";
import type { CashConfirmationState } from "../cash/state";

export type VoidExpenseDraft = {
  reason: string;
  localDate: string;
  localTime: string;
};

export type VoidExpenseDraftErrors = Partial<Record<keyof VoidExpenseDraft, string>>;

export type ExpenseDetailCopy = FeatureBoundaryCopy &
  CashOperationReviewCopy & {
    eyebrow: string;
    title: string;
    description: string;
    notFoundTitle: string;
    notFoundDescription: string;
    amount: string;
    account: string;
    category: string;
    descriptionLabel: string;
    payee: string;
    noPayee: string;
    date: string;
    time: string;
    status: string;
    posted: string;
    voided: string;
    voidReason: string;
    voidExpense: string;
    voidTitle: string;
    voidDescription: string;
    reason: string;
    reviewVoid: string;
    cancel: string;
    voidEffect: string;
    categories: Record<ExpenseCategory, string>;
  };

type ExpenseDetailScreenProps = {
  remoteState: FeatureRemoteState;
  expense: Expense | null;
  accountName: string;
  canManage: boolean;
  stage: "detail" | "void-edit" | "void-review";
  voidDraft: VoidExpenseDraft;
  voidErrors: VoidExpenseDraftErrors;
  voidCommand: VoidExpenseRequest | null;
  confirmation: CashConfirmationState;
  errorMessage?: string;
  isStale: boolean;
  copy: ExpenseDetailCopy;
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
  onBeginVoid: () => void;
  onVoidDraftChange: (next: VoidExpenseDraft) => void;
  onPrepareVoidReview: () => void;
  onConfirmVoid: () => void;
  onEditVoid: () => void;
  onCancelVoid: () => void;
  onCheckStatus: () => void;
  onRetry: () => void;
};

export function ExpenseDetailScreen({
  remoteState,
  expense,
  accountName,
  canManage,
  stage,
  voidDraft,
  voidErrors,
  voidCommand,
  confirmation,
  errorMessage,
  isStale,
  copy,
  formatMoney,
  onBeginVoid,
  onVoidDraftChange,
  onPrepareVoidReview,
  onConfirmVoid,
  onEditVoid,
  onCancelVoid,
  onCheckStatus,
  onRetry,
}: ExpenseDetailScreenProps) {
  const operation = cashOperationPresentation({
    remoteKind: remoteState.kind,
    canManage,
    confirmation,
  });
  const editingVoid = stage === "void-edit";
  const reviewingVoid = stage === "void-review" && voidCommand !== null;

  return (
    <FeatureBoundary copy={copy} onRetry={onRetry} state={remoteState}>
      <Page width="form">
        <ScreenHeader
          description={stage === "detail" ? copy.description : copy.voidDescription}
          eyebrow={copy.eyebrow}
          title={stage === "detail" ? copy.title : copy.voidTitle}
        />

        {isStale ? <StaleNotice /> : null}

        {expense === null ? (
          <View className="gap-3 border-y border-line py-8 dark:border-[#304239]">
            <Text
              accessibilityRole="header"
              className="text-xl font-black text-ink dark:text-white"
            >
              {copy.notFoundTitle}
            </Text>
            <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
              {copy.notFoundDescription}
            </Text>
          </View>
        ) : reviewingVoid ? (
          <CashOperationReview
            copy={copy}
            effect={copy.voidEffect}
            errorMessage={errorMessage}
            onCheckStatus={onCheckStatus}
            onConfirm={onConfirmVoid}
            onEdit={onEditVoid}
            rows={[
              {
                label: copy.amount,
                value: formatMoney(
                  expense.amountMinorUnits,
                  expense.currency,
                  expense.currencyMinorUnitDigits,
                ),
              },
              { label: copy.account, value: accountName },
              { label: copy.category, value: copy.categories[expense.category] },
              { label: copy.descriptionLabel, value: expense.description },
              { label: copy.reason, value: voidCommand.reason },
              { label: copy.date, value: voidCommand.occurredLocalDate },
              { label: copy.time, value: voidCommand.occurredLocalTime },
            ]}
            state={confirmation}
          />
        ) : editingVoid ? (
          <View className="gap-7 border-y border-line py-7 dark:border-[#304239]">
            <Field
              error={voidErrors.reason}
              label={copy.reason}
              maxLength={240}
              onChangeText={(reason) => onVoidDraftChange({ ...voidDraft, reason })}
              value={voidDraft.reason}
            />
            <View className="gap-5 sm:flex-row">
              <View className="flex-1">
                <Field
                  error={voidErrors.localDate}
                  label={copy.date}
                  onChangeText={(localDate) => onVoidDraftChange({ ...voidDraft, localDate })}
                  value={voidDraft.localDate}
                />
              </View>
              <View className="flex-1">
                <Field
                  error={voidErrors.localTime}
                  label={copy.time}
                  onChangeText={(localTime) => onVoidDraftChange({ ...voidDraft, localTime })}
                  value={voidDraft.localTime}
                />
              </View>
            </View>
            <View className="gap-3 sm:flex-row">
              <Button label={copy.reviewVoid} onPress={onPrepareVoidReview} variant="danger" />
              <Button label={copy.cancel} onPress={onCancelVoid} variant="secondary" />
            </View>
          </View>
        ) : (
          <View className="gap-7">
            <DetailList
              items={[
                {
                  label: copy.amount,
                  value: formatMoney(
                    expense.amountMinorUnits,
                    expense.currency,
                    expense.currencyMinorUnitDigits,
                  ),
                },
                { label: copy.account, value: accountName },
                { label: copy.category, value: copy.categories[expense.category] },
                { label: copy.descriptionLabel, value: expense.description },
                { label: copy.payee, value: expense.payee ?? copy.noPayee },
                { label: copy.date, value: expense.occurredLocalDate },
                { label: copy.time, value: expense.occurredLocalTime },
                {
                  label: copy.status,
                  value: expense.status === "posted" ? copy.posted : copy.voided,
                },
                ...(expense.voidReason
                  ? [{ label: copy.voidReason, value: expense.voidReason }]
                  : []),
              ]}
            />
            {expense.status === "posted" && operation.canStart ? (
              <Button
                className="self-start"
                label={copy.voidExpense}
                onPress={onBeginVoid}
                variant="danger"
              />
            ) : null}
          </View>
        )}
      </Page>
    </FeatureBoundary>
  );
}
