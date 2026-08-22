import { describe, expect, test } from "bun:test";

import {
  apiErrorEnvelopeSchema,
  billingCheckoutRequestSchema,
  billingRedirectResponseSchema,
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
});
