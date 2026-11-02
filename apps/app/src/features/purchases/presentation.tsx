import type { Purchase, Supplier } from "@pisto/contracts";
import { useTranslation } from "react-i18next";

import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { toDecimalString } from "@/lib/money";

type PurchaseState = Purchase["payableState"] | "voided";

const stateTones: Record<PurchaseState, StatusTone> = {
  paid: "settled",
  open: "normal",
  due_soon: "normal",
  overdue: "attention",
  voided: "exception",
};

/** A voided purchase owes nothing, so its authority status replaces the payable state. */
export function purchaseState(purchase: Pick<Purchase, "payableState" | "status">): PurchaseState {
  return purchase.status === "voided" ? "voided" : purchase.payableState;
}

export function PurchaseStateBadge({
  purchase,
}: {
  purchase: Pick<Purchase, "payableState" | "status">;
}) {
  const { t } = useTranslation();
  const state = purchaseState(purchase);
  return <StatusBadge label={t(`purchases.states.${state}`)} tone={stateTones[state]} />;
}

/** Exact quantity text for a scaled quantity, like the inventory ledger shows it. */
export function quantityText(minorUnits: string, quantityPrecision: number): string {
  return toDecimalString(minorUnits, quantityPrecision);
}

export function supplierContactLine(
  supplier: Pick<Supplier, "contactName" | "email" | "phone">,
): string | undefined {
  const parts = [supplier.contactName, supplier.phone ?? supplier.email].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(" · ") : undefined;
}
