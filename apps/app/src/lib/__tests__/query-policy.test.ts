import { CanceledError } from "axios";
import { describe, expect, it } from "vitest";
import { ApiClientError, isAmbiguousMutationError } from "../api-error";
import { shouldRetryQuery } from "../query-policy";

describe("query retry policy", () => {
  it("retries a transient read once", () => {
    for (const status of [0, 502, 503, 504]) {
      const error = new ApiClientError("Unavailable", status);
      expect(shouldRetryQuery(0, error)).toBe(true);
      expect(shouldRetryQuery(1, error)).toBe(false);
    }
  });
  it("does not retry auth, validation, rate limits, corrupt responses or cancellations", () => {
    for (const status of [200, 400, 401, 403, 404, 409, 429, 500]) {
      expect(shouldRetryQuery(0, new ApiClientError("Rejected", status))).toBe(false);
    }
    expect(shouldRetryQuery(0, new CanceledError())).toBe(false);
    expect(shouldRetryQuery(0, new Error("Unknown failure"))).toBe(false);
  });
  it("knows a paused write did not commit but preserves ambiguity on a lost response", () => {
    const paused = new ApiClientError("Paused", 503, "WRITES_PAUSED");
    expect(isAmbiguousMutationError(paused)).toBe(false);
    expect(shouldRetryQuery(0, paused)).toBe(false);
    expect(isAmbiguousMutationError(new ApiClientError("Connection lost", 0))).toBe(true);
  });
});
