import { describe, expect, test } from "vitest";

import { RECEIVABLE_PAYMENT_CAPABILITIES, receivablePaymentsEnabled } from "./capabilities";

describe("receivable payment capability gate", () => {
  test("exposes payments only through the named, integrated atomic cash capability", () => {
    expect(RECEIVABLE_PAYMENT_CAPABILITIES.atomicCashMovement).toBe(true);
    expect(receivablePaymentsEnabled()).toBe(true);
  });

  test("fails closed when an integration build disables the atomic seam", () => {
    expect(receivablePaymentsEnabled({ atomicCashMovement: false })).toBe(false);
  });
});
