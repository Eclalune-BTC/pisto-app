import type { ArchiveCustomerRequest } from "@pisto/contracts";
import * as Crypto from "expo-crypto";
import { TriangleAlert } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { StaleNotice } from "@/components/remote-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { ConfirmCommandDialog } from "./confirm-command-dialog";
import type { FocusReturnRef } from "./focus-return";
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
    <ConfirmCommandDialog
      cancelLabel={t("common.cancel")}
      confirmDisabled={blocked}
      confirmLabel={
        state.phase === "uncertain"
          ? t("common.retrySameConfirmation")
          : t("customers.archive.confirm")
      }
      description={t("customers.archive.description", { name: customerName })}
      destructive
      error={state.phase === "failed" ? state.message : undefined}
      onConfirm={() => action.confirm(() => ({ idempotencyKey: Crypto.randomUUID() }))}
      onOpenChange={action.onOpenChange}
      open={action.open}
      pending={state.phase === "pending"}
      returnFocusRef={returnFocusRef}
      title={t("customers.archive.title")}
    >
      {blocked ? <StaleNotice onRetry={onRetryRead} /> : null}
      {state.phase === "uncertain" ? (
        <Alert icon={TriangleAlert} variant="warning">
          <AlertTitle>{t("common.uncertainTitle")}</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
    </ConfirmCommandDialog>
  );
}
