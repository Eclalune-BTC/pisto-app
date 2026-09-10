import { describe, expect, spyOn, test } from "bun:test";
import type { Polar } from "@polar-sh/sdk";

import { BillingProviderError, readPolarCustomerState } from "../src/polar.ts";

describe("Polar customer-state boundary", () => {
  test("binds user and organization reads to the server-selected scope", async () => {
    const calls: unknown[] = [];
    const client = {
      customers: {
        getStateExternal: async (request: unknown) => {
          calls.push(request);
          return { activeSubscriptions: [] };
        },
      },
      subscriptions: {
        list: async (request: unknown) => {
          calls.push(request);
          return { result: { items: [] } };
        },
      },
    } as unknown as Pick<Polar, "customers" | "subscriptions">;
    await expect(readPolarCustomerState(client, { type: "user", id: "user-1" })).resolves.toEqual({
      activeSubscriptions: [],
    });
    await expect(
      readPolarCustomerState(client, { type: "organization", id: "business-1" }),
    ).resolves.toEqual({ result: { items: [] } });
    expect(calls).toEqual([
      { externalId: "user-1" },
      { active: true, metadata: { referenceId: "business-1" } },
    ]);
  });

  test("never prints or exposes SDK failures", async () => {
    const privateValue = "private-provider-token-and-customer";
    const fail = async () => {
      throw new Error(privateValue);
    };
    const client = {
      customers: { getStateExternal: fail },
      subscriptions: { list: fail },
    } as unknown as Pick<Polar, "customers" | "subscriptions">;
    const log = spyOn(console, "log").mockImplementation(() => undefined);
    const error = spyOn(console, "error").mockImplementation(() => undefined);
    try {
      for (const type of ["user", "organization"] as const) {
        await expect(readPolarCustomerState(client, { type, id: "subject-1" })).rejects.toThrow(
          BillingProviderError,
        );
        await expect(readPolarCustomerState(client, { type, id: "subject-1" })).rejects.toThrow(
          "The billing provider request failed",
        );
      }
      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  });
});
