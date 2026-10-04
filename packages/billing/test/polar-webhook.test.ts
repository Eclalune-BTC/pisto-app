import { describe, expect, mock, test } from "bun:test";
import { createHmac } from "node:crypto";
import { polarTestConfig, polarTestIntegration, polarTestPayload } from "./polar-fixture.ts";

function fixture() {
  const transaction = mock(async () => ({ duplicate: false, projected: true }));
  const { plugin } = polarTestIntegration({ transaction } as never);
  const endpoint = "polarWebhooks" in plugin.endpoints ? plugin.endpoints.polarWebhooks : undefined;
  if (!endpoint) throw new Error("Expected Polar webhook endpoint");
  const logger = { error: mock(() => undefined) };
  const deliver = (
    body: string,
    options: {
      standardSecret?: boolean;
      timestamp?: number;
      signedBody?: string;
      signature?: string;
    } = {},
  ) => {
    const timestamp = options.timestamp ?? Math.floor(Date.now() / 1_000);
    const id = "provider-event-id";
    const key = options.standardSecret
      ? Buffer.from(polarTestConfig.webhookSecret.slice("whsec_".length), "base64")
      : Buffer.from(polarTestConfig.webhookSecret);
    const signature =
      options.signature ??
      createHmac("sha256", key)
        .update(`${id}.${timestamp}.${options.signedBody ?? body}`)
        .digest("base64");
    const request = new Request("http://localhost:3015/api/auth/polar/webhooks", {
      method: "POST",
      body,
      headers: {
        "content-type": "application/json",
        "webhook-id": id,
        "webhook-timestamp": String(timestamp),
        "webhook-signature": `v1,${signature}`,
      },
    });
    return endpoint({ request, headers: request.headers, context: { logger } as never });
  };
  return { deliver, transaction };
}

describe("Polar signed webhook adapter", () => {
  test.each([false, true])(
    "verifies the exact raw body with Standard Webhooks key encoding=%s",
    async (standardSecret) => {
      const { deliver, transaction } = fixture();
      const body = JSON.stringify(polarTestPayload, null, 2);
      expect(await deliver(body, { standardSecret })).toEqual({ received: true });
      expect(transaction).toHaveBeenCalledTimes(1);
      await expect(deliver(`${body} `, { standardSecret, signedBody: body })).rejects.toMatchObject(
        {
          status: "FORBIDDEN",
        },
      );
      expect(transaction).toHaveBeenCalledTimes(1);
    },
  );

  test("rejects invalid signatures and stale or future delivery timestamps before persistence", async () => {
    const { deliver, transaction } = fixture();
    const body = JSON.stringify(polarTestPayload);
    await expect(deliver(body, { signature: "invalid" })).rejects.toMatchObject({
      status: "FORBIDDEN",
    });
    for (const offset of [-600, 600]) {
      await expect(
        deliver(body, { timestamp: Math.floor(Date.now() / 1_000) + offset }),
      ).rejects.toMatchObject({ status: "FORBIDDEN" });
    }
    expect(transaction).not.toHaveBeenCalled();
  });

  test("rejects malformed signed data without consuming a corrected delivery", async () => {
    const { deliver, transaction } = fixture();
    await expect(deliver("{")).rejects.toMatchObject({ status: "BAD_REQUEST" });
    await expect(
      deliver(
        JSON.stringify({
          ...polarTestPayload,
          data: { ...polarTestPayload.data, current_period_end: null },
        }),
      ),
    ).rejects.toMatchObject({ status: "INTERNAL_SERVER_ERROR" });
    expect(transaction).not.toHaveBeenCalled();
    expect(await deliver(JSON.stringify(polarTestPayload))).toEqual({ received: true });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  test("acknowledges a signed unknown event without projecting it", async () => {
    const { deliver, transaction } = fixture();
    expect(await deliver(JSON.stringify({ ...polarTestPayload, type: "future.event" }))).toEqual({
      received: true,
    });
    expect(transaction).not.toHaveBeenCalled();
  });
});
