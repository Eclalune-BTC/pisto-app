import type { CashMovement, ReverseCashMovementRequest } from "@pisto/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatLocalizedDateTime } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { currentLocalDateTime, formatMinorUnits } from "@/lib/money";
import { notify } from "@/lib/notify";
import { productErrorMessage } from "@/lib/product-errors";
import { cashApi } from "./api";
import { CashAccountName } from "./cash-account-name";
import {
  CashMovementDialog,
  CashReversalDialog,
  type CashReversalDraft,
  type CashReversalErrors,
} from "./cash-movement-dialogs";
import { cashIssueMessages, cashMovementActionLabels } from "./copy";
import { buildCashReversalCommand } from "./drafts";
import { invalidateCashLedger } from "./invalidate";
import { mutationPhase, withStableIdempotencyKey } from "./mutation-state";

type CashMovementDetailProps = {
  /** Known when the movement is shown inside its own account. */
  accountName?: string;
  businessId: string;
  /** Manager access confirmed by a fresh read; it can be lost while the dialog is open. */
  canManage: boolean;
  /** A snapshot: it stays on screen even if a refreshed page no longer contains the row. */
  movement: CashMovement;
  /** Loaded history, used to tell whether this movement was already reversed. */
  movements: readonly CashMovement[];
  onClose: () => void;
  timeZone: string;
};

function isAdjustment(movement: CashMovement) {
  return movement.action === "adjustment_in" || movement.action === "adjustment_out";
}

export function CashMovementDetail({
  accountName,
  businessId,
  canManage,
  movement,
  movements,
  onClose,
  timeZone,
}: CashMovementDetailProps) {
  const queryClient = useQueryClient();
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const [stage, setStage] = useState<"detail" | "reverse">("detail");
  const [draft, setDraft] = useState<CashReversalDraft>(() => {
    const now = currentLocalDateTime(timeZone);
    return { localDate: now.date, localTime: now.time, reason: "" };
  });
  const [errors, setErrors] = useState<CashReversalErrors>({});
  const reversal = useMutation({
    mutationFn: (command: ReverseCashMovementRequest) =>
      cashApi.movements.reverse(movement.id, command),
    onSuccess: async () => {
      await invalidateCashLedger(queryClient, businessId);
      notify.success(t("cash.reversal.success"));
      onClose();
    },
  });
  const phase = mutationPhase(reversal);
  const reversed = movements.some(
    ({ reversalOfMovementId }) => reversalOfMovementId === movement.id,
  );
  const money = (minorUnits: string) =>
    formatMinorUnits(minorUnits, movement.currency, movement.currencyMinorUnitDigits, locale);

  const confirm = () => {
    if (phase === "pending") return;
    // Sending the same command again cannot apply it twice; only a new decision needs fresh access.
    if (phase === "uncertain") {
      if (reversal.variables) reversal.mutate(reversal.variables);
      return;
    }
    if (!canManage) return;
    const result = buildCashReversalCommand({ draft, idempotencyKey: Crypto.randomUUID() });
    setErrors(cashIssueMessages(t, result.issues));
    if (result.command)
      reversal.mutate(withStableIdempotencyKey(reversal.variables, result.command));
  };

  return (
    <>
      <CashMovementDialog
        account={
          <CashAccountName
            accountId={movement.accountId}
            businessId={businessId}
            className="text-sm"
            knownName={accountName}
          />
        }
        actionLabel={cashMovementActionLabels(t)[movement.action]}
        amount={money(movement.deltaMinorUnits)}
        movement={movement}
        occurredAt={formatLocalizedDateTime(movement.occurredAt, locale, movement.timeZone)}
        onClose={onClose}
        onReverse={
          canManage && isAdjustment(movement) && !reversed ? () => setStage("reverse") : undefined
        }
        open={stage === "detail"}
        reversed={reversed}
      />
      <CashReversalDialog
        amount={money(movement.amountMinorUnits)}
        canConfirm={canManage}
        draft={draft}
        errorMessage={
          reversal.error
            ? productErrorMessage(reversal.error, t("cash.remote.mutationFallback"), t)
            : undefined
        }
        errors={errors}
        onCancel={() => {
          reversal.reset();
          setErrors({});
          setStage("detail");
        }}
        onConfirm={confirm}
        onDraftChange={setDraft}
        open={stage === "reverse"}
        phase={phase}
      />
    </>
  );
}
