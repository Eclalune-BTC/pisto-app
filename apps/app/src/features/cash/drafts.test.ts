import type { CashAccount } from "@pisto/contracts";
import { describe, expect, test } from "vitest";
import { formatLocalizedDateTime, formatLocalMoment } from "@/i18n/format";
import { ApiClientError } from "@/lib/api-error";
import { formatMinorUnits } from "@/lib/money";
import { isLockedPhase, mutationPhase, withStableIdempotencyKey } from "@/lib/mutation-phase";
import {
  buildCashAccountCommand,
  buildCashAdjustmentCommand,
  buildCashReversalCommand,
  buildCashTransferCommand,
} from "./drafts";

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

describe("reviewed local occurrence", () => {
  test("keeps the typed minute whatever the device time zone", () => {
    expect(formatLocalMoment("2026-09-10", "23:30", "es-SV")).toBe(
      formatLocalizedDateTime("2026-09-10T23:30:00.000Z", "es-SV", "UTC"),
    );
    expect(() => formatLocalMoment("2026-02-30", "10:00", "es-SV")).toThrow();
  });
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

  test("reports a blank amount as missing and a malformed one as invalid", () => {
    const draft = {
      accountId: account().id,
      direction: "in" as const,
      localDate: "2026-08-22",
      localTime: "10:15",
      reason: "Conteo",
    };
    const issues = (amount: string) =>
      buildCashAdjustmentCommand({
        account: account(),
        draft: { ...draft, amount },
        idempotencyKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      }).issues.amount;
    expect(issues("  ")).toBe("required");
    expect(issues("1,500")).toBe("invalid-amount");
    expect(issues("0")).toBe("invalid-amount");
    expect(issues("3.25")).toBeUndefined();
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
      mutationPhase({
        error: new ApiClientError("unreachable", 0),
        isError: true,
        isPending: false,
      }),
    ).toBe("uncertain");
  });
});

describe("cash mutation phases", () => {
  test.each([
    [{ error: null, isError: false, isPending: true }, "pending"],
    [{ error: null, isError: false, isPending: false }, "idle"],
    [
      { error: new ApiClientError("conflict", 409, "CONFLICT"), isError: true, isPending: false },
      "failed",
    ],
    [{ error: new ApiClientError("lost", 502), isError: true, isPending: false }, "uncertain"],
    [
      {
        error: new ApiClientError("paused", 503, "WRITES_PAUSED"),
        isError: true,
        isPending: false,
      },
      "failed",
    ],
  ] as const)("classifies %j as %s", (mutation, phase) => {
    expect(mutationPhase(mutation)).toBe(phase);
  });

  test("locks inputs and exits only while the outcome is pending or unknown", () => {
    expect(isLockedPhase("pending")).toBe(true);
    expect(isLockedPhase("uncertain")).toBe(true);
    expect(isLockedPhase("failed")).toBe(false);
    expect(isLockedPhase("idle")).toBe(false);
  });

  test("reuses the idempotency key only for an unchanged command", () => {
    const sent = {
      idempotencyKey: "first-key",
      reason: "Duplicado",
      occurredLocalDate: "2026-08-22",
    };
    const rebuilt = { ...sent, idempotencyKey: "second-key" };
    expect(withStableIdempotencyKey(undefined, rebuilt)).toBe(rebuilt);
    expect(withStableIdempotencyKey(sent, rebuilt)).toBe(sent);
    const edited = { ...rebuilt, reason: "Registro duplicado" };
    expect(withStableIdempotencyKey(sent, edited)).toBe(edited);
  });
});

describe("cash money formatting", () => {
  test("formats signed minor-unit balances without corrupting small negatives", () => {
    expect(formatMinorUnits("-5", "USD", 2, "es-SV")).toContain("0.05");
    expect(formatMinorUnits("-5", "USD", 2, "es-SV").startsWith("−")).toBe(true);
  });
});
