import type { CashConfirmationState } from "./state";

export type CashOperationPresentationInput = {
  remoteKind: "loading" | "denied" | "error" | "ready";
  canManage: boolean;
  confirmation: CashConfirmationState;
};

export type CashOperationPresentation = {
  canStart: boolean;
  canConfirm: boolean;
  blocksDuplicateMutation: boolean;
};

export function cashOperationPresentation({
  remoteKind,
  canManage,
  confirmation,
}: CashOperationPresentationInput): CashOperationPresentation {
  const authorized = remoteKind === "ready" && canManage;
  const blocksDuplicateMutation = confirmation === "uncertain";

  return {
    canStart: authorized && !blocksDuplicateMutation,
    canConfirm: authorized && confirmation !== "pending" && !blocksDuplicateMutation,
    blocksDuplicateMutation,
  };
}
