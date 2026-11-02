import type {
  CashAccountKind,
  CashAccountStatus,
  CashMovement,
  CashMovementAction,
} from "@pisto/contracts";
import type { TFunction } from "i18next";
import type { FeatureBoundaryCopy } from "@/components/feature-boundary";
import type { CashDraftIssue } from "./drafts";

const issueKeys = {
  "account-required": "cash.issues.accountRequired",
  "accounts-must-differ": "cash.issues.accountsMustDiffer",
  "insufficient-balance": "cash.issues.insufficientBalance",
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

export function cashAccountStatusLabels(t: TFunction): Record<CashAccountStatus, string> {
  return {
    active: t("cash.accountStatus.active"),
    archived: t("cash.accountStatus.archived"),
  };
}

export function cashMovementActionLabels(t: TFunction): Record<CashMovementAction, string> {
  return {
    adjustment_in: t("cash.movementActions.adjustment_in"),
    adjustment_out: t("cash.movementActions.adjustment_out"),
    expense: t("cash.movementActions.expense"),
    opening: t("cash.movementActions.opening"),
    purchase_payment: t("cash.movementActions.purchase_payment"),
    receivable_payment: t("cash.movementActions.receivable_payment"),
    sale_payment: t("cash.movementActions.sale_payment"),
    reverse: t("cash.movementActions.reverse"),
    supplier_payment: t("cash.movementActions.supplier_payment"),
    transfer_in: t("cash.movementActions.transfer_in"),
    transfer_out: t("cash.movementActions.transfer_out"),
  };
}

/** The typed reason, or the description of a movement the system wrote from another record. */
export function cashMovementReason(t: TFunction, movement: CashMovement): string {
  if (movement.reason !== null) return movement.reason;
  switch (movement.action) {
    case "transfer_in":
    case "transfer_out":
      return t("cash.systemReasons.transfer");
    case "receivable_payment":
      return t("cash.systemReasons.receivablePayment");
    case "sale_payment":
      return t("cash.systemReasons.salePayment");
    case "purchase_payment":
      return t("cash.systemReasons.purchasePayment");
    case "supplier_payment":
      return t("cash.systemReasons.supplierPayment");
    case "reverse":
      return t("cash.systemReasons.receivablePaymentReversal");
    default:
      throw new Error(`Cash movement ${movement.id} has no reason`);
  }
}

/** Field errors for a draft, keyed like the draft itself. */
export function cashIssueMessages<Field extends string>(
  t: TFunction,
  issues: Partial<Record<Field, CashDraftIssue>>,
): Partial<Record<Field, string>> {
  const messages: Partial<Record<Field, string>> = {};
  for (const [field, issue] of Object.entries(issues) as [Field, CashDraftIssue | undefined][]) {
    if (issue) messages[field] = t(issueKeys[issue]);
  }
  return messages;
}

export function cashBoundaryCopy(t: TFunction): FeatureBoundaryCopy {
  return {
    deniedDescription: t("cash.boundary.deniedDescription"),
    deniedTitle: t("cash.boundary.deniedTitle"),
    loading: t("cash.boundary.loading"),
    offlineTitle: t("remote.offlineTitle"),
    retry: t("common.retry"),
    unavailableTitle: t("cash.boundary.unavailableTitle"),
  };
}
