import { describe, expect, test } from "vitest";

import { cashOperationPresentation } from "./operation-state";

describe("cash operation presentation policy", () => {
  test.each(["loading", "denied", "error"] as const)(
    "does not expose a mutation while the screen is %s",
    (remoteKind) => {
      expect(
        cashOperationPresentation({ remoteKind, canManage: true, confirmation: "idle" }),
      ).toMatchObject({ canStart: false, canConfirm: false });
    },
  );

  test("does not expose a manager action to a read-only actor", () => {
    expect(
      cashOperationPresentation({ remoteKind: "ready", canManage: false, confirmation: "idle" }),
    ).toMatchObject({ canStart: false, canConfirm: false });
  });

  test("forces status reconciliation instead of a duplicate uncertain command", () => {
    expect(
      cashOperationPresentation({
        remoteKind: "ready",
        canManage: true,
        confirmation: "uncertain",
      }),
    ).toEqual({ canStart: false, canConfirm: false, blocksDuplicateMutation: true });
  });

  test("allows a confirmed manager to prepare and submit a command", () => {
    expect(
      cashOperationPresentation({ remoteKind: "ready", canManage: true, confirmation: "idle" }),
    ).toEqual({ canStart: true, canConfirm: true, blocksDuplicateMutation: false });
  });
});
