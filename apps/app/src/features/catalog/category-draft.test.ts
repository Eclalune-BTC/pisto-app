import { describe, expect, test } from "vitest";

import { buildCategoryCommand } from "./category-draft";

describe("category reviewed command", () => {
  test("trims and preserves one caller-provided idempotency key", () => {
    expect(
      buildCategoryCommand({
        idempotencyKey: "aa615c81-590e-4f98-a861-060900423c13",
        mode: "create",
        name: "  Bebidas  ",
      }),
    ).toEqual({
      command: {
        idempotencyKey: "aa615c81-590e-4f98-a861-060900423c13",
        name: "Bebidas",
      },
    });
  });

  test("rejects an empty or oversized name before review", () => {
    expect(
      buildCategoryCommand({
        idempotencyKey: "2dde2239-e032-4802-930e-3b07dc8d299d",
        mode: "edit",
        name: "   ",
      }),
    ).toEqual({ error: "invalid-name" });
    expect(
      buildCategoryCommand({
        idempotencyKey: "2dde2239-e032-4802-930e-3b07dc8d299d",
        mode: "edit",
        name: "a".repeat(81),
      }),
    ).toEqual({ error: "invalid-name" });
  });
});
