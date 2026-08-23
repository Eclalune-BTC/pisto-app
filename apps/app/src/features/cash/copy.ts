import type { CashAccountKind, CashMovementAction } from "@pisto/contracts";
import type { TFunction } from "i18next";

import type { CashAccountDetailCopy } from "./cash-account-detail-screen";
import type { CashAccountEditorCopy } from "./cash-account-editor-screen";
import type { CashAdjustmentCopy } from "./cash-adjustment-screen";
import type { CashMovementDetailCopy } from "./cash-movement-detail-screen";
import type { CashScreenCopy } from "./cash-screen";
import type { CashTransferCopy } from "./cash-transfer-screen";
import type { CashDraftIssue } from "./drafts";

const issueKeys = {
  "account-required": "cash.issues.accountRequired",
  "accounts-must-differ": "cash.issues.accountsMustDiffer",
  "invalid-amount": "cash.issues.invalidAmount",
  "invalid-date": "cash.issues.invalidDate",
  "invalid-time": "cash.issues.invalidTime",
  "no-changes": "cash.issues.noChanges",
  required: "cash.issues.required",
  "too-long": "cash.issues.tooLong",
} as const satisfies Record<CashDraftIssue, string>;

export function cashAccountKindLabels(t: TFunction): Record<CashAccountKind, string> {
  return {
    bank: t("cash.accountKinds.bank"),
    cash: t("cash.accountKinds.cash"),
    mobile_money: t("cash.accountKinds.mobile_money"),
    other: t("cash.accountKinds.other"),
  };
}

export function cashMovementActionLabels(t: TFunction): Record<CashMovementAction, string> {
  return {
    adjustment_in: t("cash.movementActions.adjustment_in"),
    adjustment_out: t("cash.movementActions.adjustment_out"),
    expense: t("cash.movementActions.expense"),
    opening: t("cash.movementActions.opening"),
    receivable_payment: t("cash.movementActions.receivable_payment"),
    reverse: t("cash.movementActions.reverse"),
    transfer_in: t("cash.movementActions.transfer_in"),
    transfer_out: t("cash.movementActions.transfer_out"),
  };
}

export function cashIssueMessage(t: TFunction, issue: CashDraftIssue): string {
  return t(issueKeys[issue]);
}

