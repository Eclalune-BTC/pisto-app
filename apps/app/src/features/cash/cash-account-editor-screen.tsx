import { Text, View } from "react-native";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type {
  CashAccount,
  CashAccountKind,
  CreateCashAccountRequest,
  UpdateCashAccountRequest,
} from "../../../../../packages/contracts/src/cash.ts";
import { CashOperationReview, type CashOperationReviewCopy } from "./cash-operation-review";
import { ChoiceList, type ChoiceOption } from "./choice-list";
import {
  FeatureBoundary,
  type FeatureBoundaryCopy,
  type FeatureRemoteState,
  requireFeatureManageAccess,
} from "./feature-boundary";
import type { CashConfirmationState } from "./state";

export type CashAccountOpeningMode = "zero" | "in" | "out";

export type CashAccountEditorDraft = {
  name: string;
  kind: CashAccountKind;
  negativePolicy: "protected" | "allowed";
  openingMode: CashAccountOpeningMode;
  openingAmount: string;
  openingReason: string;
  openingLocalDate: string;
  openingLocalTime: string;
};

export type CashAccountEditorErrors = Partial<Record<keyof CashAccountEditorDraft, string>>;

export type CashAccountEditorCopy = FeatureBoundaryCopy &
  CashOperationReviewCopy & {
    eyebrow: string;
    createTitle: string;
    createDescription: string;
    updateTitle: string;
    updateDescription: string;
    reviewTitle: string;
    reviewDescription: string;
    name: string;
    kind: string;
    negativePolicy: string;
    protectedBalance: string;
    allowNegative: string;
    openingBalance: string;
    startAtZero: string;
    moneyIn: string;
    moneyOut: string;
    openingAmount: string;
    openingReason: string;
    date: string;
    time: string;
    currency: string;
    review: string;
    cancel: string;
  };

type CashAccountEditorScreenProps = {
  remoteState: FeatureRemoteState;
  canManage: boolean;
  mode: "create" | "update";
  stage: "edit" | "review";
  account: CashAccount | null;
  draft: CashAccountEditorDraft;
  errors: CashAccountEditorErrors;
  kindOptions: readonly ChoiceOption<CashAccountKind>[];
  currency: string;
  command: CreateCashAccountRequest | UpdateCashAccountRequest | null;
  confirmation: CashConfirmationState;
  errorMessage?: string;
  effect: string;
  copy: CashAccountEditorCopy;
  formatMoney: (minorUnits: string, currency: string) => string;
  onDraftChange: (next: CashAccountEditorDraft) => void;
  onPrepareReview: () => void;
  onConfirm: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onCheckStatus: () => void;
  onRetry: () => void;
};

function isCreateCommand(
  command: CreateCashAccountRequest | UpdateCashAccountRequest,
): command is CreateCashAccountRequest {
  return "currency" in command;
}

export function CashAccountEditorScreen({
  remoteState,
  canManage,
  mode,
  stage,
  account,
  draft,
  errors,
  kindOptions,
  currency,
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
}: CashAccountEditorScreenProps) {
  const authorizedState = requireFeatureManageAccess(remoteState, canManage);
  const reviewing = stage === "review" && command !== null;
  const createCommand = reviewing && isCreateCommand(command) ? command : null;
  const reviewName = command?.name ?? account?.name ?? draft.name;
  const reviewKind = command?.kind ?? account?.kind ?? draft.kind;
  const reviewKindLabel =
    kindOptions.find(({ value }) => value === reviewKind)?.label ?? reviewKind;
  const reviewAllowsNegative =
    command?.allowNegativeBalance ?? account?.allowNegativeBalance ?? false;
  const openingValue = createCommand?.opening
    ? `${createCommand.opening.direction === "in" ? copy.moneyIn : copy.moneyOut} - ${formatMoney(createCommand.opening.amountMinorUnits, createCommand.currency)}`
    : copy.startAtZero;

  return (
    <FeatureBoundary copy={copy} onRetry={onRetry} state={authorizedState}>
      <Page width="form">
        <ScreenHeader
          description={
            reviewing
              ? copy.reviewDescription
              : mode === "create"
                ? copy.createDescription
                : copy.updateDescription
          }
          eyebrow={copy.eyebrow}
          title={
            reviewing ? copy.reviewTitle : mode === "create" ? copy.createTitle : copy.updateTitle
          }
        />

        {reviewing ? (
          <CashOperationReview
            copy={copy}
            effect={effect}
            errorMessage={errorMessage}
            onCheckStatus={onCheckStatus}
            onConfirm={onConfirm}
            onEdit={onEdit}
            rows={[
              { label: copy.name, value: reviewName },
              { label: copy.kind, value: reviewKindLabel },
              {
                label: copy.negativePolicy,
                value: reviewAllowsNegative ? copy.allowNegative : copy.protectedBalance,
              },
              ...(createCommand
                ? [
                    { label: copy.currency, value: createCommand.currency },
                    { label: copy.openingBalance, value: openingValue },
                  ]
                : []),
            ]}
            state={confirmation}
          />
        ) : (
          <View className="gap-7 border-y border-line py-7 dark:border-[#304239]">
            <Field
              error={errors.name}
              label={copy.name}
              maxLength={80}
              onChangeText={(name) => onDraftChange({ ...draft, name })}
              value={draft.name}
            />
            <ChoiceList
              label={copy.kind}
              onChange={(kind) => onDraftChange({ ...draft, kind })}
              options={kindOptions}
              value={draft.kind}
            />
            <ChoiceList
              label={copy.negativePolicy}
              onChange={(negativePolicy) => onDraftChange({ ...draft, negativePolicy })}
              options={[
                { label: copy.protectedBalance, value: "protected" },
                { label: copy.allowNegative, value: "allowed" },
              ]}
              value={draft.negativePolicy}
            />

            {mode === "create" ? (
              <>
                <ChoiceList
                  label={copy.openingBalance}
                  onChange={(openingMode) => onDraftChange({ ...draft, openingMode })}
                  options={[
                    { label: copy.startAtZero, value: "zero" },
                    { label: copy.moneyIn, value: "in" },
                    { label: copy.moneyOut, value: "out" },
                  ]}
                  value={draft.openingMode}
                />
                {draft.openingMode !== "zero" ? (
                  <View className="gap-5">
                    <Field
                      error={errors.openingAmount}
                      keyboardType="decimal-pad"
                      label={copy.openingAmount}
                      onChangeText={(openingAmount) => onDraftChange({ ...draft, openingAmount })}
                      trailing={<Text className="font-bold text-ink-muted">{currency}</Text>}
                      value={draft.openingAmount}
                    />
                    <Field
                      error={errors.openingReason}
                      label={copy.openingReason}
                      maxLength={240}
                      onChangeText={(openingReason) => onDraftChange({ ...draft, openingReason })}
                      value={draft.openingReason}
                    />
                    <View className="gap-5 sm:flex-row">
                      <View className="flex-1">
                        <Field
                          error={errors.openingLocalDate}
                          label={copy.date}
                          onChangeText={(openingLocalDate) =>
                            onDraftChange({ ...draft, openingLocalDate })
                          }
                          value={draft.openingLocalDate}
                        />
                      </View>
                      <View className="flex-1">
                        <Field
                          error={errors.openingLocalTime}
                          label={copy.time}
                          onChangeText={(openingLocalTime) =>
                            onDraftChange({ ...draft, openingLocalTime })
                          }
                          value={draft.openingLocalTime}
                        />
                      </View>
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}

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
