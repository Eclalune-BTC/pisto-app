import type { Movement } from "@pisto/contracts";
import type { TFunction } from "i18next";
import { describe, expect, test, vi } from "vitest";

vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));

import { i18n } from "@/i18n/config";
import { isIncoming, movementHref, movementSubtitle, movementTitle } from "./presentation";

const t = i18n.t.bind(i18n) as TFunction;
const money = (minorUnits: string) => `$${(Number(minorUnits) / 100).toFixed(2)}`;

function movement(
  kind: Movement["kind"],
  overrides: Partial<Omit<Movement, "facts">> = {},
  facts: Partial<Movement["facts"]> = {},
): Movement {
  return {
    kind,
    recordId: "5f307872-b71d-41ed-887f-ee872bcc6a44",
    parentRecordId: null,
    occurredAt: "2026-11-02T14:45:00.000Z",
    occurredLocalDate: "2026-11-02",
    occurredLocalTime: "08:45",
    amountMinorUnits: "2140",
    accountId: null,
    accountName: null,
    entrySource: "manual",
    ...overrides,
    facts: {
      description: null,
      counterpartyName: null,
      expenseCategory: null,
      reference: null,
      lineCount: null,
      totalMinorUnits: null,
      ...facts,
    },
  };
}

describe("movement presentation", () => {
  test("words sales the way the prototype does", () => {
    expect(movementTitle(t, movement("sale"))).toBe("Venta");
    expect(movementTitle(t, movement("sale", {}, { description: "Venta de mostrador" }))).toBe(
      "Venta de mostrador",
    );
    const credit = movement(
      "sale",
      { amountMinorUnits: "500" },
      { counterpartyName: "Carlos Rivas", lineCount: "1", totalMinorUnits: "975" },
    );
    expect(movementTitle(t, credit)).toBe("Venta a Carlos Rivas");
    expect(movementSubtitle(t, credit, money)).toBe("1 producto · Pagó $5.00 de $9.75");
  });

  test("names the category and payee of an expense without repeating the title", () => {
    const expense = movement(
      "expense",
      { amountMinorUnits: "-6420" },
      { description: "Factura de luz", counterpartyName: "CAESS", expenseCategory: "utilities" },
    );
    expect(movementTitle(t, expense)).toBe("Factura de luz");
    expect(movementSubtitle(t, expense, money)).toBe("Servicios · CAESS");
    expect(isIncoming(expense)).toBe(false);
    expect(isIncoming(movement("sale"))).toBe(true);
  });

  test("opens the record behind each row", () => {
    expect(movementHref(movement("sale"))).toEqual({
      pathname: "/operate/sales/[saleId]",
      params: { saleId: "5f307872-b71d-41ed-887f-ee872bcc6a44" },
    });
    const abono = movement(
      "receivable_payment",
      { parentRecordId: "95f7e68f-adde-44d8-836c-38488ec66a1d" },
      { counterpartyName: "Ana Guzmán" },
    );
    expect(movementTitle(t, abono)).toBe("Abono de Ana Guzmán");
    expect(movementSubtitle(t, abono, money)).toBe("Abono a su cuenta");
    expect(movementHref(abono)).toEqual({
      pathname: "/operate/receivables/[receivableId]",
      params: { receivableId: "95f7e68f-adde-44d8-836c-38488ec66a1d" },
    });
    expect(() => movementHref(movement("receivable_payment"))).toThrow();
    expect(movementHref(movement("purchase"))).toEqual({
      pathname: "/operate/purchases/[purchaseId]",
      params: { purchaseId: "5f307872-b71d-41ed-887f-ee872bcc6a44" },
    });
    expect(() => movementHref(movement("supplier_payment"))).toThrow();
  });
});
