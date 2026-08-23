import { describe, expect, test } from "vitest";

import type { Customer } from "../../../../../packages/contracts/src/receivables";
import { buildCreateCustomerCommand, buildUpdateCustomerCommand, customerValues } from "./draft";

const customer: Customer = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Tienda Sol",
  phone: "2222-3333",
  email: null,
  notes: "Entrega por la tarde",
  status: "active",
  createdAt: "2026-08-22T12:00:00.000Z",
  updatedAt: "2026-08-22T12:00:00.000Z",
};

describe("customer drafts", () => {
  test("normalizes optional blanks without inventing contact values", () => {
    const result = buildCreateCustomerCommand(
      { name: "  Ana  ", phone: " ", email: "", notes: "  Cliente frecuente " },
      "10000000-0000-4000-8000-000000000002",
    );
    expect(result).toEqual({
      command: {
        idempotencyKey: "10000000-0000-4000-8000-000000000002",
        name: "Ana",
        notes: "Cliente frecuente",
      },
      issues: {},
    });
  });

  test("uses explicit null only when an existing optional value is cleared", () => {
    const result = buildUpdateCustomerCommand(
      customer,
      { ...customerValues(customer), phone: "", email: "ana@example.com" },
      "10000000-0000-4000-8000-000000000003",
    );
    expect(result).toEqual({
      command: {
        idempotencyKey: "10000000-0000-4000-8000-000000000003",
        phone: null,
        email: "ana@example.com",
      },
      issues: {},
    });
  });

  test("rejects an unchanged update before creating a review", () => {
    const result = buildUpdateCustomerCommand(
      customer,
      customerValues(customer),
      "10000000-0000-4000-8000-000000000004",
    );
    expect(result).toEqual({ issues: { form: "no-changes" } });
  });
});
