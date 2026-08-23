import { describe, expect, test } from "vitest";

import { type ExpensesScreenState, expensesScreenPresentation } from "./state";

describe("expenses screen state policy", () => {
  test("keeps empty, denied, and unavailable states distinct", () => {
    expect(expensesScreenPresentation({ kind: "denied" })).toMatchObject({
      showCreate: false,
      showHistory: false,
      showRetry: false,
    });
    expect(
      expensesScreenPresentation({ kind: "error", message: "Network unavailable" }).showRetry,
    ).toBe(true);
  });

  test("blocks a duplicate action while confirmation is uncertain", () => {
    const state = {
      kind: "ready",
      expenses: [],
      summary: {
        categories: [],
      },
      canManage: true,
      confirmation: "uncertain",
    } as unknown as ExpensesScreenState;

    expect(expensesScreenPresentation(state)).toEqual({
      showCreate: false,
      showHistory: false,
      showRetry: false,
      blocksDuplicateMutation: true,
    });
  });

  test("renders history only from successful real records", () => {
    const ready = {
      kind: "ready",
      expenses: [{ id: "one" }],
      summary: { categories: [] },
      canManage: true,
      confirmation: "idle",
    } as unknown as ExpensesScreenState;
    expect(expensesScreenPresentation(ready)).toMatchObject({
      showCreate: true,
      showHistory: true,
      blocksDuplicateMutation: false,
    });
  });
});
