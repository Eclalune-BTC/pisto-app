import { describe, expect, mock, test } from "bun:test";
import { createPolarWebhookProcessor } from "../src/polar.ts";

const payload = {
  type: "subscription.active",
  timestamp: new Date("2026-09-01T00:00:00Z"),
  data: {
    id: "subscription",
    productId: "product",
    customerId: "customer",
    status: "active",
    currentPeriodStart: new Date("2026-09-01T00:00:00Z"),
    currentPeriodEnd: new Date("2026-10-01T00:00:00Z"),
    cancelAtPeriodEnd: false,
    metadata: {},
    customer: { id: "customer", externalId: "user" },
  },
};

describe("Polar projection input", () => {
  test("rejects invented event dates, absent identifiers and alternate field guesses before persistence", async () => {
    const transaction = mock(async () => ({ duplicate: true, projected: false }));
    const process = createPolarWebhookProcessor({
      db: { transaction } as never,
      config: {
        enabled: true,
        accessToken: "unused",
        webhookSecret: "unused",
        server: "sandbox",
        products: [],
        successUrl: "http://localhost",
      },
    });
    for (const invalid of [
      null,
      [],
      {},
      { ...payload, timestamp: undefined },
      { ...payload, timestamp: "invalid" },
      { ...payload, timestamp: new Date(NaN) },
      { ...payload, type: undefined },
    ]) {
      await expect(process(invalid)).rejects.toThrow();
    }
    for (const change of [
      { id: undefined },
      { productId: undefined, product_id: "product" },
      { customerId: undefined },
      { status: "unknown" },
      { metadata: null },
      { cancelAtPeriodEnd: undefined },
      { currentPeriodEnd: null, endsAt: payload.data.currentPeriodEnd },
      { currentPeriodEnd: "2020-01-01T00:00:00Z" },
      { currentPeriodStart: undefined },
      { customer: { id: "different" } },
    ]) {
      await expect(process({ ...payload, data: { ...payload.data, ...change } })).rejects.toThrow();
    }
    expect(transaction).not.toHaveBeenCalled();
    expect(await process(payload)).toEqual({ duplicate: true, projected: false });
    expect(await process(JSON.parse(JSON.stringify(payload)))).toEqual({
      duplicate: true,
      projected: false,
    });
    expect(transaction).toHaveBeenCalledTimes(2);
  });
});
