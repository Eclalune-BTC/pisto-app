import type { CashAccount, ReceivableAging } from "@pisto/contracts";
import { describe, expect, test } from "vitest";

import { accountsForMethod, agingShares, daysPastDue, quickAmounts } from "./receivable-figures";

const account = (id: string, kind: CashAccount["kind"], status: CashAccount["status"] = "active") =>
  ({ id, kind, status }) as CashAccount;

describe("payment form choices", () => {
  const accounts = [
    account("caja", "cash"),
    account("banco", "bank"),
    account("billetera", "mobile_money"),
    account("caja-vieja", "cash", "archived"),
  ];

  test("cash goes into active cash boxes and a transfer into any other active account", () => {
    expect(accountsForMethod(accounts, "cash").map(({ id }) => id)).toEqual(["caja"]);
    expect(accountsForMethod(accounts, "transfer").map(({ id }) => id)).toEqual([
      "banco",
      "billetera",
    ]);
  });

  test("offers whole-currency shortcuts only below the balance", () => {
    expect(quickAmounts("5475", 2)).toEqual(["1000", "2000"]);
    expect(quickAmounts("2000", 2)).toEqual(["1000"]);
    expect(quickAmounts("900", 2)).toEqual([]);
    expect(quickAmounts("25", 0)).toEqual(["10", "20"]);
  });
});

describe("receivable aging", () => {
  const bucket = (outstandingMinorUnits: string) => ({
    outstandingMinorUnits,
    receivableCount: "1",
  });

  test("splits the open balance exactly, in hundredths of a percent", () => {
    const aging: ReceivableAging = {
      current: bucket("67400"),
      days1To30: bucket("39800"),
      days31To60: bucket("21250"),
      over60: bucket("0"),
    };
    expect(agingShares(aging)).toEqual({
      current: 5247,
      days1To30: 3098,
      days31To60: 1654,
      over60: 0,
    });
  });

  test("an empty position has no shares instead of dividing by zero", () => {
    const aging: ReceivableAging = {
      current: bucket("0"),
      days1To30: bucket("0"),
      days31To60: bucket("0"),
      over60: bucket("0"),
    };
    expect(Object.values(agingShares(aging))).toEqual([0, 0, 0, 0]);
  });

  test("counts whole calendar days past due across months and leap days", () => {
    expect(daysPastDue("2026-10-31", "2026-11-02")).toBe(2);
    expect(daysPastDue("2028-02-28", "2028-03-01")).toBe(2);
    expect(daysPastDue("2026-11-02", "2026-11-02")).toBe(0);
  });
});
