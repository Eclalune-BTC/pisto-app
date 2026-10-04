import { describe, expect, spyOn, test } from "bun:test";

import { createPolarIntegration, readPolarCustomerState } from "../src/polar.ts";

const productId = "12345678-1234-4234-8234-123456789012";
const customer = {
  id: "immutable-user-id",
  name: "Test User",
  email: "existing-customer@example.test",
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function integration() {
  const { client, plugin } = createPolarIntegration({
    db: {} as never,
    config: {
      enabled: true,
      accessToken: "test-token",
      webhookSecret: "test-secret",
      server: "sandbox",
      products: [{ productId, slug: "pro", entitlementKey: "pro" }],
      successUrl: "http://localhost:8090/billing/success",
    },
  });
  if (!client || !plugin) throw new Error("Expected enabled test integration");
  return { client, plugin };
}

describe("Polar customer identity", () => {
  test("does not link, update or delete provider customers through account lifecycle hooks", async () => {
    const { client, plugin } = integration();
    const fail = async () => {
      throw new Error("Account lifecycle must not access provider customers");
    };
    const guards = [
      spyOn(client.customers, "list").mockImplementation(fail),
      spyOn(client.customers, "create").mockImplementation(fail),
      spyOn(client.customers, "update").mockImplementation(fail),
      spyOn(client.customers, "updateExternal").mockImplementation(fail),
      spyOn(client.customers, "delete").mockImplementation(fail),
    ];
    try {
      const hooks = plugin.init().options.databaseHooks.user;
      const context = { context: { logger: { error: fail } } } as never;
      await hooks.create.before(customer, context);
      await hooks.create.after(customer, context);
      await hooks.update.after(customer, context);
      await hooks.delete.after(customer, context);
      for (const guard of guards) expect(guard).not.toHaveBeenCalled();
    } finally {
      for (const guard of guards) guard.mockRestore();
    }
  });

  test("checkout and portal retain the authenticated immutable user identity", async () => {
    const { client, plugin } = integration();
    const checkoutEndpoint = "checkout" in plugin.endpoints ? plugin.endpoints.checkout : undefined;
    const portalEndpoint = "portal" in plugin.endpoints ? plugin.endpoints.portal : undefined;
    if (!checkoutEndpoint || !portalEndpoint) throw new Error("Expected billing endpoints");
    const checkout = spyOn(client.checkouts, "create").mockResolvedValue({
      url: "https://checkout.example.test/session",
    } as never);
    const portal = spyOn(client.customerSessions, "create").mockResolvedValue({
      customerPortalUrl: "https://portal.example.test/session",
    } as never);
    try {
      const context = {
        context: { session: { user: customer, session: { id: "session-test" } } } as never,
        headers: new Headers(),
        request: new Request("http://localhost:3015/api/auth/checkout", { method: "POST" }),
      };
      expect(
        await checkoutEndpoint({
          ...context,
          body: { slug: "pro", redirect: false },
        }),
      ).toEqual({ url: "https://checkout.example.test/session", redirect: false });
      expect(checkout).toHaveBeenCalledTimes(1);
      expect(checkout.mock.calls[0]?.[0]).toMatchObject({
        externalCustomerId: customer.id,
        products: [productId],
      });
      expect(checkout.mock.calls[0]?.[0]).not.toHaveProperty("customerEmail");
      expect(await portalEndpoint({ ...context, body: { redirect: false } })).toEqual({
        url: "https://portal.example.test/session",
        redirect: false,
      });
      expect(portal.mock.calls[0]?.[0]).toEqual({ externalCustomerId: customer.id });
    } finally {
      checkout.mockRestore();
      portal.mockRestore();
    }
  });

  test("bounds an unresponsive provider and keeps its timeout private", async () => {
    const fetch = spyOn(globalThis, "fetch").mockImplementation(
      Object.assign(
        async (input: Parameters<typeof globalThis.fetch>[0]) => {
          if (!(input instanceof Request)) throw new Error("Expected SDK Request");
          return new Promise<Response>((_resolve, reject) => {
            if (input.signal.aborted) reject(input.signal.reason);
            else
              input.signal.addEventListener("abort", () => reject(input.signal.reason), {
                once: true,
              });
          });
        },
        { preconnect: globalThis.fetch.preconnect },
      ),
    );
    try {
      const { client } = integration();
      await expect(
        readPolarCustomerState(client, { type: "user", id: customer.id }),
      ).rejects.toMatchObject({
        name: "BillingProviderError",
        message: "The billing provider request failed",
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      fetch.mockRestore();
    }
  }, 15_000);
});
