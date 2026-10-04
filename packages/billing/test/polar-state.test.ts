import { describe, expect, spyOn, test } from "bun:test";
import { BillingProviderError, readPolarCustomerState } from "../src/polar.ts";
import { polarTestIntegration } from "./polar-fixture.ts";

const customerState = {
  id: "customer-1",
  external_id: "user-1",
  active_subscriptions: [],
  granted_benefits: [],
  active_meters: [],
  metadata: { preserve_this_key: "value", referenceId: "business-1" },
};
const subscriptionList = { items: [], pagination: { total_count: 0, max_page: 0 } };

describe("Polar customer-state boundary", () => {
  test("binds reads to the server-selected scope and preserves actual empty collections", async () => {
    const { client } = polarTestIntegration();
    const calls: URL[] = [];
    const transport = spyOn(client, "sendRequest").mockImplementation(async ([url]) => {
      calls.push(new URL(url));
      return Response.json(url.includes("/subscriptions/") ? subscriptionList : customerState);
    });
    try {
      await expect(readPolarCustomerState(client, { type: "user", id: "user-1" })).resolves.toEqual(
        customerState,
      );
      await expect(
        readPolarCustomerState(client, { type: "organization", id: "business-1" }),
      ).resolves.toEqual({ result: subscriptionList });
      expect(calls[0]?.pathname).toBe("/v1/customers/external/user-1/state");
      expect(calls[1]?.pathname).toBe("/v1/subscriptions/");
      expect(calls[1]?.searchParams.get("metadata[referenceId]")).toBe("business-1");
      expect(calls[1]?.searchParams.get("active")).toBe("true");
      expect(calls[1]?.searchParams.get("page")).toBe("1");
      expect(transport).toHaveBeenCalledTimes(2);
    } finally {
      transport.mockRestore();
    }
  });

  test("rejects missing required results instead of inventing an empty state", async () => {
    const { client } = polarTestIntegration();
    const transport = spyOn(client, "sendRequest");
    try {
      for (const payload of [
        null,
        {},
        { ...customerState, active_subscriptions: undefined },
        { ...customerState, granted_benefits: [null] },
        { ...customerState, active_meters: [{}] },
      ]) {
        transport.mockResolvedValue(Response.json(payload));
        await expect(
          readPolarCustomerState(client, { type: "user", id: "user-1" }),
        ).rejects.toThrow(BillingProviderError);
      }
      for (const payload of [
        {},
        { items: [] },
        { ...subscriptionList, items: [{}] },
        { ...subscriptionList, pagination: { total_count: -1, max_page: 0 } },
      ]) {
        transport.mockResolvedValue(Response.json(payload));
        await expect(
          readPolarCustomerState(client, { type: "organization", id: "business-1" }),
        ).rejects.toThrow(BillingProviderError);
      }
    } finally {
      transport.mockRestore();
    }
  });

  test("never prints or exposes SDK failures", async () => {
    const { client } = polarTestIntegration();
    const transport = spyOn(client, "sendRequest").mockRejectedValue(
      new Error("private-provider-token-and-customer"),
    );
    const log = spyOn(console, "log").mockImplementation(() => undefined);
    const error = spyOn(console, "error").mockImplementation(() => undefined);
    try {
      for (const type of ["user", "organization"] as const) {
        await expect(readPolarCustomerState(client, { type, id: "subject-1" })).rejects.toThrow(
          "The billing provider request failed",
        );
      }
      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      transport.mockRestore();
      log.mockRestore();
      error.mockRestore();
    }
  });
});
