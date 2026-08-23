import { describe, expect, test } from "bun:test";

import {
  decodeCashCursor,
  encodeCashCursor,
  fingerprintCashCommand,
  nextCalendarDate,
  parseCashMinorUnits,
} from "../src/cash.ts";
import { ProductError } from "../src/product.ts";

describe("cash domain primitives", () => {
  test("parses exact positive int64 minor units", () => {
    expect(parseCashMinorUnits("1")).toBe(1n);
    expect(parseCashMinorUnits("9223372036854775807")).toBe(9_223_372_036_854_775_807n);
    for (const invalid of ["0", "-1", "01", "1.5", "9223372036854775808"]) {
      expect(() => parseCashMinorUnits(invalid)).toThrow(ProductError);
    }
  });

  test("fingerprints the action and exact payload but never the idempotency key", async () => {
    const payload = {
      accountId: "71402e0c-b17d-4d8c-83ae-8d163d10d51d",
      amountMinorUnits: "1250",
      currency: "USD",
    };
    const first = await fingerprintCashCommand("cash.adjust", payload);
    const exactReplay = await fingerprintCashCommand("cash.adjust", payload);
    const changedAmount = await fingerprintCashCommand("cash.adjust", {
      ...payload,
      amountMinorUnits: "1251",
    });
    const changedAction = await fingerprintCashCommand("cash.transfer", payload);

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(exactReplay).toBe(first);
    expect(changedAmount).not.toBe(first);
    expect(changedAction).not.toBe(first);
  });

  test("round-trips an opaque deterministic cursor and rejects tampering", () => {
    const payload = {
      createdAt: "2026-08-22T15:00:00.000Z",
      id: "71402e0c-b17d-4d8c-83ae-8d163d10d51d",
    };
    const cursor = encodeCashCursor(payload);
    expect(cursor).not.toContain(payload.createdAt);
    expect(decodeCashCursor(cursor)).toEqual(payload);
    expect(() => decodeCashCursor("not-a-cursor")).toThrow(ProductError);
  });

  test("advances real calendar dates and rejects impossible dates", () => {
    expect(nextCalendarDate("2024-02-29")).toBe("2024-03-01");
    expect(nextCalendarDate("2026-12-31")).toBe("2027-01-01");
    expect(() => nextCalendarDate("2026-02-30")).toThrow(ProductError);
  });
});
