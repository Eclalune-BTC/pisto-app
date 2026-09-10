import { describe, expect, spyOn, test } from "bun:test";
import { Hono } from "hono";

import { requestContext } from "../src/middleware/request-context.ts";
import type { AppEnv } from "../src/types.ts";

describe("request log privacy", () => {
  test("logs route patterns without identifiers, auth tokens, query values, or unknown paths", async () => {
    const output = spyOn(console, "info").mockImplementation(() => undefined);
    try {
      const app = new Hono<AppEnv>();
      app.use("*", requestContext());
      app.get("/v1/sales/:saleId", (context) => context.json({ ok: true }));
      app.get("/api/auth/*", (context) => context.json({ ok: true }));

      await app.request("/v1/sales/private-sale-id?customer=private-email");
      await app.request("/api/auth/reset-password/private-reset-token");
      await app.request("/private-unknown-path");

      const logs = output.mock.calls.map(([value]) => JSON.parse(String(value)));
      expect(logs.map((entry) => entry.path)).toEqual(["/v1/sales/:saleId", "/api/auth/*", "/*"]);
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
