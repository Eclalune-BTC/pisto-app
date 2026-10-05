import type { ArchiveCustomerRequest } from "@pisto/contracts";
import * as Crypto from "expo-crypto";
import { useTranslation } from "react-i18next";

import { StaleNotice } from "@/components/remote-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { FocusReturnRef } from "@/lib/focus-return";

import { commandPhase } from "./command-state";
import type { ConfirmableCommand } from "./use-confirmable-command";

export function CustomerArchiveDialog({
  action,
  customerName,
  onRetryRead,
  returnFocusRef,
  stale,
}: {
  action: ConfirmableCommand<ArchiveCustomerRequest>;
  customerName: string;
  onRetryRead: () => void;
  returnFocusRef: FocusReturnRef;
  /** The customer could not be refreshed; only an uncertain archive may be resent meanwhile. */
  stale: boolean;
}) {
  const { t } = useTranslation();
  const { state } = action;
  const blocked = stale && state.phase !== "uncertain";
  return (
    <ConfirmDialog
      confirmLabel={t("customers.archive.confirm")}
      description={t("customers.archive.description", { name: customerName })}
      destructive
      disabled={stale}
      errorMessage={state.phase === "failed" ? state.message : undefined}
      onCancel={() => action.onOpenChange(false)}
      onConfirm={() => action.confirm(() => ({ idempotencyKey: Crypto.randomUUID() }))}
      open={action.open}
      phase={commandPhase(state)}
      returnFocus={returnFocusRef}
      title={t("customers.archive.title")}
      uncertainDescription={state.phase === "uncertain" ? state.message : ""}
    >
      {blocked ? <StaleNotice onRetry={onRetryRead} /> : null}
    </ConfirmDialog>
  );
}
