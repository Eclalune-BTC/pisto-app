import { describe, expect, spyOn, test } from "bun:test";
import { createPolarIntegration, readPolarCustomerState } from "../src/polar.ts";
import { polarTestIntegration, polarTestProductId } from "./polar-fixture.ts";

const customer = {
  id: "immutable-user-id",
  name: "Test User",
  email: "existing-customer@example.test",
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Polar customer identity", () => {
  test("keeps the disabled integration disconnected", () => {
    expect(createPolarIntegration({ db: {} as never, config: { enabled: false } })).toEqual({
      client: null,
      plugin: null,
      processWebhook: null,
    });
  });

  test("does not link, update or delete provider customers through account lifecycle hooks", async () => {
    const { client, plugin } = polarTestIntegration();
    const guard = spyOn(client, "sendRequest").mockImplementation(async () => {
      throw new Error("Account lifecycle must not access provider customers");
    });
    try {
      const hooks = plugin.init({} as never).options.databaseHooks.user;
      await hooks.create.after(customer, {} as never);
      await hooks.update.after(customer, {} as never);
      await hooks.delete.before(customer, {} as never);
      await hooks.delete.after(customer, {} as never);
      expect(guard).not.toHaveBeenCalled();
    } finally {
      guard.mockRestore();
    }
  });

  test("checkout and portal bind immutable identity and retain organization metadata", async () => {
    const { client, plugin } = polarTestIntegration();
    const checkoutEndpoint = "checkout" in plugin.endpoints ? plugin.endpoints.checkout : undefined;
    const portalEndpoint = "portal" in plugin.endpoints ? plugin.endpoints.portal : undefined;
    if (!checkoutEndpoint || !portalEndpoint) throw new Error("Expected billing endpoints");
    const requests: Request[] = [];
    const transport = spyOn(client, "sendRequest").mockImplementation(async ([url, init]) => {
      requests.push(new Request(url, init));
      return Response.json(
        url.includes("/checkouts/")
          ? { url: "https://checkout.example.test/session" }
          : { customer_portal_url: "https://portal.example.test/session" },
      );
    });
    try {
      const context = {
        context: { session: { user: customer, session: { id: "session-test" } } } as never,
        headers: new Headers(),
        request: new Request("http://localhost:3015/api/auth/checkout", { method: "POST" }),
      };
      for (const reference_id of [undefined, "authorized-business"]) {
        expect(
          await checkoutEndpoint({
            ...context,
            body: { slug: "pro", redirect: false, reference_id },
          }),
        ).toEqual({ url: "https://checkout.example.test/session", redirect: false });
        const request = requests.at(-1);
        if (!request) throw new Error("Expected checkout request");
        expect(request.url).toBe("https://sandbox-api.polar.sh/v1/checkouts/");
        expect(request.headers.get("Polar-Version")).toBe("2026-10");
        const body = await request.json();
        expect(body).toMatchObject({
          external_customer_id: customer.id,
          products: [polarTestProductId],
        });
        expect(body).not.toHaveProperty("customer_email");
        expect(body.metadata).toEqual(reference_id ? { referenceId: reference_id } : undefined);
      }
      expect(await portalEndpoint({ ...context, body: { redirect: false } })).toEqual({
        url: "https://portal.example.test/session",
        redirect: false,
      });
      const portalRequest = requests.at(-1);
      expect(portalRequest?.url).toBe("https://sandbox-api.polar.sh/v1/customer-sessions/");
      expect(await portalRequest?.json()).toEqual({ external_customer_id: customer.id });
      expect(transport).toHaveBeenCalledTimes(3);
    } finally {
      transport.mockRestore();
    }
  });

  test("bounds an unresponsive provider and keeps its timeout private", async () => {
    const fetch = spyOn(globalThis, "fetch").mockImplementation(
      Object.assign(
        async (_input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit) => {
          if (!init?.signal) throw new Error("Expected SDK abort signal");
          const signal = init.signal;
          return new Promise<Response>((_resolve, reject) => {
            if (signal.aborted) reject(signal.reason);
            else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
          });
        },
        { preconnect: globalThis.fetch.preconnect },
      ),
    );
    try {
      const { client } = polarTestIntegration();
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

  test.each([429, 500])("does not retry provider HTTP %i failures", async (status) => {
    const fetch = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("private-provider-detail", {
        status,
        headers: { "Retry-After": "1" },
      }),
    );
    try {
      const { client } = polarTestIntegration();
      await expect(
        readPolarCustomerState(client, { type: "user", id: customer.id }),
      ).rejects.toThrow("The billing provider request failed");
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      fetch.mockRestore();
    }
  });
});
