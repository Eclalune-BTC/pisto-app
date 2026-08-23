import { Text, View } from "react-native";
import { DetailList } from "@/components/detail-list";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import type {
  ArchiveCashAccountRequest,
  CashAccount,
  CashAccountKind,
  CashMovement,
  CashMovementAction,
} from "../../../../../packages/contracts/src/cash.ts";
import { CashMovementList } from "./cash-movement-list";
import { CashOperationReview, type CashOperationReviewCopy } from "./cash-operation-review";
import {
  FeatureBoundary,
  type FeatureBoundaryCopy,
  type FeatureRemoteState,
} from "./feature-boundary";
import { cashOperationPresentation } from "./operation-state";
import type { CashConfirmationState } from "./state";

export type CashAccountDetailCopy = FeatureBoundaryCopy &
  CashOperationReviewCopy & {
    eyebrow: string;
    title: string;
    description: string;
    archiveTitle: string;
    archiveDescription: string;
    notFoundTitle: string;
    notFoundDescription: string;
    name: string;
    kind: string;
    balance: string;
    currency: string;
    negativePolicy: string;
    protectedBalance: string;
    allowNegative: string;
    status: string;
    active: string;
    archived: string;
    editAccount: string;
    recordAdjustment: string;
    transfer: string;
    archiveAccount: string;
    movementsTitle: string;
    noMovements: string;
    archiveEffect: string;
    accountKinds: Record<CashAccountKind, string>;
    movementActions: Record<CashMovementAction, string>;
    loadMore: string;
    loadingMore: string;
  };

type CashAccountDetailScreenProps = {
  remoteState: FeatureRemoteState;
  account: CashAccount | null;
  movements: CashMovement[];
  canManage: boolean;
  stage: "detail" | "archive-review";
  archiveCommand: ArchiveCashAccountRequest | null;
  confirmation: CashConfirmationState;
  errorMessage?: string;
  hasMoreMovements: boolean;
  isLoadingMoreMovements: boolean;
  isStale: boolean;
  copy: CashAccountDetailCopy;
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
  onEditAccount: () => void;
  onRecordAdjustment: () => void;
  onTransfer: () => void;
  onOpenMovement: (movementId: string) => void;
  onBeginArchive: () => void;
  onConfirmArchive: () => void;
  onCancelArchive: () => void;
  onCheckStatus: () => void;
  onRetry: () => void;
  onLoadMoreMovements: () => void;
};

export function CashAccountDetailScreen({
  remoteState,
  account,
  movements,
  canManage,
  stage,
  archiveCommand,
  confirmation,
  errorMessage,
  hasMoreMovements,
  isLoadingMoreMovements,
  isStale,
  copy,
  formatMoney,
  onEditAccount,
  onRecordAdjustment,
  onTransfer,
  onOpenMovement,
  onBeginArchive,
  onConfirmArchive,
  onCancelArchive,
  onCheckStatus,
  onRetry,
  onLoadMoreMovements,
}: CashAccountDetailScreenProps) {
  const operation = cashOperationPresentation({
    remoteKind: remoteState.kind,
    canManage,
    confirmation,
  });
  const reviewingArchive = stage === "archive-review" && archiveCommand !== null;

  return (
    <FeatureBoundary copy={copy} onRetry={onRetry} state={remoteState}>
      <Page contentContainerClassName="gap-9">
        <ScreenHeader
          description={reviewingArchive ? copy.archiveDescription : copy.description}
          eyebrow={copy.eyebrow}
          title={reviewingArchive ? copy.archiveTitle : (account?.name ?? copy.title)}
        />

        {isStale ? <StaleNotice /> : null}

        {account === null ? (
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
        ) : reviewingArchive ? (
          <CashOperationReview
            copy={copy}
            effect={copy.archiveEffect}
            errorMessage={errorMessage}
            onCheckStatus={onCheckStatus}
            onConfirm={onConfirmArchive}
            onEdit={onCancelArchive}
            rows={[
              { label: copy.name, value: account.name },
              {
                label: copy.balance,
                value: formatMoney(
                  account.balanceMinorUnits,
                  account.currency,
                  account.currencyMinorUnitDigits,
                ),
              },
              { label: copy.status, value: copy.active },
            ]}
            state={confirmation}
          />
        ) : (
          <>
            <DetailList
              items={[
                { label: copy.kind, value: copy.accountKinds[account.kind] },
                {
                  label: copy.balance,
                  value: formatMoney(
                    account.balanceMinorUnits,
                    account.currency,
                    account.currencyMinorUnitDigits,
                  ),
                },
                { label: copy.currency, value: account.currency },
                {
                  label: copy.negativePolicy,
                  value: account.allowNegativeBalance ? copy.allowNegative : copy.protectedBalance,
                },
                {
                  label: copy.status,
                  value: account.status === "active" ? copy.active : copy.archived,
                },
              ]}
            />

            {account.status === "active" && operation.canStart ? (
              <View className="gap-3 sm:flex-row sm:flex-wrap">
                <Button label={copy.editAccount} onPress={onEditAccount} variant="secondary" />
                <Button
                  label={copy.recordAdjustment}
                  onPress={onRecordAdjustment}
                  variant="accent"
                />
                <Button label={copy.transfer} onPress={onTransfer} variant="secondary" />
                <Button label={copy.archiveAccount} onPress={onBeginArchive} variant="danger" />
              </View>
            ) : null}

            <View className="gap-4">
              <Text
                accessibilityRole="header"
                className="text-xl font-black text-ink dark:text-white"
              >
                {copy.movementsTitle}
              </Text>
              <CashMovementList
                actionLabels={copy.movementActions}
                formatMoney={formatMoney}
                movements={movements}
                noMovements={copy.noMovements}
                onOpenMovement={onOpenMovement}
              />
              {hasMoreMovements ? (
                <Button
                  className="self-start"
                  label={isLoadingMoreMovements ? copy.loadingMore : copy.loadMore}
                  loading={isLoadingMoreMovements}
                  onPress={onLoadMoreMovements}
                  variant="secondary"
                />
              ) : null}
            </View>
          </>
        )}
      </Page>
    </FeatureBoundary>
  );
}
