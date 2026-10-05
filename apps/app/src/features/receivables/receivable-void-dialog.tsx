import type { Receivable, VoidReceivableRequest } from "@pisto/contracts";
import * as Crypto from "expo-crypto";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { DescriptionList } from "@/components/layout/description-list";
import { StaleNotice } from "@/components/remote-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { dialogPhase } from "@/features/customers/command-state";
import { useRecordFormat } from "@/features/customers/format";
import type { ConfirmableCommand } from "@/features/customers/use-confirmable-command";
import type { FocusReturnRef } from "@/lib/focus-return";

import { buildVoidReceivableCommand } from "./draft";

/**
 * Voiding asks for its reason inside the confirmation. Once the outcome is uncertain the reason is
 * locked to the command already sent, because only that exact command may be retried.
 */
export function ReceivableVoidDialog({
  action,
  onRetryRead,
  receivable,
  returnFocusRef,
  stale,
}: {
  action: ConfirmableCommand<VoidReceivableRequest>;
  onRetryRead: () => void;
  receivable: Receivable;
  returnFocusRef: FocusReturnRef;
  /** The receivable could not be refreshed; only an uncertain void may be resent meanwhile. */
  stale: boolean;
}) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const { state } = action;
  const locked = state.phase === "uncertain" || state.phase === "pending";
  const blocked = stale && state.phase !== "uncertain";

  return (
    <ConfirmDialog
      confirmLabel={t("receivables.void.confirm")}
      description={t("receivables.void.description")}
      destructive
      disabled={stale}
      errorMessage={state.phase === "failed" ? state.message : undefined}
      onCancel={() => action.onOpenChange(false)}
      onConfirm={() =>
        action.confirm(() => {
          const result = buildVoidReceivableCommand(reason, Crypto.randomUUID());
          setReasonError("command" in result ? undefined : t("receivables.void.reasonInvalid"));
          return "command" in result ? result.command : null;
        })
      }
      open={action.open}
      phase={dialogPhase(state)}
      returnFocus={returnFocusRef}
      title={t("receivables.void.title")}
      uncertainDescription={state.phase === "uncertain" ? state.message : ""}
    >
      {blocked ? <StaleNotice onRetry={onRetryRead} /> : null}
      <DescriptionList
        items={[
          { label: t("receivables.void.charge"), value: receivable.description },
          {
            label: t("receivables.void.amount"),
            numeric: true,
            value: format.money(
              receivable.originalMinorUnits,
              receivable.currency,
              receivable.currencyMinorUnitDigits,
            ),
          },
        ]}
      />
      <Field
        editable={!locked}
        error={reasonError}
        label={t("receivables.void.reason")}
        maxLength={240}
        multiline
        onChangeText={(value) => {
          setReason(value);
          setReasonError(undefined);
        }}
        placeholder={t("receivables.void.reasonPlaceholder")}
        value={locked && action.command ? action.command.reason : reason}
      />
    </ConfirmDialog>
  );
}
