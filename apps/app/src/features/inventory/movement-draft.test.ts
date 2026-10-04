import { describe, expect, test } from "vitest";

import { balanceAfter, buildMovementCommand, movementDelta } from "./movement-draft";

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

  test("signs the reviewed change and previews the balance without floating point", () => {
    const command = {
      idempotencyKey: "f9a44455-ec16-4a15-9368-8bc64b65b681",
      action: "adjust_out" as const,
      quantityMinorUnits: "9223372036854775807",
      reason: "Damaged stock",
      occurredLocalDate: "2026-08-22",
      occurredLocalTime: "14:30",
    };
    expect(movementDelta(command)).toBe("-9223372036854775807");
    expect(movementDelta({ ...command, action: "receive" })).toBe("9223372036854775807");
    expect(balanceAfter("9223372036854775807", command)).toBe(0n);
    expect(balanceAfter("1", { ...command, quantityMinorUnits: "2" })).toBe(-1n);
    expect(balanceAfter("1", { ...command, action: "adjust_in", quantityMinorUnits: "2" })).toBe(
      3n,
    );
  });
});
