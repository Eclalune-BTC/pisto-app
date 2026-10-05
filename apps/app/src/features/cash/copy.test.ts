import type { CashMovement } from "@pisto/contracts";
import { describe, expect, test, vi } from "vitest";
import { i18n } from "@/i18n/config";
import { cashMovementReason } from "./copy";

vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));

const t = i18n.t;
const movement: CashMovement = {
  id: "movement-a",
  accountId: "account-a",
  action: "transfer_out",
  direction: "out",
  amountMinorUnits: "100",
  deltaMinorUnits: "-100",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  occurredAt: "2026-09-01T12:00:00Z",
  occurredLocalDate: "2026-09-01",
  occurredLocalTime: "06:00",
  timeZone: "America/El_Salvador",
  reason: null,
  expenseId: null,
  transferId: "transfer-a",
  receivablePaymentId: null,
  reversalOfMovementId: null,
  createdAt: "2026-09-01T12:00:00Z",
};

describe("cash movement reasons", () => {
  test("shows a typed reason exactly as the person wrote it", () => {
    expect(cashMovementReason(t, { ...movement, reason: "Move to bank" })).toBe("Move to bank");
  });

  test("describes system-written movements in the interface language", () => {
    expect(cashMovementReason(t, movement)).toBe("Transferencia entre cuentas");
    expect(
      cashMovementReason(t, {
        ...movement,
        action: "receivable_payment",
        direction: "in",
        transferId: null,
        receivablePaymentId: "payment-a",
      }),
    ).toBe("Pago registrado en cuentas por cobrar");
    expect(
      cashMovementReason(t, {
        ...movement,
        action: "reverse",
        transferId: null,
        reversalOfMovementId: "movement-b",
      }),
    ).toBe("Pago revertido en cuentas por cobrar");
  });

  test("treats a person-entered movement without a reason as invalid data", () => {
    expect(() => cashMovementReason(t, { ...movement, action: "adjustment_in" })).toThrow();
  });
});
