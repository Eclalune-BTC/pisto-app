import type { Movement, MovementKind } from "@pisto/contracts";
import type { Href } from "expo-router";
import type { TFunction } from "i18next";
import {
  HandCoins,
  type LucideIcon,
  MessageSquareText,
  Mic,
  Package,
  Pencil,
  ReceiptText,
  ShoppingBag,
  Truck,
} from "lucide-react-native";

import { expenseCategoryLabels } from "@/features/expenses/copy";

export type EntrySource = Movement["entrySource"];

export const movementKindIcons: Record<MovementKind, LucideIcon> = {
  sale: ShoppingBag,
  purchase: Package,
  expense: ReceiptText,
  receivable_payment: HandCoins,
  supplier_payment: Truck,
};

export const entrySourceIcons: Record<EntrySource, LucideIcon> = {
  manual: Pencil,
  voice: Mic,
  text: MessageSquareText,
};

export function movementKindLabel(t: TFunction, kind: MovementKind): string {
  return t(`movements.kinds.${kind}`);
}

export function entrySourceLabel(t: TFunction, source: EntrySource): string {
  return t(`movements.sources.${source}`);
}

/** The row's headline, worded from the record's facts the way the owner would say it. */
export function movementTitle(t: TFunction, movement: Movement): string {
  const { counterpartyName, description } = movement.facts;
  switch (movement.kind) {
    case "sale":
      return counterpartyName
        ? t("movements.titles.saleTo", { name: counterpartyName })
        : (description ?? t("movements.titles.sale"));
    case "purchase":
      return counterpartyName
        ? t("movements.titles.purchaseFrom", { name: counterpartyName })
        : (description ?? t("movements.titles.purchase"));
    case "expense":
      return description ?? t("movements.titles.expense");
    case "receivable_payment":
      return counterpartyName
        ? t("movements.titles.paymentFrom", { name: counterpartyName })
        : t("movements.titles.payment");
    case "supplier_payment":
      return counterpartyName
        ? t("movements.titles.paymentTo", { name: counterpartyName })
        : t("movements.titles.supplierPayment");
  }
}

/**
 * Secondary facts, or null when the title already says everything. `money` formats a minor-unit
 * amount; only server totals are formatted, never a client calculation.
 */
export function movementSubtitle(
  t: TFunction,
  movement: Movement,
  money: (minorUnits: string) => string,
): string | null {
  const { counterpartyName, description, expenseCategory, lineCount, reference, totalMinorUnits } =
    movement.facts;
  const parts: string[] = [];
  if (lineCount !== null) parts.push(t("movements.facts.lines", { count: Number(lineCount) }));
  if (totalMinorUnits !== null) {
    parts.push(
      t("movements.facts.paidOf", {
        paid: money(movement.amountMinorUnits.replace("-", "")),
        total: money(totalMinorUnits),
      }),
    );
  }
  switch (movement.kind) {
    case "expense":
      if (expenseCategory) parts.push(expenseCategoryLabels(t)[expenseCategory]);
      if (counterpartyName && counterpartyName !== description) parts.push(counterpartyName);
      break;
    case "receivable_payment":
    case "supplier_payment":
      parts.push(reference ?? description ?? t("movements.facts.accountPayment"));
      break;
    case "sale":
    case "purchase":
      if (counterpartyName && description) parts.push(description);
      break;
  }
  return parts.length ? parts.join(" · ") : null;
}

/** The record the row opens, or null for a kind whose detail screen this build does not have. */
export function movementHref(movement: Movement): Href | null {
  switch (movement.kind) {
    case "sale":
      return { pathname: "/operate/sales/[saleId]", params: { saleId: movement.recordId } };
    case "expense":
      return {
        pathname: "/operate/expenses/[expenseId]",
        params: { expenseId: movement.recordId },
      };
    case "receivable_payment":
      if (!movement.parentRecordId) {
        throw new Error("A receivable payment movement must name its receivable.");
      }
      return {
        pathname: "/operate/receivables/[receivableId]",
        params: { receivableId: movement.parentRecordId },
      };
    case "purchase":
    case "supplier_payment":
      return null;
  }
}

export function isIncoming(movement: Pick<Movement, "amountMinorUnits">): boolean {
  return !movement.amountMinorUnits.startsWith("-") && movement.amountMinorUnits !== "0";
}
