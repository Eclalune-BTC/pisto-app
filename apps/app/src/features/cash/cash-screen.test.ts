import { describe, expect, test } from "vitest";

import { type CashScreenState, cashScreenPresentation } from "./state";

describe("cash screen state policy", () => {
  test("never exposes cash data or mutations while access is denied", () => {
    expect(cashScreenPresentation({ kind: "denied" })).toEqual({
      showAccounts: false,
      showCreate: false,
      showRetry: false,
      blocksDuplicateMutation: false,
    });
  });

  test("keeps an uncertain confirmation from becoming a duplicate mutation", () => {
    const state: CashScreenState = {
      kind: "ready",
      accounts: [],
      movements: [],
      canManage: true,
      confirmation: "uncertain",
      isStale: false,
    };
    expect(cashScreenPresentation(state)).toMatchObject({
      showCreate: false,
      showRetry: false,
      blocksDuplicateMutation: true,
    });
  });

  test("shows a create action only for a confirmed manager state", () => {
    const member: CashScreenState = {
      kind: "ready",
      accounts: [],
      movements: [],
      canManage: false,
      confirmation: "idle",
      isStale: false,
    };
    const manager: CashScreenState = { ...member, canManage: true };
    expect(cashScreenPresentation(member).showCreate).toBe(false);
    expect(cashScreenPresentation(manager).showCreate).toBe(true);
  });
});