export function buildCashCopy(t: TFunction) {
  const accountKinds = cashAccountKindLabels(t);
  const movementActions = cashMovementActionLabels(t);
  const boundary = {
    deniedDescription: t("cash.boundary.deniedDescription"),
    deniedTitle: t("cash.boundary.deniedTitle"),
    loading: t("cash.boundary.loading"),
    offlineTitle: t("remote.offlineTitle"),
    retry: t("common.retry"),
    unavailableTitle: t("cash.boundary.unavailableTitle"),
  };
  const review = {
    confirm: t("common.confirm"),
    edit: t("common.edit"),
    failedTitle: t("cash.review.failedTitle"),
    retrySameConfirmation: t("common.retrySameConfirmation"),
    uncertainDescription: t("cash.review.uncertainDescription"),
    uncertainTitle: t("common.uncertainTitle"),
  };

  const accountDetail: CashAccountDetailCopy = {
    ...boundary,
    ...review,
    accountKinds,
    active: t("cash.accountDetail.active"),
    allowNegative: t("cash.accountDetail.allowNegative"),
    archiveAccount: t("cash.accountDetail.archiveAccount"),
    archiveDescription: t("cash.accountDetail.archiveDescription"),
    archiveEffect: t("cash.accountDetail.archiveEffect"),
    archiveTitle: t("cash.accountDetail.archiveTitle"),
    archived: t("cash.accountDetail.archived"),
    balance: t("cash.accountDetail.balance"),
    currency: t("cash.accountDetail.currency"),
    description: t("cash.accountDetail.description"),
    editAccount: t("cash.accountDetail.editAccount"),
    eyebrow: t("cash.accountDetail.eyebrow"),
    kind: t("cash.accountDetail.kind"),
    loadMore: t("common.loadMore"),
    loadingMore: t("common.loadingMore"),
    movementActions,
    movementsTitle: t("cash.accountDetail.movementsTitle"),
    name: t("cash.accountDetail.name"),
    negativePolicy: t("cash.accountDetail.negativePolicy"),
    noMovements: t("cash.accountDetail.noMovements"),
    notFoundDescription: t("cash.accountDetail.notFoundDescription"),
    notFoundTitle: t("cash.accountDetail.notFoundTitle"),
    protectedBalance: t("cash.accountDetail.protectedBalance"),
    recordAdjustment: t("cash.accountDetail.recordAdjustment"),
    status: t("cash.accountDetail.status"),
    title: t("cash.accountDetail.title"),
    transfer: t("cash.accountDetail.transfer"),
  };

  const accountEditor: CashAccountEditorCopy = {
    ...boundary,
    ...review,
    allowNegative: t("cash.accountEditor.allowNegative"),
    cancel: t("common.cancel"),
    createDescription: t("cash.accountEditor.createDescription"),
    createTitle: t("cash.accountEditor.createTitle"),
    currency: t("cash.accountEditor.currency"),
    date: t("cash.accountEditor.date"),
    eyebrow: t("cash.accountEditor.eyebrow"),
    kind: t("cash.accountEditor.kind"),
    moneyIn: t("cash.accountEditor.moneyIn"),
    moneyOut: t("cash.accountEditor.moneyOut"),
    name: t("cash.accountEditor.name"),
    negativePolicy: t("cash.accountEditor.negativePolicy"),
    openingAmount: t("cash.accountEditor.openingAmount"),
    openingBalance: t("cash.accountEditor.openingBalance"),
    openingReason: t("cash.accountEditor.openingReason"),
    protectedBalance: t("cash.accountEditor.protectedBalance"),
    review: t("cash.accountEditor.review"),
    reviewDescription: t("cash.accountEditor.reviewDescription"),
    reviewTitle: t("cash.accountEditor.reviewTitle"),
    startAtZero: t("cash.accountEditor.startAtZero"),
    time: t("cash.accountEditor.time"),
    updateDescription: t("cash.accountEditor.updateDescription"),
    updateTitle: t("cash.accountEditor.updateTitle"),
  };

  const adjustment: CashAdjustmentCopy = {
    ...boundary,
    ...review,
    account: t("cash.adjustment.account"),
    accountUnavailableDescription: t("cash.adjustment.accountUnavailableDescription"),
    accountUnavailableTitle: t("cash.adjustment.accountUnavailableTitle"),
    amount: t("cash.adjustment.amount"),
    cancel: t("common.cancel"),
    createAccount: t("cash.adjustment.createAccount"),
    date: t("cash.adjustment.date"),
    description: t("cash.adjustment.description"),
    direction: t("cash.adjustment.direction"),
    eyebrow: t("cash.adjustment.eyebrow"),
    loadMore: t("common.loadMore"),
    loadingMore: t("common.loadingMore"),
    moneyIn: t("cash.adjustment.moneyIn"),
    moneyOut: t("cash.adjustment.moneyOut"),
    reason: t("cash.adjustment.reason"),
    review: t("cash.adjustment.review"),
    reviewDescription: t("cash.adjustment.reviewDescription"),
    reviewTitle: t("cash.adjustment.reviewTitle"),
    time: t("cash.adjustment.time"),
    title: t("cash.adjustment.title"),
  };

  const transfer: CashTransferCopy = {
    ...boundary,
    ...review,
    accountsUnavailableDescription: t("cash.transfer.accountsUnavailableDescription"),
    accountsUnavailableTitle: t("cash.transfer.accountsUnavailableTitle"),
    amount: t("cash.transfer.amount"),
    cancel: t("common.cancel"),
    createAccount: t("cash.transfer.createAccount"),
    date: t("cash.transfer.date"),
    description: t("cash.transfer.description"),
    eyebrow: t("cash.transfer.eyebrow"),
    fromAccount: t("cash.transfer.fromAccount"),
    loadMore: t("common.loadMore"),
    loadingMore: t("common.loadingMore"),
    noNote: t("cash.transfer.noNote"),
    noteOptional: t("cash.transfer.noteOptional"),
    review: t("cash.transfer.review"),
    reviewDescription: t("cash.transfer.reviewDescription"),
    reviewTitle: t("cash.transfer.reviewTitle"),
    time: t("cash.transfer.time"),
    title: t("cash.transfer.title"),
    toAccount: t("cash.transfer.toAccount"),
  };

  const movementDetail: CashMovementDetailCopy = {
    ...boundary,
    ...review,
    account: t("cash.movementDetail.account"),
    action: t("cash.movementDetail.action"),
    amount: t("cash.movementDetail.amount"),
    backToAccount: t("cash.movementDetail.backToAccount"),
    cancel: t("common.cancel"),
    date: t("cash.movementDetail.date"),
    description: t("cash.movementDetail.description"),
    eyebrow: t("cash.movementDetail.eyebrow"),
    movementActions,
    notFoundDescription: t("cash.movementDetail.notFoundDescription"),
    notFoundTitle: t("cash.movementDetail.notFoundTitle"),
    reason: t("cash.movementDetail.reason"),
    reversalEffect: t("cash.movementDetail.reversalEffect"),
    reversalUnavailable: t("cash.movementDetail.reversalUnavailable"),
    reverseAdjustment: t("cash.movementDetail.reverseAdjustment"),
    reverseDescription: t("cash.movementDetail.reverseDescription"),
    reverseTitle: t("cash.movementDetail.reverseTitle"),
    reviewReversal: t("cash.movementDetail.reviewReversal"),
    time: t("cash.movementDetail.time"),
    timeZone: t("cash.movementDetail.timeZone"),
    title: t("cash.movementDetail.title"),
  };

  const overview = (businessName: string): CashScreenCopy => ({
    ...boundary,
    accountFilter: t("cash.overview.accountFilter"),
    accountsTitle: t("cash.overview.accountsTitle"),
    active: t("cash.overview.active"),
    activeAccounts: t("cash.overview.activeAccounts"),
    allAccounts: t("cash.overview.allAccounts"),
    archived: t("cash.overview.archived"),
    archivedAccounts: t("cash.overview.archivedAccounts"),
    createAccount: t("cash.overview.createAccount"),
    description: t("cash.overview.description", { business: businessName }),
    emptyDescription: t("cash.overview.emptyDescription"),
    emptyTitle: t("cash.overview.emptyTitle"),
    eyebrow: t("cash.overview.eyebrow"),
    loadMore: t("common.loadMore"),
    loadingMore: t("common.loadingMore"),
    movementActions,
    movementsTitle: t("cash.overview.movementsTitle"),
    mutationFailedTitle: review.failedTitle,
    negativeAllowed: t("cash.overview.negativeAllowed"),
    noMovements: t("cash.overview.noMovements"),
    retrySameConfirmation: review.retrySameConfirmation,
    title: t("cash.overview.title"),
    uncertainDescription: review.uncertainDescription,
    uncertainTitle: review.uncertainTitle,
  });

  return {
    accountDetail,
    accountEditor,
    adjustment,
    effects: {
      adjustment: t("cash.effects.adjustment"),
      createAccount: t("cash.effects.createAccount"),
      editAccount: t("cash.effects.editAccount"),
      transfer: t("cash.effects.transfer"),
    },
    kindOptions: (Object.entries(accountKinds) as [CashAccountKind, string][]).map(
      ([value, label]) => ({ label, value }),
    ),
    movementDetail,
    overview,
    remote: {
      mutationFallback: t("cash.remote.mutationFallback"),
      offline: t("cash.remote.offline"),
      staleMutation: t("remote.staleMutation"),
      unavailable: t("cash.remote.unavailable"),
    },
    transfer,
  };
}

export type CashCopy = ReturnType<typeof buildCashCopy>;
