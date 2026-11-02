import { describe, expect, test } from "vitest";

import {
  balanceAfterPayment,
  buildPurchaseCommand,
  buildSupplierPaymentCommand,
  defaultDueDate,
  type PurchaseDraft,
  previewSubtotal,
  previewTotal,
} from "@/features/purchases/draft";

const supplier = { id: "8f07cf88-4fee-4c54-9ce8-49823d12af68", name: "Centro", creditDays: 14 };
const account = { id: "2a903e1a-fe22-4b26-b657-0ca5fdc8ac90", name: "Caja" };
const productId = "06a0a76b-5fa7-4687-8086-8525c90d59d7";
const idempotencyKey = "85d434e5-a7fd-49b7-9f12-38aa80a920ae";

const draft = (overrides: Partial<PurchaseDraft> = {}): PurchaseDraft => ({
  account: null,
  date: "2026-11-02",
  dueDate: "2026-11-16",
  invoiceNumber: " F-004512 ",
  lines: [
    {
      key: "a",
      productId,
      productName: "Gaseosa",
      quantityPrecision: 0,
      quantity: "48",
      unitCost: "1.60",
    },
  ],
  paymentTerms: "credit",
  received: true,
  supplier,
  time: "09:30",
  ...overrides,
});

const input = { currencyMinorUnitDigits: 2, entrySource: "manual" as const, idempotencyKey };

describe("purchase draft", () => {
  test("previews line costs with the server's half-up rule", () => {
    expect(previewSubtotal({ quantity: "48", quantityPrecision: 0, unitCost: "1.60" }, 2)).toBe(
      "7680",
    );
    expect(previewSubtotal({ quantity: "1.25", quantityPrecision: 3, unitCost: "3.99" }, 2)).toBe(
      "499",
    );
    expect(previewSubtotal({ quantity: "0", quantityPrecision: 0, unitCost: "1" }, 2)).toBeNull();
    expect(previewSubtotal({ quantity: "1.5", quantityPrecision: 0, unitCost: "1" }, 2)).toBeNull();
    expect(previewTotal(draft().lines, 2)).toBe("7680");
    expect(previewTotal([], 2)).toBeNull();
  });

  test("starts a credit purchase due after the supplier's credit days", () => {
    expect(defaultDueDate("2026-11-25", 14)).toBe("2026-12-09");
    expect(defaultDueDate("2026-11-25", null)).toBe("2026-11-25");
  });

  test("builds a strict credit command with the trimmed invoice", () => {
    const result = buildPurchaseCommand(draft(), input);
    expect("command" in result && result.command).toEqual({
      idempotencyKey,
      supplierId: supplier.id,
      invoiceNumber: "F-004512",
      occurredLocalDate: "2026-11-02",
      occurredLocalTime: "09:30",
      lines: [{ productId, quantityMinorUnits: "48", unitCostMinorUnits: "160" }],
      received: true,
      paymentTerms: "credit",
      dueDate: "2026-11-16",
      entrySource: "manual",
    });
  });

  test("pays a cash purchase from the chosen account and sends no due date", () => {
    const result = buildPurchaseCommand(draft({ paymentTerms: "cash", account }), input);
    expect("command" in result && result.command).toMatchObject({
      paymentTerms: "cash",
      accountId: account.id,
    });
    expect("command" in result && "dueDate" in result.command).toBe(false);
    expect(buildPurchaseCommand(draft({ paymentTerms: "cash" }), input).issues).toEqual({
      account: "account",
    });
  });

  test("names every invalid field instead of building a command", () => {
    const result = buildPurchaseCommand(
      draft({
        supplier: null,
        dueDate: "2026-11-01",
        lines: [{ ...draft().lines[0], key: "a", quantity: "", unitCost: "abc" } as never],
      }),
      input,
    );
    expect("command" in result).toBe(false);
    expect(result.issues).toEqual({
      supplier: "supplier",
      dueDate: "due-before-date",
      lineQuantities: { a: "quantity" },
      lineCosts: { a: "unit-cost" },
    });
    expect(buildPurchaseCommand(draft({ lines: [] }), input).issues).toEqual({ lines: "lines" });
    const free = draft();
    free.lines = [{ ...free.lines[0], unitCost: "0" } as never];
    expect(buildPurchaseCommand(free, input).issues).toEqual({ lines: "total" });
  });
});

describe("supplier payment draft", () => {
  const payment = { account, amount: "20", date: "2026-11-02", reference: "", time: "10:00" };
  const paymentInput = { ...input, balanceMinorUnits: "5475" };

  test("previews the balance after a valid amount only", () => {
    expect(balanceAfterPayment("5475", "20", 2)).toBe("3475");
    expect(balanceAfterPayment("5475", "54.75", 2)).toBe("0");
    expect(balanceAfterPayment("5475", "60", 2)).toBeNull();
    expect(balanceAfterPayment("5475", "", 2)).toBeNull();
  });

  test("refuses more than the balance and requires an account", () => {
    expect(
      buildSupplierPaymentCommand({ ...payment, amount: "54.76" }, paymentInput).issues,
    ).toEqual({ amount: "overpayment" });
    expect(buildSupplierPaymentCommand({ ...payment, account: null }, paymentInput).issues).toEqual(
      {
        account: "account",
      },
    );
  });

  test("builds the strict payment command", () => {
    const result = buildSupplierPaymentCommand({ ...payment, reference: " Abono " }, paymentInput);
    expect("command" in result && result.command).toEqual({
      idempotencyKey,
      accountId: account.id,
      amountMinorUnits: "2000",
      occurredLocalDate: "2026-11-02",
      occurredLocalTime: "10:00",
      reference: "Abono",
      entrySource: "manual",
    });
  });
});
