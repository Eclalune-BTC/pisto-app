import { describe, expect, spyOn, test } from "bun:test";
import { Elysia } from "elysia";
import { requestContext } from "../src/middleware/request-context.ts";
import { testClient } from "./http-client.ts";

describe("request log privacy", () => {
  test("logs route patterns without identifiers, auth tokens, query values, or unknown paths", async () => {
    const output = spyOn(console, "info").mockImplementation(() => undefined);
    try {
      const app = testClient(
        new Elysia()
          .use(requestContext())
          .get("/v1/sales/:saleId", () => ({ ok: true }))
          .get("/api/auth/*", () => ({ ok: true })),
      );

      await app.request("/v1/sales/private-sale-id?customer=private-email");
      await app.request("/api/auth/reset-password/private-reset-token");
      await app.request("/private-unknown-path");
      // Elysia schedules onAfterResponse after returning the response.
      await new Promise<void>((resolve) => setImmediate(resolve));

      const logs = output.mock.calls.map(([value]) => JSON.parse(String(value)));
      expect(logs.map((entry) => entry.path)).toEqual([
        "/v1/sales/:saleId",
        "/api/auth/*",
        "unmatched",
      ]);
      expect(logs.map((entry) => entry.status)).toEqual([200, 200, 404]);
      expect(JSON.stringify(logs)).not.toContain("private-");
      for (const entry of logs) {
        expect(entry.requestId).toBeString();
        expect(entry.durationMs).toBeNumber();
      }
    } finally {
      output.mockRestore();
    }
  });
});
