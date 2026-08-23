import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useEffect, useState } from "react";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { currentLocalDateTime } from "@/lib/money";
import type { CashMovement } from "../../../../../packages/contracts/src/cash.ts";
import { cashApi } from "./api";
import {
  CashMovementDetailScreen,
  type CashReversalDraft,
  type CashReversalErrors,
} from "./cash-movement-detail-screen";
import { cashErrorMessage, cashIssueMessage, cashMovementDetailCopy } from "./copy";
import { buildCashReversalCommand } from "./drafts";
import { formatCashMinorUnits } from "./format";
import { invalidateCashLedger } from "./invalidate";
import { cashConfirmationState } from "./mutation-state";

type CashMovementDetailControllerProps = {
  accountName: string;
  businessId: string;
  canManage: boolean;
  isStale: boolean;
  movement: CashMovement;
  movements: CashMovement[];
  onBack: () => void;
  timeZone: string;
};

export function CashMovementDetailController({
  accountName,
  businessId,
  canManage,
  isStale,
  movement,
  movements,
  onBack,
  timeZone,
}: CashMovementDetailControllerProps) {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<"detail" | "reverse-edit" | "reverse-review">("detail");
  const [draft, setDraft] = useState<CashReversalDraft>({
    localDate: "",
    localTime: "",
    reason: "",
  });
  const [errors, setErrors] = useState<CashReversalErrors>({});
  const [command, setCommand] = useState<Parameters<typeof cashApi.movements.reverse>[1] | null>(
    null,
  );

  useEffect(() => {
    if (draft.localDate || draft.localTime) return;
    const current = currentLocalDateTime(timeZone);
    setDraft((value) => ({ ...value, localDate: current.date, localTime: current.time }));
  }, [draft.localDate, draft.localTime, timeZone]);

  const mutation = useMutation({
    mutationFn: (nextCommand: Parameters<typeof cashApi.movements.reverse>[1]) =>
      cashApi.movements.reverse(movement.id, nextCommand),
    onSuccess: async () => {
      await invalidateCashLedger(queryClient, businessId);
      setStage("detail");
      setCommand(null);
    },
  });

  const prepareReview = () => {
    const result = buildCashReversalCommand({
      draft,
      idempotencyKey: Crypto.randomUUID(),
    });
    setErrors(
      Object.fromEntries(
        Object.entries(result.issues).map(([field, issue]) => [field, cashIssueMessage(issue)]),
      ) as CashReversalErrors,
    );
    if (!result.command) return;
    setCommand(result.command);
    setStage("reverse-review");
    mutation.reset();
  };

  const alreadyReversed = movements.some(
    ({ reversalOfMovementId }) => reversalOfMovementId === movement.id,
  );
  return (
    <CashMovementDetailScreen
      accountName={accountName}
      canManage={canManage && !isStale}
      canReverse={!alreadyReversed}
      confirmation={cashConfirmationState(mutation)}
      copy={cashMovementDetailCopy}
      errorMessage={mutation.error ? cashErrorMessage(mutation.error) : undefined}
      formatMoney={(minorUnits, currency, fractionDigits) =>
        formatCashMinorUnits(minorUnits, currency, fractionDigits, DEFAULT_LOCALE)
      }
      isStale={isStale}
      movement={movement}
      onBack={onBack}
      onBeginReversal={() => setStage("reverse-edit")}
      onCancelReversal={() => {
        setStage("detail");
        setCommand(null);
        mutation.reset();
      }}
      onCheckStatus={() => command && mutation.mutate(command)}
      onConfirmReversal={() => command && mutation.mutate(command)}
      onEditReversal={() => {
        setStage("reverse-edit");
        mutation.reset();
      }}
      onPrepareReversalReview={prepareReview}
      onRetry={() => undefined}
      onReversalDraftChange={setDraft}
      remoteState={{ kind: "ready" }}
      reversalCommand={command}
      reversalDraft={draft}
      reversalErrors={errors}
      stage={stage}
    />
  );
}
