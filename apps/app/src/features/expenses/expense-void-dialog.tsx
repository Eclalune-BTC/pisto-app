import type { Expense, VoidExpenseRequest } from "@pisto/contracts";
import { useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { MomentFields } from "@/components/ui/moment-fields";
import { requireSupportedLocale } from "@/i18n/locale";
import { useKeyedCommand } from "@/lib/keyed-command";
import { currentLocalDateTime, formatMinorUnits } from "@/lib/money";
import { isLockedPhase, withStableIdempotencyKey } from "@/lib/mutation-phase";
import { notify } from "@/lib/notify";
import { productErrorMessage } from "@/lib/product-errors";
import { cashApi } from "../cash/api";
import { cashIssueMessages } from "../cash/copy";
import { invalidateExpensesAndCash } from "../cash/invalidate";
import { buildVoidExpenseCommand, type VoidExpenseDraftValues } from "./drafts";
import { expenseHref } from "./expense-history";

type ExpenseVoidDialogProps = {
  businessId: string;
  /** Void requires expense and cash management on fresh data; it can be lost while open. */
  canConfirm: boolean;
  /** A snapshot: a refreshed list that drops the row cannot change what is being voided. */
  expense: Expense;
  onClose: () => void;
  /** Offers a link to the record when voiding from somewhere other than its own page. */
  linkToRecord?: boolean;
  /** The control that opened the dialog; focus returns to it on close. */
  returnFocus?: HTMLElement | null;
  timeZone: string;
};

/** Mounted while open, so every new void starts with a fresh draft and a fresh key. */
export function ExpenseVoidDialog({
  businessId,
  canConfirm,
  expense,
  linkToRecord = false,
  onClose,
  returnFocus,
  timeZone,
}: ExpenseVoidDialogProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const [draft, setDraft] = useState<VoidExpenseDraftValues>(() => {
    const now = currentLocalDateTime(timeZone);
    return { localDate: now.date, localTime: now.time, reason: "" };
  });
  const [errors, setErrors] = useState<Partial<Record<keyof VoidExpenseDraftValues, string>>>({});
  const voiding = useKeyedCommand({
    mutationFn: (command: VoidExpenseRequest) => cashApi.expenses.void(expense.id, command),
    onConfirmed: async () => {
      await invalidateExpensesAndCash(queryClient, businessId);
      notify.success(t("expenses.void.success"), {
        description: expense.description,
        ...(linkToRecord
          ? {
              action: {
                label: t("expenses.void.viewExpense"),
                onPress: () => router.push(expenseHref(expense.id)),
              },
            }
          : {}),
      });
      onClose();
    },
  });
  const phase = voiding.phase;
  const locked = isLockedPhase(phase);

  const confirm = () => {
    if (phase === "pending") return;
    // Sending the same command again cannot apply it twice; only a new decision needs fresh access.
    if (phase === "uncertain") {
      if (voiding.variables) voiding.send(voiding.variables);
      return;
    }
    if (!canConfirm) return;
    const result = buildVoidExpenseCommand({ draft, idempotencyKey: Crypto.randomUUID() });
    setErrors(cashIssueMessages(t, result.issues));
    if (result.command) voiding.send(withStableIdempotencyKey(voiding.variables, result.command));
  };

  return (
    <ConfirmDialog
      uncertainDescription={t("common.reviewUncertainDescription")}
      confirmLabel={t("expenses.void.confirm")}
      description={t("expenses.void.description", {
        amount: formatMinorUnits(
          expense.amountMinorUnits,
          expense.currency,
          expense.currencyMinorUnitDigits,
          locale,
        ),
      })}
      destructive
      disabled={!canConfirm}
      errorMessage={
        voiding.error
          ? productErrorMessage(voiding.error, t("expenses.remote.mutationFallback"), t)
          : undefined
      }
      onCancel={onClose}
      onConfirm={confirm}
      open
      phase={phase}
      returnFocus={returnFocus}
      title={t("expenses.void.title", { description: expense.description })}
    >
      <View className="gap-4">
        <Field
          editable={!locked}
          error={errors.reason}
          label={t("expenses.void.reason")}
          maxLength={240}
          onChangeText={(reason) => setDraft((value) => ({ ...value, reason }))}
          value={draft.reason}
        />
        <MomentFields
          date={draft.localDate}
          dateError={errors.localDate}
          disabled={locked}
          onDateChange={(localDate) => setDraft((value) => ({ ...value, localDate }))}
          onTimeChange={(localTime) => setDraft((value) => ({ ...value, localTime }))}
          time={draft.localTime}
          timeError={errors.localTime}
        />
      </View>
    </ConfirmDialog>
  );
}
