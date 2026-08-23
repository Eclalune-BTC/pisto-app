import type { CashMovement } from "@pisto/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { currentLocalDateTime, formatMinorUnits } from "@/lib/money";
import { productErrorMessage } from "@/lib/product-errors";
import { cashApi } from "./api";
import {
  CashMovementDetailScreen,
  type CashReversalDraft,
  type CashReversalErrors,
} from "./cash-movement-detail-screen";
import { buildCashCopy, cashIssueMessage } from "./copy";
import { buildCashReversalCommand } from "./drafts";
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
  const { i18n, t } = useTranslation();
  const copy = useMemo(() => buildCashCopy(t), [t]);
  const locale = i18n.resolvedLanguage ?? DEFAULT_LOCALE;
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
        Object.entries(result.issues).map(([field, issue]) => [field, cashIssueMessage(t, issue)]),
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
      copy={copy.movementDetail}
      errorMessage={
        mutation.error
          ? productErrorMessage(mutation.error, copy.remote.mutationFallback, t)
          : undefined
      }
      formatMoney={(minorUnits, currency, fractionDigits) =>
        formatMinorUnits(minorUnits, currency, fractionDigits, locale)
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
