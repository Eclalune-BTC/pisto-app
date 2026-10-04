import { describe, expect, test } from "bun:test";
import type { Auth } from "@pisto/auth";
import type { BillingRuntime } from "@pisto/billing";
import type { Database } from "@pisto/db";
import { billingRoutes } from "../src/routes/billing.ts";
import { testClient, testErrorBoundary } from "./http-client.ts";

function billingApp(options: { authenticated: boolean; activeMembership?: boolean | null }) {
  const sessionReads: number[] = [];
  const auth = {
    handler: async () =>
      Response.json({ url: "https://polar.example.test/session", redirect: true }),
    api: {
      getSession: async () => {
        sessionReads.push(1);
        return options.authenticated
          ? {
              user: { id: "user_test" },
              session: {
                id: "session_test",
                activeOrganizationId: options.activeMembership == null ? null : "business_test",
              },
            }
          : null;
      },
    },
  } as unknown as Auth;
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (options.activeMembership ? [{ id: "membership" }] : []),
        }),
      }),
    }),
  } as unknown as Database;
  const billing = {
    checkoutEnabled: true,
    hasProduct: (slug: string) => slug === "pro",
  } as unknown as BillingRuntime;
  const client = testClient(
    testErrorBoundary().use(
      billingRoutes({ auth, authBaseUrl: "https://api.example.test", billing, db }),
    ),
  );
  return {
    sessionReads,
    post: (path: string, body: string) =>
      client.request(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      }),
  };
}

async function errorCode(response: Response) {
  return ((await response.json()) as { error: { code: string } }).error.code;
}

const bodyRoutes = ["/v1/billing/checkout", "/v1/billing/portal"];

describe("billing POST ordering", () => {
  test("rejects an anonymous caller before decoding a malformed body", async () => {
    for (const path of bodyRoutes) {
      const app = billingApp({ authenticated: false });
      const response = await app.post(path, "{");
      expect(response.status).toBe(401);
      expect(await errorCode(response)).toBe("UNAUTHORIZED");
      expect(app.sessionReads).toHaveLength(1);
    }
  });

  test("rejects malformed JSON from an authenticated caller", async () => {
    for (const path of bodyRoutes) {
      const response = await billingApp({ authenticated: true }).post(path, "{");
      expect(response.status).toBe(400);
      expect(await errorCode(response)).toBe("BAD_REQUEST");
    }
  });

  test("checks the billing scope before the checkout body", async () => {
    const revoked = billingApp({ authenticated: true, activeMembership: false });
    for (const body of ["{", JSON.stringify({ slug: 1 })]) {
      const response = await revoked.post("/v1/billing/checkout", body);
      expect(response.status).toBe(403);
      expect(await errorCode(response)).toBe("FORBIDDEN");
    }
    const member = billingApp({ authenticated: true, activeMembership: true });
    const invalid = await member.post("/v1/billing/checkout", JSON.stringify({ slug: 1 }));
    expect(invalid.status).toBe(400);
    expect(await errorCode(invalid)).toBe("VALIDATION_ERROR");
    const valid = await member.post("/v1/billing/checkout", JSON.stringify({ slug: "pro" }));
    expect(valid.status).toBe(200);
  });

  test("treats an empty body as the empty portal request but not as a checkout", async () => {
    const app = billingApp({ authenticated: true });
    const portal = await app.post("/v1/billing/portal", "");
    expect(portal.status).toBe(200);
    expect(await portal.json()).toEqual({
      data: { url: "https://polar.example.test/session", redirect: false },
    });
    const checkout = await app.post("/v1/billing/checkout", "");
    expect(checkout.status).toBe(400);
    expect(await errorCode(checkout)).toBe("BAD_REQUEST");
  });
});
