import type { AssistantSaleDraft, Product, ProductStock } from "@pisto/contracts";
import { describe, expect, test } from "vitest";

import {
  addProductLine,
  defaultAccountFor,
  draftFromAssistant,
  draftTotals,
  type ItemizedSaleDraft,
  lineSubtotalMinorUnits,
  stepQuantity,
  validateItemizedDraft,
} from "./itemized-draft";

function product(id: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    categoryId: null,
    name: `Product ${id.slice(0, 4)}`,
    sku: null,
    sellingPriceMinorUnits: "325",
    sellingPriceCurrency: "USD",
    sellingPriceCurrencyMinorUnitDigits: 2,
    unitKind: "unit",
    quantityPrecision: 0,
    tracked: true,
    lowStockThresholdMinorUnits: null,
    status: "active",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

function stock(productId: string, onHandMinorUnits: string, precision = 0): ProductStock {
  return {
    productId,
    quantityPrecision: precision,
    onHandMinorUnits,
    lowStockThresholdMinorUnits: null,
    lowStock: false,
  };
}

const coffee = product("11111111-1111-4111-8111-111111111111");
const cheese = product("22222222-2222-4222-8222-222222222222", {
  quantityPrecision: 3,
  unitKind: "kilogram",
  sellingPriceMinorUnits: "333",
});
const customer = { id: "33333333-3333-4333-8333-333333333333", name: "Carlos Rivas" };
const cashAccount = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "Caja",
  kind: "cash" as const,
};
const bankAccount = {
  id: "55555555-5555-4555-8555-555555555555",
  name: "Banco",
  kind: "bank" as const,
};

function draft(overrides: Partial<ItemizedSaleDraft> = {}): ItemizedSaleDraft {
  return {
    customer: null,
    date: "2026-11-02",
    time: "10:15",
    lines: [{ product: coffee, stock: stock(coffee.id, "12"), quantity: "2", unitPrice: "3.25" }],
    note: "",
    received: "",
    receivedEdited: false,
    method: "cash",
    accountId: cashAccount.id,
    dueDate: "",
    ...overrides,
  };
}

describe("itemized sale amounts", () => {
  test("rounds half up exactly like the server", () => {
    expect(lineSubtotalMinorUnits("1250", "333", 3)).toBe("416");
    expect(lineSubtotalMinorUnits("5", "1", 1)).toBe("1");
    expect(lineSubtotalMinorUnits("4", "1", 1)).toBe("0");
    expect(lineSubtotalMinorUnits("3000000000", "3000000000", 0)).toBe("9000000000000000000");
  });

  test("the received amount follows the total until the person types one", () => {
    expect(draftTotals(draft(), 2)).toEqual({
      totalMinorUnits: "650",
      receivedMinorUnits: "650",
      balanceMinorUnits: "0",
    });
    expect(draftTotals(draft({ received: "2", receivedEdited: true }), 2)).toEqual({
      totalMinorUnits: "650",
      receivedMinorUnits: "200",
      balanceMinorUnits: "450",
    });
    expect(draftTotals(draft({ received: "", receivedEdited: true }), 2).balanceMinorUnits).toBe(
      "650",
    );
  });
});

