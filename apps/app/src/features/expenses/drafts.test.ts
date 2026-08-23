import { describe, expect, test } from "vitest";
import type { CashAccount } from "../../../../../packages/contracts/src/cash.ts";

import { buildExpenseCommand, buildVoidExpenseCommand } from "./drafts";

const activeAccount: CashAccount = {
  allowNegativeBalance: false,
  balanceMinorUnits: "10000",
  createdAt: "2026-08-22T12:00:00.000Z",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  id: "11111111-1111-4111-8111-111111111111",
  kind: "cash",
  name: "Caja",
  status: "active",
  updatedAt: "2026-08-22T12:00:00.000Z",
};

describe("expense draft commands", () => {
  test("builds an exact paid-expense review from an active account", () => {
    const result = buildExpenseCommand({
      accounts: [activeAccount],
      draft: {
        accountId: activeAccount.id,
        amount: "14.75",
        category: "utilities",
        description: "  Energía eléctrica  ",
        localDate: "2026-08-22",
        localTime: "14:30",
        payee: "  Proveedor  ",
      },
      idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(result.issues).toEqual({});
    expect(result.command).toEqual({
      accountId: activeAccount.id,
      amountMinorUnits: "1475",
      category: "utilities",
      currency: "USD",
      description: "Energía eléctrica",
      idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      occurredLocalDate: "2026-08-22",
      occurredLocalTime: "14:30",
      payee: "Proveedor",
    });
  });

  test("rejects archived account choices", () => {
    const result = buildExpenseCommand({
      accounts: [{ ...activeAccount, status: "archived" }],
      draft: {
        accountId: activeAccount.id,
        amount: "1.00",
        category: "other",
        description: "Compra",
        localDate: "2026-08-22",
        localTime: "14:30",
        payee: "",
      },
      idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    expect(result.command).toBeNull();
    expect(result.issues.accountId).toBe("account-required");
  });

  test("keeps the same caller key in the exact void review", () => {
    expect(
      buildVoidExpenseCommand({
        draft: {
          localDate: "2026-08-22",
          localTime: "15:00",
          reason: "Registro duplicado",
        },
        idempotencyKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      }).command,
    ).toEqual({
      idempotencyKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      occurredLocalDate: "2026-08-22",
      occurredLocalTime: "15:00",
      reason: "Registro duplicado",
    });
  });
});
