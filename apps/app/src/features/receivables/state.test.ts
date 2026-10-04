import type { Receivable, ReceivablePayment } from "@pisto/contracts";
import { describe, expect, test } from "vitest";

import { parseReceivableListParams, receivableListSearchParams } from "./list-params";
import { acceptsPayment, acceptsVoid, isReversed } from "./rules";
import type { ReceivablesLoadState } from "./types";

const receivable: Receivable = {
  id: "30000000-0000-4000-8000-000000000001",
  customerId: "30000000-0000-4000-8000-000000000002",
  state: "open",
  originalMinorUnits: "2500",
  paidMinorUnits: "0",
  outstandingMinorUnits: "2500",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  description: "Pedido",
  postedDate: "2026-09-01",
  dueDate: null,
  voidedAt: null,
  voidReason: null,
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z",
};

describe("receivables UI states", () => {
  test("cannot represent a failed query as a successful zero summary", () => {
    const error: ReceivablesLoadState = { kind: "error" };
    expect("summary" in error).toBe(false);
  });

  test("offers payments only while money is owed by an active customer", () => {
    expect(acceptsPayment(receivable, true)).toBe(true);
    expect(acceptsPayment({ ...receivable, state: "overdue" }, true)).toBe(true);
    expect(acceptsPayment(receivable, false)).toBe(false);
    expect(acceptsPayment({ ...receivable, state: "paid", outstandingMinorUnits: "0" }, true)).toBe(
      false,
    );
    expect(acceptsPayment({ ...receivable, state: "voided" }, true)).toBe(false);
  });

  test("offers voiding only without net payments", () => {
    expect(acceptsVoid(receivable)).toBe(true);
    expect(acceptsVoid({ ...receivable, paidMinorUnits: "1" })).toBe(false);
    expect(acceptsVoid({ ...receivable, state: "voided" })).toBe(false);
  });

  test("recognizes a payment that already has its reversal", () => {
    const payment = { id: "payment", kind: "payment" } as ReceivablePayment;
    const reversal = {
      id: "reversal",
      kind: "reversal",
      reversesPaymentId: "payment",
    } as ReceivablePayment;
    expect(isReversed(payment, [payment])).toBe(false);
    expect(isReversed(payment, [payment, reversal])).toBe(true);
  });
});

describe("receivable list filters in the URL", () => {
  test("reads known filters and ignores malformed ones", () => {
    expect(parseReceivableListParams({})).toEqual({ customerId: undefined, state: "all" });
    expect(
      parseReceivableListParams({ customerId: receivable.customerId, state: "overdue" }),
    ).toEqual({ customerId: receivable.customerId, state: "overdue" });
    expect(parseReceivableListParams({ customerId: "not-a-uuid", state: "late" })).toEqual({
      customerId: undefined,
      state: "all",
    });
    expect(parseReceivableListParams({ state: ["paid", "open"] })).toMatchObject({
      state: "paid",
    });
  });

  test("writes only non-default filters back to the URL", () => {
    expect(receivableListSearchParams({ state: "all" })).toEqual({
      customerId: undefined,
      state: undefined,
    });
    expect(
      receivableListSearchParams({ customerId: receivable.customerId, state: "voided" }),
    ).toEqual({ customerId: receivable.customerId, state: "voided" });
  });
});
