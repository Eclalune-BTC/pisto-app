import type { InventoryMovement, Product, ReverseInventoryMovementRequest } from "@pisto/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { DescriptionList } from "@/components/layout/description-list";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { requireSupportedLocale } from "@/i18n/locale";
import { currentLocalDateTime } from "@/lib/money";
import { isLockedPhase, mutationPhase, withStableIdempotencyKey } from "@/lib/mutation-phase";
import { notify } from "@/lib/notify";
import { productErrorMessage } from "@/lib/product-errors";
import { signedQuantityText } from "../catalog/format";
import { invalidateCatalogInventory } from "../catalog/queries";
import { inventoryApi } from "./api";
import { MomentFields } from "./moment-fields";
import { movementMoment } from "./movement-table";
import {
  buildReversalCommand,
  type ReversalDraft,
  type ReversalDraftErrors,
} from "./reversal-draft";

type ReversalDialogProps = {
  businessId: string;
  /** Inventory management on fresh data; it can be lost while the dialog is open. */
  canConfirm: boolean;
  /** A snapshot: a refreshed history cannot change which movement is being reversed. */
  movement: InventoryMovement;
  onClose: () => void;
  product: Product;
  /** The control that opened the dialog; focus returns to it on close. */
  returnFocus: HTMLElement | null;
  timeZone: string;
};

/** The negated delta a reversal records, as exact text: no arithmetic touches the quantity. */
export function reversalDelta(deltaMinorUnits: string): string {
  return deltaMinorUnits.startsWith("-") ? deltaMinorUnits.slice(1) : `-${deltaMinorUnits}`;
}

/**
 * Reverses one movement by appending its opposite. Mounted while open, so every reversal starts
 * with a fresh draft and key; an unchanged draft sent again keeps its key.
 */
export function ReversalDialog({
  businessId,
  canConfirm,
  movement,
  onClose,
  product,
  returnFocus,
  timeZone,
}: ReversalDialogProps) {
  const queryClient = useQueryClient();
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const [draft, setDraft] = useState<ReversalDraft>(() => {
    const now = currentLocalDateTime(timeZone);
    return { occurredLocalDate: now.date, occurredLocalTime: now.time, reason: "" };
  });
  const [errors, setErrors] = useState<ReversalDraftErrors>({});
  const delta = (deltaMinorUnits: string) =>
    signedQuantityText(t, locale, {
      deltaMinorUnits,
      precision: movement.quantityPrecision,
      unitKind: product.unitKind,
    });
  const reversal = useMutation({
    mutationFn: (command: ReverseInventoryMovementRequest) =>
      inventoryApi.reverseMovement(movement.id, command),
    onSuccess: async () => {
      await invalidateCatalogInventory(queryClient, businessId);
      notify.success(t("inventory.reversal.reversed"), {
        description: `${product.name} · ${delta(reversalDelta(movement.deltaMinorUnits))}`,
      });
      onClose();
    },
  });
  const phase = mutationPhase(reversal);
  const locked = isLockedPhase(phase);

  const confirm = () => {
    if (phase === "pending") return;
    // Sending the same command again cannot apply it twice; only a new decision needs access.
    if (phase === "uncertain") {
      if (reversal.variables) reversal.mutate(reversal.variables);
      return;
    }
    if (!canConfirm) return;
    const result = buildReversalCommand({ draft, idempotencyKey: Crypto.randomUUID() });
    if ("errors" in result) {
      setErrors({
        ...(result.errors.reason ? { reason: t("inventory.reversal.validation.reason") } : {}),
        ...(result.errors.occurredLocalDate
          ? { occurredLocalDate: t("inventory.reversal.validation.date") }
          : {}),
        ...(result.errors.occurredLocalTime
          ? { occurredLocalTime: t("inventory.reversal.validation.time") }
          : {}),
      });
      return;
    }
    setErrors({});
    reversal.mutate(withStableIdempotencyKey(reversal.variables, result.command));
  };

  return (
    <ConfirmDialog
      confirmLabel={t("inventory.reversal.confirm")}
      description={t("inventory.reversal.description", {
        delta: delta(reversalDelta(movement.deltaMinorUnits)),
      })}
      destructive
      disabled={!canConfirm}
      errorMessage={
        reversal.error
          ? productErrorMessage(
              reversal.error,
              t("productErrors.contexts.reversal.fallback"),
              t,
              "reversal",
            )
          : undefined
      }
      onCancel={onClose}
      onConfirm={confirm}
      open
      phase={phase}
      returnFocus={returnFocus}
      title={t("inventory.reversal.title")}
      uncertainDescription={t("inventory.reversal.uncertainDescription")}
    >
      <View className="gap-4">
        <DescriptionList
          items={[
            {
              label: t("inventory.reversal.original"),
              value: t(`inventory.movementActions.${movement.action}`),
            },
            {
              label: t("inventory.history.occurredAt"),
              numeric: true,
              value: movementMoment(movement, locale),
            },
            {
              label: t("dataTable.columns.quantity"),
              numeric: true,
              value: delta(movement.deltaMinorUnits),
            },
          ]}
        />
        <Field
          editable={!locked}
          error={errors.reason}
          label={t("inventory.reversal.reason")}
          maxLength={240}
          onChangeText={(reason) => setDraft((value) => ({ ...value, reason }))}
          placeholder={t("inventory.reversal.reasonPlaceholder")}
          value={draft.reason}
        />
        <MomentFields
          date={draft.occurredLocalDate}
          dateError={errors.occurredLocalDate}
          disabled={locked}
          onDateChange={(occurredLocalDate) =>
            setDraft((value) => ({ ...value, occurredLocalDate }))
          }
          onTimeChange={(occurredLocalTime) =>
            setDraft((value) => ({ ...value, occurredLocalTime }))
          }
          time={draft.occurredLocalTime}
          timeError={errors.occurredLocalTime}
        />
      </View>
    </ConfirmDialog>
  );
}
