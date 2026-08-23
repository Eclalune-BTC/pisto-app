import { describe, expect, test } from "vitest";

import { financialMutationAction, type ReceivablesLoadState } from "./types";

describe("receivables UI states", () => {
  test("keeps an uncertain financial mutation on the same-command retry path", () => {
    expect(financialMutationAction({ kind: "uncertain", message: "Unknown outcome" })).toBe(
      "retry",
    );
    expect(financialMutationAction({ kind: "submitting" })).toBe("waiting");
    expect(financialMutationAction({ kind: "confirmed" })).toBe("none");
  });

  test("cannot represent a failed query as a successful zero summary", () => {
    const error: ReceivablesLoadState = { kind: "error" };
    expect("summary" in error).toBe(false);
    const empty: ReceivablesLoadState = {
      kind: "empty",
      stale: false,
      summary: {
        currency: "USD",
        currencyMinorUnitDigits: 2,
        outstandingMinorUnits: "0",
        overdueMinorUnits: "0",
        openReceivableCount: "0",
        overdueReceivableCount: "0",
        businessLocalDate: "2026-08-22",
        timeZone: "America/El_Salvador",
        queriedAt: "2026-08-22T12:00:00.000Z",
      },
    };
    expect("summary" in empty).toBe(true);
  });
});
