import { describe, expect, test } from "bun:test";

import {
  addCalendarDays,
  derivePayable,
  lineSubtotalMinorUnits,
} from "../src/purchases/mappers.ts";

describe("purchase money", () => {
  test("multiplies whole units exactly", () => {
    expect(lineSubtotalMinorUnits(48n, 160n, 0)).toBe(7_680n);
    expect(lineSubtotalMinorUnits(1n, 0n, 0)).toBe(0n);
  });

  test("scales fractional quantities by their precision and rounds half up", () => {
    // 1.250 kg at $3.99 = $4.9875 -> $4.99
    expect(lineSubtotalMinorUnits(1_250n, 399n, 3)).toBe(499n);
    // 0.5 at $0.01 = $0.005 -> $0.01, the half rounds up
    expect(lineSubtotalMinorUnits(5n, 1n, 1)).toBe(1n);
    // 0.4 at $0.01 = $0.004 -> $0.00
    expect(lineSubtotalMinorUnits(4n, 1n, 1)).toBe(0n);
    // 2.25 at $1.05 = $2.3625 -> $2.36
    expect(lineSubtotalMinorUnits(225n, 105n, 2)).toBe(236n);
  });

  test("keeps 64-bit products exact", () => {
    expect(lineSubtotalMinorUnits(9_000_000_000n, 1_000_000_000n, 3)).toBe(9_000_000_000_000_000n);
  });

  test("refuses a non-positive quantity or a negative cost", () => {
    expect(() => lineSubtotalMinorUnits(0n, 100n, 0)).toThrow();
    expect(() => lineSubtotalMinorUnits(1n, -1n, 0)).toThrow();
  });
});

describe("payable state", () => {
  const today = "2026-11-02";
  const owed = (dueDate: string | null) =>
    derivePayable({
      dueDate,
      localDate: today,
      paidMinorUnits: 1_000n,
      status: "posted",
      totalMinorUnits: 5_000n,
    });

  test("is overdue only after the due date in the business calendar", () => {
    expect(owed("2026-11-01")).toEqual({ balanceMinorUnits: 4_000n, state: "overdue" });
    expect(owed("2026-11-02").state).toBe("due_soon");
  });

  test("is due soon within seven days and open after that", () => {
    expect(owed("2026-11-09").state).toBe("due_soon");
    expect(owed("2026-11-10").state).toBe("open");
    expect(owed(null).state).toBe("open");
  });

  test("is paid at a zero balance, whatever the due date", () => {
    expect(
      derivePayable({
        dueDate: "2026-10-01",
        localDate: today,
        paidMinorUnits: 5_000n,
        status: "posted",
        totalMinorUnits: 5_000n,
      }),
    ).toEqual({ balanceMinorUnits: 0n, state: "paid" });
  });

  test("owes nothing on a voided purchase", () => {
    expect(
      derivePayable({
        dueDate: "2026-10-01",
        localDate: today,
        paidMinorUnits: 0n,
        status: "voided",
        totalMinorUnits: 5_000n,
      }),
    ).toEqual({ balanceMinorUnits: 0n, state: "paid" });
  });

  test("fails loudly on an overpaid history or an unknown status", () => {
    expect(() =>
      derivePayable({
        dueDate: null,
        localDate: today,
        paidMinorUnits: 6_000n,
        status: "posted",
        totalMinorUnits: 5_000n,
      }),
    ).toThrow();
    expect(() =>
      derivePayable({
        dueDate: null,
        localDate: today,
        paidMinorUnits: 0n,
        status: "draft",
        totalMinorUnits: 5_000n,
      }),
    ).toThrow();
  });

  test("adds calendar days across month and year ends", () => {
    expect(addCalendarDays("2026-12-28", 7)).toBe("2027-01-04");
    expect(addCalendarDays("2028-02-25", 7)).toBe("2028-03-03");
  });
});
