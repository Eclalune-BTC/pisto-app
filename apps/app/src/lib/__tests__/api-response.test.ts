import { type HealthResponse, healthResponseSchema } from "@pisto/contracts";
import { describe, expect, it } from "vitest";

import { extractSuccessPayload, parseSuccessPayload } from "@/lib/api-response";

describe("API response modes", () => {
  it("keeps the raw health response instead of trying to unwrap data", () => {
    const health: HealthResponse = {
      service: "pisto-api",
      status: "ok",
      timestamp: "2026-08-22T12:00:00.000Z",
    };

    expect(extractSuccessPayload<HealthResponse>(health, "raw")).toEqual(health);
  });

  it("unwraps versioned success envelopes", () => {
    expect(
      extractSuccessPayload<{ version: "v1" }>({ data: { version: "v1" } }, "envelope"),
    ).toEqual({
      version: "v1",
    });
  });

  it("rejects a raw response that violates the shared contract", () => {
    expect(() =>
      parseSuccessPayload<HealthResponse, HealthResponse>(
        healthResponseSchema,
        { service: "pisto-api", status: "ok" },
        "raw",
      ),
    ).toThrow("shared API contract");
  });
});
