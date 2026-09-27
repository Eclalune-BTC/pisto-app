import { describe, expect, test } from "bun:test";
import { callAuthEndpoint } from "../src/http.ts";

describe("billing HTTP response boundary", () => {
  const invoke = (status: number, body: string) =>
    callAuthEndpoint({
      auth: { handler: async () => new Response(body, { status }) } as never,
      baseUrl: "http://localhost:3001",
      path: "/api/auth/customer/portal",
      method: "POST",
      headers: new Headers(),
      body: {},
    });

  test("rejects unreadable success responses instead of returning null", async () => {
    await expect(invoke(200, "private invalid provider response")).rejects.toMatchObject({
      status: 503,
      code: "BILLING_UNAVAILABLE",
      message: "The billing provider returned invalid JSON",
    });
  });

  test("preserves authorization failures without depending on their response body", async () => {
    await expect(invoke(401, "private invalid provider response")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    });
    await expect(invoke(403, "private invalid provider response")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
  });
});
