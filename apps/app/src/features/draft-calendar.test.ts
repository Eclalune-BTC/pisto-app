import { describe, expect, test } from "vitest";

import { buildCashReversalCommand } from "./cash/drafts";
import { buildVoidExpenseCommand } from "./expenses/drafts";
import { buildMovementCommand } from "./inventory/movement-draft";
import { buildReversalCommand } from "./inventory/reversal-draft";
import { buildPaymentReversalCommand } from "./receivables/draft";
import { validateSaleDraft } from "./sales/sale-draft";

const idempotencyKey = "10000000-0000-4000-8000-000000000001";
const builders: Record<string, (date: string, time: string) => boolean> = {
  sale: (date, time) =>
    validateSaleDraft({ amount: "1", date, time, description: "" }, 2).draft !== null,
  cashReversal: (localDate, localTime) =>
    buildCashReversalCommand({
      draft: { localDate, localTime, reason: "Correction" },
      idempotencyKey,
    }).command !== null,
  expenseVoid: (localDate, localTime) =>
    buildVoidExpenseCommand({
      draft: { localDate, localTime, reason: "Correction" },
      idempotencyKey,
    }).command !== null,
  inventoryMovement: (occurredLocalDate, occurredLocalTime) =>
    "command" in
    buildMovementCommand({
      draft: {
        occurredLocalDate,
        occurredLocalTime,
        action: "receive",
        quantity: "1",
        reason: "Delivery",
      },
      idempotencyKey,
      quantityPrecision: 0,
    }),
  inventoryReversal: (occurredLocalDate, occurredLocalTime) =>
    "command" in
    buildReversalCommand({
      draft: { occurredLocalDate, occurredLocalTime, reason: "Correction" },
      idempotencyKey,
    }),
  paymentReversal: (date, time) =>
    "command" in buildPaymentReversalCommand({ date, time, reference: "" }, idempotencyKey),
};

describe("shared draft calendar validation", () => {
  test.each(["0001-01-01", "0099-12-31", "2000-02-29", "2028-02-29", "2026-04-30", "9999-12-30"])(
    "accepts %s without changing its century",
    (date) => {
      for (const [name, build] of Object.entries(builders))
        expect(build(date, "23:59"), name).toBe(true);
    },
  );

  test.each([
    "",
    "0000-01-01",
    "1900-02-29",
    "2026-02-30",
    "2026-04-31",
    "2026-13-01",
    "2026-01-00",
    "2026-1-01",
    " 2026-01-01",
    "2026-01-01T00:00:00Z",
  ])("rejects %s before preparing any command", (date) => {
    for (const [name, build] of Object.entries(builders))
      expect(build(date, "12:00"), name).toBe(false);
  });

  test.each(["", "24:00", "23:60", "1:00", "12:00:00", "12:00Z", " 12:00"])(
    "rejects invalid minute precision %s",
    (time) => {
      for (const [name, build] of Object.entries(builders))
        expect(build("2026-09-26", time), name).toBe(false);
    },
  );
});
