import { describe, expect, test } from "bun:test";

import {
  apiErrorEnvelopeSchema,
  billingCheckoutRequestSchema,
  billingRedirectResponseSchema,
  businessAccessSchema,
  businessSchema,
  createBusinessRequestSchema,
  createSaleRequestSchema,
  positiveMinorUnitsSchema,
  previousMonthSummarySchema,
  replaceSaleRequestSchema,
  saleCorrectionResponseSchema,
  voidSaleRequestSchema,
} from "../src/index.ts";

describe("API contracts", () => {
  test("accepts a structured API error", () => {
    const result = apiErrorEnvelopeSchema.safeParse({
      error: {
        code: "NOT_FOUND",
        message: "Resource not found",
        requestId: "request-123",
      },
    });

    expect(result.success).toBe(true);
  });

  test("rejects untrusted checkout fields", () => {
    const result = billingCheckoutRequestSchema.safeParse({
      slug: "pro",
      products: ["untrusted-product-id"],
    });

    expect(result.success).toBe(false);
  });

  test("requires the API to return a non-redirecting checkout URL", () => {
    const result = billingRedirectResponseSchema.safeParse({
      data: {
        url: "https://sandbox.polar.sh/checkout/example",
        redirect: false,
      },
    });

    expect(result.success).toBe(true);
  });

  test("accepts only canonical positive signed-int64 money strings", () => {
    expect(positiveMinorUnitsSchema.safeParse("1").success).toBe(true);
    expect(positiveMinorUnitsSchema.safeParse("9223372036854775807").success).toBe(true);
    expect(positiveMinorUnitsSchema.safeParse("0").success).toBe(false);
    expect(positiveMinorUnitsSchema.safeParse("01").success).toBe(false);
    expect(positiveMinorUnitsSchema.safeParse("1.25").success).toBe(false);
    expect(positiveMinorUnitsSchema.safeParse("9223372036854775808").success).toBe(false);
  });

  test("allows a canonical summary aggregate beyond one row's bigint range", () => {
    const result = previousMonthSummarySchema.safeParse({
      periodStartLocal: "2026-07-01",
      periodEndLocalExclusive: "2026-08-01",
      periodStartUtc: "2026-07-01T06:00:00.000Z",
      periodEndUtcExclusive: "2026-08-01T06:00:00.000Z",
      timeZone: "America/El_Salvador",
      currency: "USD",
      currencyMinorUnitDigits: 2,
      grossMinorUnits: "18446744073709551614",
      saleCount: "2",
      averageMinorUnits: "9223372036854775807",
      queriedAt: "2026-08-22T12:00:00.000Z",
    });

    expect(result.success).toBe(true);
  });

  test("accepts only explicit Pisto business roles and permissions", () => {
    expect(
      businessAccessSchema.safeParse({
        role: "admin",
        permissions: ["business:read", "sales:create", "sales:read", "sales:summary:read"],
      }).success,
    ).toBe(true);
    expect(
      businessAccessSchema.safeParse({
        role: "cashier",
        permissions: ["sales:create"],
      }).success,
    ).toBe(false);
    expect(
      businessAccessSchema.safeParse({
        role: "member",
        permissions: ["sales:delete"],
      }).success,
    ).toBe(false);
  });

  test("requires business responses to carry server-resolved access", () => {
    const result = businessSchema.safeParse({
      id: "business-123",
      name: "Tienda Luna",
      currency: "USD",
      currencyMinorUnitDigits: 2,
      timeZone: "America/El_Salvador",
      createdAt: "2026-08-22T12:00:00.000Z",
      access: {
        role: "owner",
        permissions: [
          "business:configure",
          "business:read",
          "sales:create",
          "sales:read",
          "sales:summary:read",
        ],
      },
    });

    expect(result.success).toBe(true);
  });

  test("rejects untrusted business and sale fields", () => {
    expect(
      createBusinessRequestSchema.safeParse({
        name: "Tienda Luna",
        currency: "USD",
        timeZone: "America/El_Salvador",
        ownerId: "another-user",
      }).success,
    ).toBe(false);
    expect(
      createSaleRequestSchema.safeParse({
        idempotencyKey: "85d434e5-a7fd-49b7-9f12-38aa80a920ae",
        grossMinorUnits: "1250",
        occurredLocalDate: "2026-08-22",
        occurredLocalTime: "14:30",
        businessId: "another-business",
      }).success,
    ).toBe(false);
  });

  test("keeps sale correction commands explicit and tenant-free", () => {
    const idempotencyKey = "85d434e5-a7fd-49b7-9f12-38aa80a920ae";
    expect(
      voidSaleRequestSchema.safeParse({ idempotencyKey, reason: "Duplicate sale" }).success,
    ).toBe(true);
    expect(
      voidSaleRequestSchema.safeParse({
        idempotencyKey,
        reason: "Duplicate sale",
        businessId: "another-business",
      }).success,
    ).toBe(false);
    expect(
      replaceSaleRequestSchema.safeParse({
        idempotencyKey,
        reason: "Correct amount",
        replacement: {
          grossMinorUnits: "1250",
          occurredLocalDate: "2026-08-22",
          occurredLocalTime: "14:30",
        },
      }).success,
    ).toBe(true);
  });

  test("requires canonical correction links on corrected sales", () => {
    const correctedAt = "2026-08-22T20:30:00.000Z";
    const originalSaleId = "5312a3e6-7c91-486a-9233-0cf4d9d3dcc7";
    const correction = {
      id: "3ce0fe40-da34-4fc4-b8a6-0b9b3df52136",
      kind: "void",
      reason: "Duplicate sale",
      originalSaleId,
      replacementSaleId: null,
      correctedAt,
    };
    const sale = {
      id: originalSaleId,
      status: "voided",
      entryMode: "total_only",
      grossMinorUnits: "1250",
      currency: "USD",
      currencyMinorUnitDigits: 2,
      occurredAt: "2026-08-22T20:30:00.000Z",
      occurredLocalDate: "2026-08-22",
      occurredLocalTime: "14:30",
      timeZone: "America/El_Salvador",
      description: null,
      correction,
      createdAt: correctedAt,
    };

    expect(
      saleCorrectionResponseSchema.safeParse({
        data: { correction, originalSale: sale, replacementSale: null, replayed: false },
      }).success,
    ).toBe(true);
  });
});
