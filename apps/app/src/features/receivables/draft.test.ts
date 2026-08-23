import { describe, expect, test } from "vitest";

import type { Customer } from "@pisto/contracts";
import type { CashAccountChoice } from "./cash-account-source";
import { buildPaymentCommand, buildPostReceivableCommand, isActualLocalDate } from "./draft";

const customer: Customer = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "Cliente Uno",
  phone: null,
  email: null,
  notes: null,
  status: "active",
  createdAt: "2026-08-22T12:00:00.000Z",
  updatedAt: "2026-08-22T12:00:00.000Z",
};

const account: CashAccountChoice = {
  id: "20000000-0000-4000-8000-000000000002",
  name: "Caja principal",
  status: "active",
};

describe("receivable drafts", () => {
  test("rejects impossible calendar dates before review", () => {
    expect(isActualLocalDate("2026-02-29")).toBe(false);
    expect(isActualLocalDate("2028-02-29")).toBe(true);
  });

  test("builds an exact minor-unit charge without client currency input", () => {
    const result = buildPostReceivableCommand(
      {
        amount: "12.50",
        description: "Pedido de agosto",
        postedDate: "2026-08-22",
        dueDate: "2026-09-01",
      },
      customer,
      2,
      "20000000-0000-4000-8000-000000000003",
    );
    expect(result).toMatchObject({
      command: {
        customerId: customer.id,
        originalMinorUnits: "1250",
        postedDate: "2026-08-22",
      },
    });
    expect("command" in result && "currency" in result.command).toBe(false);
  });

  test("requires a real active account and blocks a local overpayment", () => {
    const missingAccount = buildPaymentCommand(
      { amount: "5.00", date: "2026-08-22", time: "09:30", reference: "" },
      null,
      2,
      "1000",
      "20000000-0000-4000-8000-000000000004",
    );
    expect(missingAccount).toEqual({ issues: { cashAccount: "cash-account" } });

    const overpayment = buildPaymentCommand(
      { amount: "10.01", date: "2026-08-22", time: "09:30", reference: "" },
      account,
      2,
      "1000",
      "20000000-0000-4000-8000-000000000005",
    );
    expect(overpayment).toEqual({ issues: { amount: "overpayment" } });
  });
});
