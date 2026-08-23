import { Text, View } from "react-native";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type {
  CashAccount,
  CashMovementDirection,
  RecordCashAdjustmentRequest,
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

export type CashAdjustmentDraft = {
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
  };

type CashAdjustmentScreenProps = {
  remoteState: FeatureRemoteState;
  canManage: boolean;
  account: CashAccount | null;
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
};

export function CashAdjustmentScreen({
  remoteState,
  canManage,
  account,
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
}: CashAdjustmentScreenProps) {
  const authorizedState = requireFeatureManageAccess(remoteState, canManage);
  const reviewing = stage === "review" && command !== null;

  return (
    <FeatureBoundary copy={copy} onRetry={onRetry} state={authorizedState}>
      <Page width="form">
        <ScreenHeader
          description={reviewing ? copy.reviewDescription : copy.description}
          eyebrow={copy.eyebrow}
          title={reviewing ? copy.reviewTitle : copy.title}
        />

        {account === null || account.status !== "active" ? (
          <View className="gap-3 border-y border-line py-8 dark:border-[#304239]">
            <Text
              accessibilityRole="header"
              className="text-xl font-black text-ink dark:text-white"
            >
              {copy.accountUnavailableTitle}
            </Text>
            <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
              {copy.accountUnavailableDescription}
            </Text>
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
          <View className="gap-7 border-y border-line py-7 dark:border-[#304239]">
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
              trailing={<Text className="font-bold text-ink-muted">{account.currency}</Text>}
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
              <Button label={copy.review} onPress={onPrepareReview} variant="accent" />
              <Button label={copy.cancel} onPress={onCancel} variant="secondary" />
            </View>
          </View>
        )}
      </Page>
    </FeatureBoundary>
  );
}