describe("itemized sale validation", () => {
  test("builds a paid counter sale with the price the person saw", () => {
    expect(validateItemizedDraft(draft({ note: "  Mostrador  " }), 2)).toEqual({
      issues: { sale: {}, lines: {} },
      command: {
        occurredLocalDate: "2026-11-02",
        occurredLocalTime: "10:15",
        description: "Mostrador",
        lines: [{ productId: coffee.id, quantityMinorUnits: "2", unitPriceMinorUnits: "325" }],
        payment: { method: "cash", accountId: cashAccount.id, receivedMinorUnits: "650" },
      },
    });
  });

  test("a balance needs the customer and the agreed date, and the date not before the sale", () => {
    const owing = draft({ received: "1", receivedEdited: true });
    expect(validateItemizedDraft(owing, 2).issues.sale).toEqual({
      customer: "customer-required",
      dueDate: "due-date-required",
    });
    expect(
      validateItemizedDraft({ ...owing, customer, dueDate: "2026-11-01" }, 2).issues.sale,
    ).toEqual({ dueDate: "due-date-before-sale" });
    expect(
      validateItemizedDraft({ ...owing, customer, dueDate: "2026-11-30" }, 2).command,
    ).toMatchObject({
      customerId: customer.id,
      dueDate: "2026-11-30",
      payment: { receivedMinorUnits: "100" },
    });
  });

  test("a sale entirely on credit sends no payment", () => {
    const command = validateItemizedDraft(
      draft({
        customer,
        dueDate: "2026-11-30",
        received: "0",
        receivedEdited: true,
        accountId: null,
      }),
      2,
    ).command;
    expect(command).not.toHaveProperty("payment");
    expect(command).toMatchObject({ dueDate: "2026-11-30" });
  });

  test("refuses overpayment, missing account, short stock and malformed lines", () => {
    expect(
      validateItemizedDraft(draft({ received: "7", receivedEdited: true }), 2).issues.sale,
    ).toEqual({ received: "received-exceeds" });
    expect(validateItemizedDraft(draft({ accountId: null }), 2).issues.sale).toEqual({
      account: "account-required",
    });
    const lines = [
      { product: coffee, stock: stock(coffee.id, "1"), quantity: "2", unitPrice: "3.25" },
      {
        product: cheese,
        stock: stock(cheese.id, "9000", 3),
        quantity: "1.2345",
        unitPrice: "3.33",
      },
    ];
    const result = validateItemizedDraft(draft({ lines }), 2);
    expect(result.issues.lines).toEqual({ [coffee.id]: "stock", [cheese.id]: "quantity-decimals" });
    expect(result.command).toBeNull();
    expect(validateItemizedDraft(draft({ lines: [] }), 2).issues.sale).toEqual({
      lines: "lines-required",
    });
  });
});

describe("itemized sale lines", () => {
  test("adding a product twice adds one more unit instead of a second line", () => {
    const once = addProductLine([], coffee, stock(coffee.id, "12"));
    const twice = addProductLine(once, coffee, stock(coffee.id, "12"));
    expect(once).toEqual([
      { product: coffee, stock: stock(coffee.id, "12"), quantity: "1", unitPrice: "3.25" },
    ]);
    expect(twice.map(({ quantity }) => quantity)).toEqual(["2"]);
  });

  test("steps whole units and never below the smallest quantity", () => {
    const line = { product: cheese, stock: null, quantity: "1.250", unitPrice: "3.33" };
    expect(stepQuantity(line, 1)).toBe("2.250");
    expect(stepQuantity(line, -1)).toBe("0.250");
    expect(stepQuantity({ ...line, quantity: "0.250" }, -1)).toBe("0.250");
  });

  test("picks a default account by the kind a payment method lands in", () => {
    expect(defaultAccountFor("cash", [bankAccount, cashAccount])).toBe(cashAccount.id);
    expect(defaultAccountFor("transfer", [cashAccount, bankAccount])).toBe(bankAccount.id);
    expect(defaultAccountFor("card", [cashAccount])).toBeNull();
  });
});

describe("assistant draft prefill", () => {
  const assistant: AssistantSaleDraft = {
    kind: "sale",
    occurredLocalDate: "2026-11-02",
    occurredLocalTime: "09:30",
    customer: { heard: "don Carlos", match: { ...customer, exact: false } },
    lines: [
      {
        heard: "tres libras de café",
        product: { id: coffee.id, name: coffee.name, exact: true },
        quantityMinorUnits: "3",
        quantityPrecision: 0,
        unitAmountMinorUnits: null,
        subtotalMinorUnits: null,
      },
      {
        heard: "una bolsa de hielo",
        product: null,
        quantityMinorUnits: "1",
        quantityPrecision: 0,
        unitAmountMinorUnits: null,
        subtotalMinorUnits: null,
      },
    ],
    totalMinorUnits: null,
    receivedMinorUnits: "500",
    creditMinorUnits: null,
    paymentMethod: null,
    account: null,
    dueDate: null,
    description: null,
  };

  test("fills what the draft resolved and leaves the rest empty", () => {
    const prefill = draftFromAssistant({
      accounts: [cashAccount, bankAccount],
      assistant,
      currencyDigits: 2,
      products: new Map([[coffee.id, { product: coffee, stock: stock(coffee.id, "12") }]]),
    });
    expect(prefill.unmatched).toEqual(["una bolsa de hielo"]);
    expect(prefill.draft).toEqual({
      customer,
      date: "2026-11-02",
      time: "09:30",
      lines: [{ product: coffee, stock: stock(coffee.id, "12"), quantity: "3", unitPrice: "3.25" }],
      note: "",
      received: "5.00",
      receivedEdited: true,
      method: "cash",
      accountId: cashAccount.id,
      dueDate: "",
    });
  });
});
