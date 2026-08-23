import type { CashAccount } from "@pisto/contracts";
import { describe, expect, test } from "vitest";
import { ApiClientError } from "@/lib/api-error";
import {
  buildCashAccountCommand,
  buildCashAdjustmentCommand,
  buildCashReversalCommand,
  buildCashTransferCommand,
} from "./drafts";
import { formatCashMinorUnits } from "./format";
import { cashConfirmationState } from "./mutation-state";

const account = (overrides: Partial<CashAccount> = {}): CashAccount => ({
  allowNegativeBalance: false,
  balanceMinorUnits: "5000",
  createdAt: "2026-08-22T12:00:00.000Z",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  id: "11111111-1111-4111-8111-111111111111",
  kind: "cash",
  name: "Caja principal",
  status: "active",
  updatedAt: "2026-08-22T12:00:00.000Z",
  ...overrides,
});

describe("cash draft commands", () => {
  test("keeps the caller idempotency key and explicit opening movement in account review", () => {
    const result = buildCashAccountCommand({
      account: null,
      currency: "USD",
      currencyMinorUnitDigits: 2,
      draft: {
        kind: "cash",
        name: "  Caja principal  ",
        negativePolicy: "protected",
        openingAmount: "12.50",
        openingLocalDate: "2026-08-22",
        openingLocalTime: "09:30",
        openingMode: "in",
        openingReason: "  Conteo inicial  ",
      },
      idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      mode: "create",
    });

    expect(result.issues).toEqual({});
    expect(result.command).toEqual({
      allowNegativeBalance: false,
      currency: "USD",
      idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      kind: "cash",
      name: "Caja principal",
      opening: {
        amountMinorUnits: "1250",
        direction: "in",
        occurredLocalDate: "2026-08-22",
        occurredLocalTime: "09:30",
        reason: "Conteo inicial",
      },
    });
  });

  test("does not prepare an account update without a real change", () => {
    const result = buildCashAccountCommand({
      account: account(),
      currency: "USD",
      currencyMinorUnitDigits: 2,
      draft: {
        kind: "cash",
        name: "Caja principal",
        negativePolicy: "protected",
        openingAmount: "",
        openingLocalDate: "",
        openingLocalTime: "",
        openingMode: "zero",
        openingReason: "",
      },
      idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      mode: "update",
    });
    expect(result.command).toBeNull();
    expect(result.issues.form).toBe("no-changes");
  });

  test("binds adjustments to a selected active account instead of accepting a raw identifier", () => {
    const selected = account();
    const result = buildCashAdjustmentCommand({
      account: selected,
      draft: {
        accountId: selected.id,
        amount: "3.25",
        direction: "out",
        localDate: "2026-08-22",
        localTime: "10:15",
        reason: "Corrección de caja",
      },
      idempotencyKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    });
    expect(result.command).toMatchObject({
      accountId: selected.id,
      amountMinorUnits: "325",
      currency: "USD",
      idempotencyKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    });
  });

  test("rejects a same-account transfer and builds a paired-account review", () => {
    const from = account();
    const to = account({
      id: "22222222-2222-4222-8222-222222222222",
      name: "Banco",
    });
    const common = {
      amount: "20.00",
      fromAccountId: from.id,
      localDate: "2026-08-22",
      localTime: "11:00",
      note: "Traslado",
    };
    expect(
      buildCashTransferCommand({
        accounts: [from, to],
        draft: { ...common, toAccountId: from.id },
        idempotencyKey: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      }).issues.toAccountId,
    ).toBe("accounts-must-differ");
    expect(
      buildCashTransferCommand({
        accounts: [from, to],
        draft: { ...common, toAccountId: to.id },
        idempotencyKey: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      }).command,
    ).toMatchObject({
      amountMinorUnits: "2000",
      fromAccountId: from.id,
      idempotencyKey: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      toAccountId: to.id,
    });
  });

  test("builds a dated reversal and treats a network mutation result as uncertain", () => {
    expect(
      buildCashReversalCommand({
        draft: {
          localDate: "2026-08-22",
          localTime: "12:00",
          reason: "Ajuste duplicado",
        },
        idempotencyKey: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      }).command,
    ).toMatchObject({ idempotencyKey: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" });
    expect(
      cashConfirmationState({
        error: new ApiClientError("unreachable", 0),
        isError: true,
        isPending: false,
      }),
    ).toBe("uncertain");
  });
});

describe("cash money formatting", () => {
  test("formats signed minor-unit balances without corrupting small negatives", () => {
    expect(formatCashMinorUnits("-5", "USD", 2, "es-SV")).toContain("0.05");
    expect(formatCashMinorUnits("-5", "USD", 2, "es-SV").startsWith("-")).toBe(true);
  });
});
