import { describe, expect, test } from "vitest";

import { buildMovementCommand } from "./movement-draft";

describe("inventory movement draft", () => {
  test("builds an exact fixed-scale reviewed command", () => {
    expect(
      buildMovementCommand({
        draft: {
          action: "adjust_out",
          quantity: "1.250",
          reason: "Damaged stock",
          occurredLocalDate: "2026-08-22",
          occurredLocalTime: "14:30",
        },
        idempotencyKey: "f9a44455-ec16-4a15-9368-8bc64b65b681",
        quantityPrecision: 3,
      }),
    ).toEqual({
      command: {
        idempotencyKey: "f9a44455-ec16-4a15-9368-8bc64b65b681",
        action: "adjust_out",
        quantityMinorUnits: "1250",
        reason: "Damaged stock",
        occurredLocalDate: "2026-08-22",
        occurredLocalTime: "14:30",
      },
    });
  });

  test("rejects impossible dates and excess precision", () => {
    expect(
      buildMovementCommand({
        draft: {
          action: "receive",
          quantity: "1.25",
          reason: "Opening count",
          occurredLocalDate: "2026-02-30",
          occurredLocalTime: "25:00",
        },
        idempotencyKey: "33a7eea1-c813-4a65-aa56-e74c994fe861",
        quantityPrecision: 1,
      }),
    ).toEqual({
      errors: {
        quantity: "invalid-decimals",
        occurredLocalDate: "invalid",
        occurredLocalTime: "invalid",
      },
    });
  });
});
