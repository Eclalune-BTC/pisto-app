import type { CashMovement } from "@pisto/contracts";
import { Link } from "expo-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { DescriptionList } from "@/components/layout/description-list";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Text } from "@/components/ui/text";
import { returnFocusOnClose } from "@/lib/focus-return";
import { isLockedPhase, type MutationPhase } from "@/lib/mutation-phase";
import { cashMovementReason } from "./copy";
import { LocalDateTimeFields } from "./local-date-time-fields";

export type CashReversalDraft = {
  reason: string;
  localDate: string;
  localTime: string;
};

export type CashReversalErrors = Partial<Record<keyof CashReversalDraft, string>>;

type CashMovementDialogProps = {
  account: ReactNode;
  actionLabel: string;
  amount: string;
  movement: CashMovement;
  occurredAt: string;
  onClose: () => void;
  /** Offered only for an adjustment that this manager may still reverse. */
  onReverse?: () => void;
  open: boolean;
  /** When the movement was recorded; lists are ordered by it. */
  recordedAt: string;
  /** The row that opened the dialog; focus returns to it when the movement flow ends. */
  returnFocus?: HTMLElement | null;
  /** The loaded history already contains a reversal of this movement. */
  reversed: boolean;
};

export function CashMovementDialog({
  account,
  actionLabel,
  amount,
  movement,
  occurredAt,
  onClose,
  onReverse,
  open,
  recordedAt,
  returnFocus,
  reversed,
}: CashMovementDialogProps) {
  const { t } = useTranslation();
  const note = reversed
    ? t("cash.movementDetail.reversed")
    : movement.reversalOfMovementId
      ? t("cash.movementDetail.reversalOf")
      : undefined;
  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open={open}
    >
      <DialogContent onCloseAutoFocus={returnFocusOnClose(returnFocus)}>
        <DialogHeader>
          <DialogTitle>{actionLabel}</DialogTitle>
          <DialogDescription>{occurredAt}</DialogDescription>
        </DialogHeader>
        <DescriptionList
          items={[
            { label: t("cash.movementDetail.amount"), numeric: true, value: amount },
            { label: t("cash.movementDetail.account"), value: account },
            { label: t("cash.movementDetail.reason"), value: cashMovementReason(t, movement) },
            { label: t("cash.movementDetail.recordedAt"), numeric: true, value: recordedAt },
          ]}
        />
        {note ? <Text className="text-[13px] leading-5 text-muted-foreground">{note}</Text> : null}
        {movement.expenseId || onReverse ? (
          <DialogFooter>
            {movement.expenseId ? (
              <Link
                asChild
                href={{
                  pathname: "/operate/expenses/[expenseId]",
                  params: { expenseId: movement.expenseId },
                }}
              >
                <Button
                  accessibilityRole="link"
                  label={t("cash.movementDetail.viewExpense")}
                  variant="outline"
                />
              </Link>
            ) : null}
            {onReverse ? (
              <Button
                label={t("cash.movementDetail.reverse")}
                onPress={onReverse}
                variant="outline"
              />
            ) : null}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type CashReversalDialogProps = {
  amount: string;
  canConfirm: boolean;
  draft: CashReversalDraft;
  errorMessage?: string;
  errors: CashReversalErrors;
  onCancel: () => void;
  onConfirm: () => void;
  onDraftChange: (draft: CashReversalDraft) => void;
  open: boolean;
  phase: MutationPhase;
  /** The row that opened the movement; focus returns to it when the reversal ends the flow. */
  returnFocus?: HTMLElement | null;
};

export function CashReversalDialog({
  amount,
  canConfirm,
  draft,
  errorMessage,
  errors,
  onCancel,
  onConfirm,
  onDraftChange,
  open,
  phase,
  returnFocus,
}: CashReversalDialogProps) {
  const { t } = useTranslation();
  const locked = isLockedPhase(phase);
  return (
    <ConfirmDialog
      uncertainDescription={t("common.reviewUncertainDescription")}
      confirmLabel={t("cash.reversal.confirm")}
      description={t("cash.reversal.description", { amount })}
      destructive
      disabled={!canConfirm}
      errorMessage={errorMessage}
      onCancel={onCancel}
      onConfirm={onConfirm}
      open={open}
      phase={phase}
      returnFocus={returnFocus}
      title={t("cash.reversal.title")}
    >
      <View className="gap-4">
        <Field
          editable={!locked}
          error={errors.reason}
          label={t("cash.reversal.reason")}
          maxLength={240}
          onChangeText={(reason) => onDraftChange({ ...draft, reason })}
          value={draft.reason}
        />
        <LocalDateTimeFields
          date={draft.localDate}
          dateError={errors.localDate}
          disabled={locked}
          onDateChange={(localDate) => onDraftChange({ ...draft, localDate })}
          onTimeChange={(localTime) => onDraftChange({ ...draft, localTime })}
          time={draft.localTime}
          timeError={errors.localTime}
        />
      </View>
    </ConfirmDialog>
  );
}
