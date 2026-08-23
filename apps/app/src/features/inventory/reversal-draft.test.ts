import { describe, expect, test } from "vitest";

import { buildReversalCommand } from "./reversal-draft";

describe("inventory reversal draft", () => {
  test("builds the exact reviewed reversal command", () => {
    expect(
      buildReversalCommand({
        draft: {
          occurredLocalDate: "2026-08-22",
          occurredLocalTime: "16:10",
          reason: "  Conteo duplicado  ",
        },
        idempotencyKey: "40fc459c-d802-48fb-ad38-e7a5f71d9878",
      }),
    ).toEqual({
      command: {
        occurredLocalDate: "2026-08-22",
        occurredLocalTime: "16:10",
        reason: "Conteo duplicado",
        idempotencyKey: "40fc459c-d802-48fb-ad38-e7a5f71d9878",
      },
    });
  });

  test("rejects invalid occurrence fields before confirmation", () => {
    expect(
      buildReversalCommand({
        draft: { occurredLocalDate: "2026-02-30", occurredLocalTime: "24:00", reason: "" },
        idempotencyKey: "40fc459c-d802-48fb-ad38-e7a5f71d9878",
      }),
    ).toEqual({
      errors: {
        occurredLocalDate: "invalid",
        occurredLocalTime: "invalid",
        reason: "invalid",
      },
    });
  });
});
