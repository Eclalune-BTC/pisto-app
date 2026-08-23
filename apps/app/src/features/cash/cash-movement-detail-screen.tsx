import { Text, View } from "react-native";
import { DetailList } from "@/components/detail-list";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type {
  CashMovement,
  CashMovementAction,
  ReverseCashMovementRequest,
} from "../../../../../packages/contracts/src/cash.ts";
import { CashOperationReview, type CashOperationReviewCopy } from "./cash-operation-review";
import {
  FeatureBoundary,
  type FeatureBoundaryCopy,
  type FeatureRemoteState,
} from "./feature-boundary";
import { cashOperationPresentation } from "./operation-state";
import type { CashConfirmationState } from "./state";

export type CashReversalDraft = {
  reason: string;
  localDate: string;
  localTime: string;
};

export type CashReversalErrors = Partial<Record<keyof CashReversalDraft, string>>;

export type CashMovementDetailCopy = FeatureBoundaryCopy &
  CashOperationReviewCopy & {
    eyebrow: string;
    title: string;
    description: string;
    reverseTitle: string;
    reverseDescription: string;
    notFoundTitle: string;
    notFoundDescription: string;
    account: string;
    action: string;
    amount: string;
    reason: string;
    date: string;
    time: string;
    timeZone: string;
    reverseAdjustment: string;
    reviewReversal: string;
    cancel: string;
    reversalUnavailable: string;
    reversalEffect: string;
    movementActions: Record<CashMovementAction, string>;
  };

type CashMovementDetailScreenProps = {
  remoteState: FeatureRemoteState;
  movement: CashMovement | null;
  accountName: string;
  canManage: boolean;
  canReverse: boolean;
  stage: "detail" | "reverse-edit" | "reverse-review";
  reversalDraft: CashReversalDraft;
  reversalErrors: CashReversalErrors;
  reversalCommand: ReverseCashMovementRequest | null;
  confirmation: CashConfirmationState;
  errorMessage?: string;
  copy: CashMovementDetailCopy;
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
  onBeginReversal: () => void;
  onReversalDraftChange: (next: CashReversalDraft) => void;
  onPrepareReversalReview: () => void;
  onConfirmReversal: () => void;
  onEditReversal: () => void;
  onCancelReversal: () => void;
  onCheckStatus: () => void;
  onRetry: () => void;
};

export function CashMovementDetailScreen({
  remoteState,
  movement,
  accountName,
  canManage,
  canReverse,
  stage,
  reversalDraft,
  reversalErrors,
  reversalCommand,
  confirmation,
  errorMessage,
  copy,
  formatMoney,
  onBeginReversal,
  onReversalDraftChange,
  onPrepareReversalReview,
  onConfirmReversal,
  onEditReversal,
  onCancelReversal,
  onCheckStatus,
  onRetry,
}: CashMovementDetailScreenProps) {
  const operation = cashOperationPresentation({
    remoteKind: remoteState.kind,
    canManage,
    confirmation,
  });
  const editingReversal = stage === "reverse-edit";
  const reviewingReversal = stage === "reverse-review" && reversalCommand !== null;
  const adjustment = movement?.action === "adjustment_in" || movement?.action === "adjustment_out";

  return (
    <FeatureBoundary copy={copy} onRetry={onRetry} state={remoteState}>
      <Page width="form">
        <ScreenHeader
          description={stage === "detail" ? copy.description : copy.reverseDescription}
          eyebrow={copy.eyebrow}
          title={stage === "detail" ? copy.title : copy.reverseTitle}
        />

        {movement === null ? (
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
        ) : reviewingReversal ? (
          <CashOperationReview
            copy={copy}
            effect={copy.reversalEffect}
            errorMessage={errorMessage}
            onCheckStatus={onCheckStatus}
            onConfirm={onConfirmReversal}
            onEdit={onEditReversal}
            rows={[
              { label: copy.account, value: accountName },
              {
                label: copy.amount,
                value: formatMoney(
                  movement.deltaMinorUnits,
                  movement.currency,
                  movement.currencyMinorUnitDigits,
                ),
              },
              { label: copy.reason, value: reversalCommand.reason },
              { label: copy.date, value: reversalCommand.occurredLocalDate },
              { label: copy.time, value: reversalCommand.occurredLocalTime },
            ]}
            state={confirmation}
          />
        ) : editingReversal ? (
          <View className="gap-7 border-y border-line py-7 dark:border-[#304239]">
            <Field
              error={reversalErrors.reason}
              label={copy.reason}
              maxLength={240}
              onChangeText={(reason) => onReversalDraftChange({ ...reversalDraft, reason })}
              value={reversalDraft.reason}
            />
            <View className="gap-5 sm:flex-row">
              <View className="flex-1">
                <Field
                  error={reversalErrors.localDate}
                  label={copy.date}
                  onChangeText={(localDate) =>
                    onReversalDraftChange({ ...reversalDraft, localDate })
                  }
                  value={reversalDraft.localDate}
                />
              </View>
              <View className="flex-1">
                <Field
                  error={reversalErrors.localTime}
                  label={copy.time}
                  onChangeText={(localTime) =>
                    onReversalDraftChange({ ...reversalDraft, localTime })
                  }
                  value={reversalDraft.localTime}
                />
              </View>
            </View>
            <View className="gap-3 sm:flex-row">
              <Button
                label={copy.reviewReversal}
                onPress={onPrepareReversalReview}
                variant="danger"
              />
              <Button label={copy.cancel} onPress={onCancelReversal} variant="secondary" />
            </View>
          </View>
        ) : (
          <View className="gap-7">
            <DetailList
              items={[
                { label: copy.account, value: accountName },
                { label: copy.action, value: copy.movementActions[movement.action] },
                {
                  label: copy.amount,
                  value: formatMoney(
                    movement.deltaMinorUnits,
                    movement.currency,
                    movement.currencyMinorUnitDigits,
                  ),
                },
                { label: copy.reason, value: movement.reason },
                { label: copy.date, value: movement.occurredLocalDate },
                { label: copy.time, value: movement.occurredLocalTime },
                { label: copy.timeZone, value: movement.timeZone },
              ]}
            />
            {adjustment && canReverse && operation.canStart ? (
              <Button
                className="self-start"
                label={copy.reverseAdjustment}
                onPress={onBeginReversal}
                variant="danger"
              />
            ) : adjustment && !canReverse ? (
              <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
                {copy.reversalUnavailable}
              </Text>
            ) : null}
          </View>
        )}
      </Page>
    </FeatureBoundary>
  );
}
