import { describe, expect, mock, test } from "bun:test";
import { createPolarWebhookProcessor } from "../src/polar.ts";
import { polarTestPayload as payload } from "./polar-fixture.ts";

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
      { product_id: undefined, productId: "product" },
      { customer_id: undefined },
      { status: "unknown" },
      { metadata: null },
      { cancel_at_period_end: undefined },
      { current_period_end: null, endsAt: payload.data.current_period_end },
      { current_period_end: "2020-01-01T00:00:00Z" },
      { current_period_start: undefined },
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
