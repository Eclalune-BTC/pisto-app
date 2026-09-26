import { describe, expect, test } from "bun:test";
import {
  saleReviewActionRequestSchema,
  saleReviewDismissRequestSchema,
  saleReviewPreparedResponseSchema,
  saleReviewSchema,
} from "../src/index.ts";

const key = "11111111-1111-4111-8111-111111111111";
const review = {
  id: key,
  businessId: "business",
  command: {
    idempotencyKey: key,
    grossMinorUnits: "1250",
    occurredLocalDate: "2026-09-26",
    occurredLocalTime: "14:30",
  },
  currency: "USD",
  currencyMinorUnitDigits: 2,
  timeZone: "America/El_Salvador",
  createdAt: "2026-09-26T20:30:00.000Z",
  saleId: null,
};
describe("durable sale review contracts", () => {
  test("cannot report a successful preparation with an absent review", () => {
    expect(saleReviewPreparedResponseSchema.safeParse({ data: { review: null } }).success).toBe(
      false,
    );
  });
  test("preserves an exact command and rejects a substituted identity", () => {
    expect(saleReviewSchema.parse(review)).toEqual(review);
    expect(
      saleReviewSchema.safeParse({ ...review, id: "22222222-2222-4222-8222-222222222222" }).success,
    ).toBe(false);
  });
  test("rejects missing snapshots and client-selected command ownership", () => {
    expect(saleReviewSchema.safeParse({ ...review, currency: undefined }).success).toBe(false);
    expect(
      saleReviewSchema.safeParse({ ...review, command: { ...review.command, businessId: "other" } })
        .success,
    ).toBe(false);
  });
  test("confirmation takes no replacement data and dismissal explicitly acknowledges a result", () => {
    expect(saleReviewActionRequestSchema.parse({})).toEqual({});
    expect(saleReviewActionRequestSchema.safeParse({ grossMinorUnits: "1" }).success).toBe(false);
    expect(saleReviewDismissRequestSchema.safeParse({}).success).toBe(false);
    expect(saleReviewDismissRequestSchema.parse({ acknowledgedSaleId: null })).toEqual({
      acknowledgedSaleId: null,
    });
  });
});
